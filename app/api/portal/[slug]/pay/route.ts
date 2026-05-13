import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import crypto from "crypto";
import { getPortalPublicBaseUrl } from "@/server/lib/public-app-base-url";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/portal/[slug]/pay
 *
 * Initiate payment from captive portal.
 * Customer selects a package and pays via Snippe.
 *
 * Body:
 *   { sessionId: string, packageId: string, phone: string, paymentMethod: "MOBILE" | "CARD" }
 *
 * Flow:
 *   1. Validate portal session and package
 *   2. Create Payment record with PENDING status
 *   3. Call Snippe API to create payment session
 *   4. Return Snippe checkout URL to frontend
 *   5. Snippe webhook → /api/webhooks/snippe → create RADIUS credentials
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const body = await req.json();
    const { sessionId, packageId, phone, paymentMethod = "MOBILE" } = body;

    if (!sessionId || !packageId) {
      return NextResponse.json({ error: "sessionId and packageId are required" }, { status: 400 });
    }

    // 1. Find reseller
    const reseller = await prisma.reseller.findUnique({
      where: { brandSlug: slug },
      select: { id: true, companyName: true, commissionRate: true, isActive: true, currency: true },
    });

    if (!reseller || !reseller.isActive) {
      return NextResponse.json({ error: "Portal not available" }, { status: 404 });
    }

    // 2. Validate portal session
    const portalSession = await prisma.portalSession.findFirst({
      where: {
        id: sessionId,
        resellerId: reseller.id,
        status: { in: ["PENDING", "PAYING"] },
      },
    });

    if (!portalSession) {
      return NextResponse.json({ error: "Session expired. Reconnect to WiFi." }, { status: 410 });
    }

    // 3. Validate package
    const pkg = await prisma.package.findFirst({
      where: { id: packageId, resellerId: reseller.id, isActive: true },
    });

    if (!pkg) {
      return NextResponse.json({ error: "Package not available" }, { status: 404 });
    }

    // 4. Calculate revenue split
    const platformFee = Math.round(pkg.price * reseller.commissionRate);
    const resellerAmount = pkg.price - platformFee;

    // 5. Create or find end-user
    let userId: string | undefined;
    if (phone) {
      let user = await prisma.user.findFirst({
        where: { phone: phone.replace(/\s/g, "") },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `${phone.replace(/[^0-9]/g, "")}@portal.ssdomada.com`,
            phone: phone.replace(/\s/g, ""),
            role: "END_USER",
            name: `WiFi User ${phone.slice(-4)}`,
          },
        });
      }
      userId = user.id;
    }

    // 6. Create subscription record
    const expiresAt = new Date(Date.now() + pkg.durationMinutes * 60 * 1000);
    const subscription = await prisma.subscription.create({
      data: {
        userId: userId || "anonymous",
        packageId: pkg.id,
        status: "ACTIVE",
        expiresAt,
      },
    });

    // 7. Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    // 8. Create Payment record (PENDING — will be completed by webhook)
    const payment = await prisma.payment.create({
      data: {
        snippeReference: `PAY-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
        userId: userId || "anonymous",
        resellerId: reseller.id,
        subscriptionId: subscription.id,
        amount: pkg.price,
        resellerAmount,
        platformFee,
        currency: reseller.currency,
        status: "PENDING",
        paymentType: paymentMethod === "CARD" ? "CARD" : "MOBILE",
        customerPhone: phone,
        idempotencyKey,
      } as any,
    });

    // 9. Update portal session
    await prisma.portalSession.update({
      where: { id: sessionId },
      data: {
        status: "PAYING",
        packageId: pkg.id,
        paymentId: payment.id,
      },
    });

    // 10. Call Snippe to create payment
    const appBase = getPortalPublicBaseUrl();
    const snippePayload = {
      amount: pkg.price,
      currency: reseller.currency,
      description: `WiFi - ${pkg.name} (${reseller.companyName})`,
      callback_url: `${appBase}/api/webhooks/snippe`,
      return_url: `${appBase}/portal/${slug}/success?session=${sessionId}`,
      cancel_url: `${appBase}/portal/${slug}?session=${sessionId}&cancelled=true`,
      metadata: {
        paymentId: payment.id,
        sessionId,
        resellerId: reseller.id,
        subscriptionId: subscription.id,
        clientMac: portalSession.clientMac,
        packageId: pkg.id,
      },
      customer: {
        phone,
      },
    };

    let checkoutUrl: string | null = null;

    try {
      const snippeApiBase =
        process.env.SNIPPE_API_URL || process.env.SNIPPE_BASE_URL || "https://api.snippe.co.tz/v1";
      const snippeRes = await fetch(`${snippeApiBase}/payment-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SNIPPE_SECRET_KEY}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(snippePayload),
      });

      const snippeData = await snippeRes.json();

      if (snippeData.data?.checkout_url) {
        checkoutUrl = snippeData.data.checkout_url;

        // Update payment with Snippe reference
        await prisma.payment.update({
          where: { id: payment.id },
          data: { snippeReference: snippeData.data.id || payment.snippeReference } as any,
        });
      } else {
        console.error("[Portal Pay] Snippe error:", snippeData);
        return NextResponse.json({
          error: "Payment gateway error. Please try again.",
          details: snippeData.message,
        }, { status: 502 });
      }
    } catch (snippeError) {
      console.error("[Portal Pay] Snippe request failed:", snippeError);
      return NextResponse.json({ error: "Payment service unavailable" }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.id,
        checkoutUrl,
        sessionId,
        amount: pkg.price,
        currency: reseller.currency,
        package: pkg.name,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Portal Pay] Error:", error);
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}

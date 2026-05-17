import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { PaymentService } from "@/server/services/payment.service";
import { getPortalPublicBaseUrl } from "@/server/lib/public-app-base-url";
import { detectTanzaniaMobileProvider } from "@/lib/tanzania-mobile";
import { checkCapacity } from "@/server/services/reseller-plan-access.service";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const ANONYMOUS_USER_EMAIL = "anonymous@portal.ssdomada.com";

/**
 * POST /api/portal/[slug]/pay
 *
 * Captive-portal payment kickoff.
 *
 * Body:
 *   {
 *     sessionId:   string,         // PortalSession.id (created on initial portal load)
 *     packageId:   string,
 *     phone:       string,
 *     paymentMethod?: "MOBILE" | "CARD"   (default MOBILE)
 *   }
 *
 * Returns either:
 *   { success: true, data: { checkoutUrl, ... } }   → card / session, frontend redirects
 *   { success: true, data: { polling: true, ... } } → mobile STK push, frontend polls /status
 *
 * Side effects:
 *   - Creates / finds the end-user record (by phone).
 *   - Creates a Subscription + Payment (PENDING).
 *   - Moves the PortalSession into "PAYING".
 *   - Asks Snippe to push USSD prompt (mobile) or hosted checkout (card).
 *   - When Snippe webhook fires → PaymentService grants RADIUS/Omada access.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const body = await req.json();
    const {
      sessionId,
      packageId,
      phone,
      paymentMethod = "MOBILE",
    } = body as {
      sessionId?: string;
      packageId?: string;
      phone?: string;
      paymentMethod?: "MOBILE" | "CARD";
    };

    if (!sessionId || !packageId) {
      return NextResponse.json({ error: "sessionId and packageId are required" }, { status: 400 });
    }

    // 1. Reseller
    const reseller = await prisma.reseller.findUnique({
      where: { brandSlug: slug },
      select: {
        id: true,
        companyName: true,
        commissionRate: true,
        isActive: true,
        currency: true,
      },
    });
    if (!reseller || !reseller.isActive) {
      return NextResponse.json({ error: "Portal not available" }, { status: 404 });
    }

    // 2. Portal session must exist & be on a valid state
    const portalSession = await prisma.portalSession.findFirst({
      where: {
        id: sessionId,
        resellerId: reseller.id,
        status: { in: ["PENDING", "PAYING"] },
      },
    });
    if (!portalSession) {
      return NextResponse.json(
        { error: "Session expired. Reconnect to WiFi." },
        { status: 410 },
      );
    }

    // 3. Package must belong to reseller and be active
    const pkg = await prisma.package.findFirst({
      where: { id: packageId, resellerId: reseller.id, isActive: true },
    });
    if (!pkg) {
      return NextResponse.json({ error: "Package not available" }, { status: 404 });
    }

    const clientGate = await checkCapacity(reseller.id, "activeClients");
    if (!clientGate.ok) {
      return NextResponse.json(
        {
          success: false,
          error: clientGate.message,
          code: clientGate.code,
          hint: clientGate.hint,
        },
        { status: clientGate.statusCode },
      );
    }

    // 4. Normalise phone — required for mobile, optional for card.
    const normalizedPhone = phone ? phone.replace(/[^0-9+]/g, "") : "";
    if (paymentMethod === "MOBILE" && !normalizedPhone) {
      return NextResponse.json(
        { error: "Phone number is required for mobile payment" },
        { status: 400 },
      );
    }

    // 5. Find or create end-user (keyed by phone — anonymous fallback)
    const userId = await ensureEndUser(normalizedPhone);

    // 6. Subscription record (becomes ACTIVE only after webhook authorises RADIUS)
    const expiresAt = new Date(Date.now() + pkg.durationMinutes * 60 * 1000);
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        packageId: pkg.id,
        status: "ACTIVE",
        expiresAt,
      },
    });

    // 7. Move portal session to PAYING — frontend polls /status to detect AUTHORIZED.
    await prisma.portalSession.update({
      where: { id: sessionId },
      data: {
        status: "PAYING",
        packageId: pkg.id,
      },
    });

    // 8. Kick off Snippe via the orchestrator service
    if (paymentMethod === "CARD") {
      const result = await PaymentService.initiateSession({
        userId,
        resellerId: reseller.id,
        packageId: pkg.id,
        subscriptionId: subscription.id,
        amount: pkg.price,
        paymentType: "CARD",
        customerPhone: normalizedPhone || undefined,
        customerName: `WiFi user ${normalizedPhone.slice(-4) || pkg.name}`,
        portalSessionId: sessionId,
        clientMac: portalSession.clientMac,
        redirectUrl: buildSuccessRedirect(slug, sessionId),
      });

      await prisma.portalSession.update({
        where: { id: sessionId },
        data: { paymentId: result.paymentId },
      });

      return NextResponse.json({
        success: true,
        data: {
          paymentId: result.paymentId,
          checkoutUrl: result.checkoutUrl,
          sessionId,
          amount: pkg.price,
          currency: reseller.currency,
          package: pkg.name,
          expiresAt: expiresAt.toISOString(),
        },
      });
    }

    // MOBILE money — direct STK push, user stays on the portal page.
    const provider = detectTanzaniaMobileProvider(normalizedPhone);
    if (!provider) {
      return NextResponse.json(
        {
          error:
            "Unable to detect mobile money provider from phone number. Please use a Tanzanian Airtel, Vodacom, Mixx (Yas), or Halotel number.",
        },
        { status: 422 },
      );
    }

    const result = await PaymentService.initiateMobilePush({
      userId,
      resellerId: reseller.id,
      packageId: pkg.id,
      subscriptionId: subscription.id,
      amount: pkg.price,
      paymentType: "MOBILE",
      provider,
      phone: normalizedPhone,
      customerPhone: normalizedPhone,
      portalSessionId: sessionId,
      clientMac: portalSession.clientMac,
    });

    await prisma.portalSession.update({
      where: { id: sessionId },
      data: { paymentId: result.paymentId },
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentId: result.paymentId,
        reference: result.reference,
        sessionId,
        polling: true,
        amount: pkg.price,
        currency: reseller.currency,
        package: pkg.name,
        provider,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Portal Pay] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initiate payment" },
      { status: 500 },
    );
  }
}

// ============================================================
// Helpers
// ============================================================

async function ensureEndUser(phone: string): Promise<string> {
  if (!phone) {
    const anon = await prisma.user.upsert({
      where: { email: ANONYMOUS_USER_EMAIL },
      update: {},
      create: {
        email: ANONYMOUS_USER_EMAIL,
        role: "END_USER",
        name: "Anonymous WiFi User",
      },
      select: { id: true },
    });
    return anon.id;
  }

  const email = `${phone.replace(/[^0-9]/g, "")}@portal.ssdomada.com`;
  const user = await prisma.user.upsert({
    where: { email },
    update: { phone },
    create: {
      email,
      phone,
      role: "END_USER",
      name: `WiFi User ${phone.slice(-4)}`,
    },
    select: { id: true },
  });
  return user.id;
}

function buildSuccessRedirect(slug: string, sessionId: string): string {
  const base = getPortalPublicBaseUrl();
  const path = `/portal/${encodeURIComponent(slug)}/success?session=${encodeURIComponent(sessionId)}`;
  return base ? `${base}${path}` : path;
}


import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { PaymentService } from "@/server/services/payment.service";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/portal/[slug]/status?sessionId=xxx
 *
 * Poll endpoint for the captive portal frontend.
 *
 * Returns the portal session state and, if still PAYING, defensively reconciles
 * with Snippe (`SnippeService.getPayment`) so a missed/rejected webhook doesn't
 * leave a paying customer stuck on "Confirm on your phone". The reconciliation
 * fires at most once per call and is idempotent — see `PaymentService.reconcileFromSnippe`.
 *
 * Frontend should poll every 3-5 seconds after starting payment.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || searchParams.get("session");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const reseller = await prisma.reseller.findUnique({
      where: { brandSlug: slug },
      select: { id: true },
    });

    if (!reseller) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    let session = await prisma.portalSession.findFirst({
      where: { id: sessionId, resellerId: reseller.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Reconcile only if the session is still PAYING and the device hasn't been
    // sitting there for >20 minutes (Snippe's STK expires after 4h but we don't
    // want to hammer the API forever on abandoned attempts).
    if (
      session.status === "PAYING" &&
      session.paymentId &&
      Date.now() - session.updatedAt.getTime() < 20 * 60 * 1000
    ) {
      try {
        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { id: session.paymentId },
              { snippeReference: session.paymentId },
            ],
          },
          select: { id: true },
        });
        if (payment) {
          await PaymentService.reconcileFromSnippe(payment.id);
          session = await prisma.portalSession.findFirst({
            where: { id: sessionId, resellerId: reseller.id },
          });
        }
      } catch (recErr) {
        console.warn("[Portal Status] reconcile failed:", recErr);
      }
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (
      session.status !== "AUTHORIZED" &&
      session.paymentId &&
      Date.now() - session.updatedAt.getTime() < 20 * 60 * 1000
    ) {
      try {
        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { id: session.paymentId },
              { snippeReference: session.paymentId },
            ],
            status: "COMPLETED",
          },
          select: { id: true },
        });
        if (payment) {
          await PaymentService.retryPortalActivation(session.id, reseller.id);
          session = await prisma.portalSession.findFirst({
            where: { id: sessionId, resellerId: reseller.id },
          });
        }
      } catch (activationErr) {
        console.warn("[Portal Status] Omada activation retry failed:", activationErr);
      }
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let remainingSeconds = 0;
    if (session.status === "AUTHORIZED" && session.expiresAt) {
      remainingSeconds = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        clientMac: session.clientMac,
        authorizedAt: session.authorizedAt,
        expiresAt: session.expiresAt,
        remainingSeconds,
        redirectUrl: session.redirectUrl,
        activationError:
          session.status === "OMADA_AUTH_FAILED"
            ? "Payment received, but Omada has not released this device yet. Check Omada Hotspot Operator credentials and captured portal parameters."
            : null,
      },
    });
  } catch (error) {
    console.error("[Portal Status] Error:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/portal/[slug]/status?sessionId=xxx
 *
 * Poll endpoint for captive portal frontend.
 * Checks if a portal session has been authorized (payment completed → RADIUS created).
 * Frontend polls this every 3-5 seconds after redirecting to Snippe payment.
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

    const session = await prisma.portalSession.findFirst({
      where: { id: sessionId, resellerId: reseller.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get remaining time if authorized
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
      },
    });
  } catch (error) {
    console.error("[Portal Status] Error:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}

import { prisma } from "@/server/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/public/platform-stats
 * Anonymous snapshot for marketing / landing page (no auth).
 */
export async function GET() {
  try {
    const [activeResellers, liveWifiPackages, activeWifiSubscriptions] = await Promise.all([
      prisma.reseller.count({ where: { isActive: true } }),
      prisma.package.count({ where: { isActive: true } }),
      prisma.subscription.count({
        where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
      }),
    ]);

    return Response.json({
      success: true,
      data: {
        activeResellers,
        liveWifiPackages,
        activeWifiSubscriptions,
      },
    });
  } catch {
    return Response.json({ success: false, error: "unavailable" }, { status: 503 });
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError } from "@/server/middleware/reseller-auth";

/**
 * GET /api/v1/reseller/analytics
 * Revenue reports, client growth, popular packages, peak usage times.
 * ?type=revenue|clients|packages|usage|export
 * ?period=7d|30d|90d|1y
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "revenue";
    const period = searchParams.get("period") || "30d";

    const now = new Date();
    const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : period === "1y" ? 365 : 30;
    const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // === REVENUE REPORT ===
    if (type === "revenue") {
      const payments = await prisma.payment.findMany({
        where: {
          resellerId: ctx.resellerId,
          status: "COMPLETED" as any,
          createdAt: { gte: startDate },
        },
        select: { amount: true, resellerAmount: true, platformFee: true, createdAt: true } as any,
        orderBy: { createdAt: "asc" },
      });

      // Group by day
      const dailyMap = new Map<string, { revenue: number; earnings: number; commission: number; count: number }>();
      for (const p of payments as any[]) {
        const day = p.createdAt.toISOString().split("T")[0];
        const existing = dailyMap.get(day) || { revenue: 0, earnings: 0, commission: 0, count: 0 };
        existing.revenue += p.amount || 0;
        existing.earnings += p.resellerAmount || 0;
        existing.commission += p.platformFee || 0;
        existing.count += 1;
        dailyMap.set(day, existing);
      }

      const totals = await prisma.payment.aggregate({
        where: { resellerId: ctx.resellerId, status: "COMPLETED" as any, createdAt: { gte: startDate } },
        _sum: { amount: true, resellerAmount: true, platformFee: true },
        _count: true,
      });

      return apiSuccess({
        period,
        chart: Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data })),
        totals: {
          revenue: totals._sum?.amount || 0,
          earnings: totals._sum?.resellerAmount || 0,
          commission: totals._sum?.platformFee || 0,
          transactions: totals._count,
        },
      });
    }

    // === CLIENT GROWTH ===
    if (type === "clients") {
      const subscriptions = await prisma.subscription.findMany({
        where: {
          package: { resellerId: ctx.resellerId },
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, userId: true },
        orderBy: { createdAt: "asc" },
      });

      // Group new clients by day
      const dailyMap = new Map<string, Set<string>>();
      for (const sub of subscriptions) {
        const day = sub.createdAt.toISOString().split("T")[0];
        if (!dailyMap.has(day)) dailyMap.set(day, new Set());
        dailyMap.get(day)!.add(sub.userId);
      }

      const totalUniqueClients = await prisma.subscription.groupBy({
        by: ["userId"],
        where: { package: { resellerId: ctx.resellerId } },
      });

      return apiSuccess({
        period,
        chart: Array.from(dailyMap.entries()).map(([date, users]) => ({
          date,
          newClients: users.size,
        })),
        totalUniqueClients: totalUniqueClients.length,
      });
    }

    // === POPULAR PACKAGES ===
    if (type === "packages") {
      const packages = await prisma.package.findMany({
        where: { resellerId: ctx.resellerId },
        select: {
          id: true,
          name: true,
          price: true,
          duration: true,
          isActive: true,
          isFeatured: true,
          _count: { select: { subscriptions: true } },
        },
        orderBy: { subscriptions: { _count: "desc" } },
      });

      const enriched = await Promise.all(
        packages.map(async (pkg) => {
          const revenue = await prisma.payment.aggregate({
            where: {
              subscription: { packageId: pkg.id },
              resellerId: ctx.resellerId,
              status: "COMPLETED" as any,
              createdAt: { gte: startDate },
            },
            _sum: { amount: true },
            _count: true,
          });

          return {
            ...pkg,
            revenue: revenue._sum?.amount || 0,
            salesInPeriod: revenue._count,
          };
        })
      );

      return apiSuccess({ period, packages: enriched });
    }

    // === PEAK USAGE ===
    if (type === "usage") {
      const sessions = await prisma.wifiSession.findMany({
        where: {
          site: { resellerId: ctx.resellerId },
          startedAt: { gte: startDate },
        },
        select: { startedAt: true, dataUpMb: true, dataDownMb: true },
      });

      // Group by hour of day
      const hourlyMap = new Map<number, { sessions: number; dataMb: number }>();
      for (let h = 0; h < 24; h++) hourlyMap.set(h, { sessions: 0, dataMb: 0 });

      for (const s of sessions) {
        const hour = s.startedAt.getHours();
        const existing = hourlyMap.get(hour)!;
        existing.sessions += 1;
        existing.dataMb += s.dataUpMb + s.dataDownMb;
      }

      return apiSuccess({
        period,
        peakHours: Array.from(hourlyMap.entries())
          .map(([hour, data]) => ({ hour, ...data }))
          .sort((a, b) => b.sessions - a.sessions),
        totalSessions: sessions.length,
      });
    }

    // === CSV EXPORT ===
    if (type === "export") {
      const payments = await prisma.payment.findMany({
        where: {
          resellerId: ctx.resellerId,
          status: "COMPLETED" as any,
          createdAt: { gte: startDate },
        },
        include: {
          user: { select: { name: true, phone: true } },
          subscription: { select: { package: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });

      const csvHeader = "Date,Customer,Phone,Package,Amount,Earnings,Commission\n";
      const csvRows = (payments as any[]).map((p) =>
        `"${p.createdAt.toISOString()}","${p.user?.name || ""}","${p.user?.phone || p.customerPhone || ""}","${p.subscription?.package?.name || ""}",${p.amount},${p.resellerAmount},${p.platformFee}`
      ).join("\n");

      return new Response(csvHeader + csvRows, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="revenue-report-${period}-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return apiError("Invalid type. Use: revenue, clients, packages, usage, export", 400);
  } catch (error) {
    console.error("[Reseller Analytics GET] Error:", error);
    return apiError("Failed to load analytics", 500);
  }
}

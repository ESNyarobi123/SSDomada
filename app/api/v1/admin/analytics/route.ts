import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";

/**
 * GET /api/v1/admin/analytics
 * Revenue analytics, reseller performance, user growth, location stats.
 * ?period=7d|30d|90d|1y|all (default: 30d)
 * ?type=revenue|resellers|users|overview (default: overview)
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30d";
    const type = searchParams.get("type") || "overview";

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "7d": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case "30d": startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case "90d": startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case "1y": startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(0); // all time
    }

    if (type === "revenue") {
      return await getRevenueAnalytics(startDate);
    }

    if (type === "resellers") {
      return await getResellerPerformance(startDate);
    }

    if (type === "users") {
      return await getUserGrowth(startDate);
    }

    // Overview: combined stats
    const [revenue, topResellers, recentGrowth, paymentTypes] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: "COMPLETED", completedAt: { gte: startDate } },
        _sum: { amount: true, platformFee: true, resellerAmount: true },
        _count: true,
        _avg: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ["resellerId"],
        where: { status: "COMPLETED", completedAt: { gte: startDate } },
        _sum: { amount: true, platformFee: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),
      prisma.user.count({
        where: { createdAt: { gte: startDate }, role: "END_USER" },
      }),
      prisma.payment.groupBy({
        by: ["paymentType"],
        where: { status: "COMPLETED", completedAt: { gte: startDate } },
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    // Enrich top resellers with names
    const resellerIds = topResellers.map((r) => r.resellerId);
    const resellers = await prisma.reseller.findMany({
      where: { id: { in: resellerIds } },
      select: { id: true, companyName: true, brandSlug: true },
    });

    const enrichedResellers = topResellers.map((r) => ({
      ...r,
      reseller: resellers.find((res) => res.id === r.resellerId),
    }));

    return apiSuccess({
      period,
      revenue: {
        totalAmount: revenue._sum.amount || 0,
        platformFee: revenue._sum.platformFee || 0,
        resellerShare: revenue._sum.resellerAmount || 0,
        transactionCount: revenue._count,
        averageTransaction: Math.round(revenue._avg.amount || 0),
      },
      topResellers: enrichedResellers,
      newCustomers: recentGrowth,
      paymentTypeBreakdown: paymentTypes.reduce((acc: Record<string, any>, curr) => {
        acc[curr.paymentType] = { count: curr._count, amount: curr._sum.amount || 0 };
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error("[Admin Analytics] Error:", error);
    return apiError("Failed to load analytics", 500);
  }
}

async function getRevenueAnalytics(startDate: Date) {
  // Daily revenue for the period
  const payments = await prisma.payment.findMany({
    where: { status: "COMPLETED", completedAt: { gte: startDate } },
    select: { amount: true, platformFee: true, resellerAmount: true, completedAt: true },
    orderBy: { completedAt: "asc" },
  });

  // Group by day
  const dailyMap = new Map<string, { amount: number; commission: number; count: number }>();
  for (const p of payments) {
    const day = p.completedAt!.toISOString().split("T")[0];
    const existing = dailyMap.get(day) || { amount: 0, commission: 0, count: 0 };
    existing.amount += p.amount;
    existing.commission += p.platformFee;
    existing.count += 1;
    dailyMap.set(day, existing);
  }

  const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }));

  return apiSuccess({ type: "revenue", daily });
}

async function getResellerPerformance(startDate: Date) {
  const performance = await prisma.reseller.findMany({
    where: { isActive: true },
    select: {
      id: true,
      companyName: true,
      brandSlug: true,
      createdAt: true,
      totalEarnings: true,
      walletBalance: true,
      _count: { select: { devices: true, packages: true, sites: true } },
    },
  });

  // Enrich with period-specific revenue
  const enriched = await Promise.all(
    performance.map(async (r) => {
      const periodRevenue = await prisma.payment.aggregate({
        where: { resellerId: r.id, status: "COMPLETED", completedAt: { gte: startDate } },
        _sum: { amount: true, platformFee: true },
        _count: true,
      });

      const activeClients = await prisma.subscription.count({
        where: { package: { resellerId: r.id }, status: "ACTIVE" },
      });

      return {
        ...r,
        periodRevenue: {
          amount: periodRevenue._sum.amount || 0,
          commission: periodRevenue._sum.platformFee || 0,
          transactions: periodRevenue._count,
        },
        activeClients,
      };
    })
  );

  // Sort by period revenue
  enriched.sort((a, b) => b.periodRevenue.amount - a.periodRevenue.amount);

  return apiSuccess({ type: "resellers", resellers: enriched });
}

async function getUserGrowth(startDate: Date) {
  const users = await prisma.user.findMany({
    where: { role: "END_USER", createdAt: { gte: startDate } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by day
  const dailyMap = new Map<string, number>();
  for (const u of users) {
    const day = u.createdAt.toISOString().split("T")[0];
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  }

  const daily = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));

  const totalUsers = await prisma.user.count({ where: { role: "END_USER" } });

  return apiSuccess({ type: "users", daily, totalUsers, newInPeriod: users.length });
}

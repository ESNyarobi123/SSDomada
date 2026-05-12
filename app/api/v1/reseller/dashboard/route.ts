import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError } from "@/server/middleware/reseller-auth";

/**
 * GET /api/v1/reseller/dashboard
 * Reseller's personal dashboard — revenue, clients, devices, balance, quick stats.
 * All data scoped to this reseller only (multi-tenant isolation).
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      // Revenue stats
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenueAllTime,
      // Active clients right now
      activeSubscriptions,
      // Devices
      totalDevices,
      onlineDevices,
      // Reseller wallet
      reseller,
      // Pending withdrawals
      pendingWithdrawals,
      // New clients this month
      newClients,
      // Recent payments
      recentPayments,
      // Top packages
      topPackages,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { resellerId: ctx.resellerId, status: "COMPLETED", completedAt: { gte: todayStart } },
        _sum: { amount: true, resellerAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { resellerId: ctx.resellerId, status: "COMPLETED", completedAt: { gte: weekStart } },
        _sum: { amount: true, resellerAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { resellerId: ctx.resellerId, status: "COMPLETED", completedAt: { gte: monthStart } },
        _sum: { amount: true, resellerAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { resellerId: ctx.resellerId, status: "COMPLETED" },
        _sum: { amount: true, resellerAmount: true, platformFee: true },
        _count: true,
      }),
      prisma.subscription.count({
        where: { package: { resellerId: ctx.resellerId }, status: "ACTIVE", expiresAt: { gt: now } },
      }),
      prisma.device.count({ where: { resellerId: ctx.resellerId } }),
      prisma.device.count({ where: { resellerId: ctx.resellerId, status: "ONLINE" } }),
      prisma.reseller.findUnique({
        where: { id: ctx.resellerId },
        select: { walletBalance: true, totalEarnings: true, commissionRate: true, currency: true },
      }),
      prisma.withdrawal.aggregate({
        where: { resellerId: ctx.resellerId, status: { in: ["PENDING", "APPROVED", "PROCESSING"] } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.subscription.count({
        where: { package: { resellerId: ctx.resellerId }, createdAt: { gte: monthStart } },
      }),
      prisma.payment.findMany({
        where: { resellerId: ctx.resellerId, status: "COMPLETED" },
        take: 10,
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          amount: true,
          resellerAmount: true,
          currency: true,
          paymentType: true,
          customerPhone: true,
          completedAt: true,
          user: { select: { name: true, phone: true } },
        },
      }),
      prisma.payment.groupBy({
        by: ["subscriptionId"],
        where: { resellerId: ctx.resellerId, status: "COMPLETED", subscriptionId: { not: null } },
        _count: true,
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
    ]);

    // Enrich top packages with names
    const subIds = topPackages.map((p) => p.subscriptionId).filter(Boolean) as string[];
    const subs = await prisma.subscription.findMany({
      where: { id: { in: subIds } },
      select: { id: true, package: { select: { id: true, name: true, price: true } } },
    });
    const subMap = new Map(subs.map((s) => [s.id, s.package]));

    const enrichedTopPackages = topPackages.map((tp) => ({
      package: tp.subscriptionId ? subMap.get(tp.subscriptionId) : null,
      salesCount: tp._count,
      revenue: tp._sum.amount || 0,
    }));

    // Most-used packages (by subscription count)
    const popularPackages = await prisma.package.findMany({
      where: { resellerId: ctx.resellerId, isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
        _count: { select: { subscriptions: true } },
      },
      orderBy: { subscriptions: { _count: "desc" } },
      take: 5,
    });

    return apiSuccess({
      revenue: {
        today: { total: revenueToday._sum.amount || 0, earnings: revenueToday._sum.resellerAmount || 0, count: revenueToday._count },
        week: { total: revenueWeek._sum.amount || 0, earnings: revenueWeek._sum.resellerAmount || 0, count: revenueWeek._count },
        month: { total: revenueMonth._sum.amount || 0, earnings: revenueMonth._sum.resellerAmount || 0, count: revenueMonth._count },
        allTime: {
          total: revenueAllTime._sum.amount || 0,
          earnings: revenueAllTime._sum.resellerAmount || 0,
          commission: revenueAllTime._sum.platformFee || 0,
          count: revenueAllTime._count,
        },
      },
      clients: {
        activeNow: activeSubscriptions,
        newThisMonth: newClients,
      },
      devices: {
        total: totalDevices,
        online: onlineDevices,
        offline: totalDevices - onlineDevices,
      },
      wallet: {
        balance: reseller?.walletBalance || 0,
        totalEarnings: reseller?.totalEarnings || 0,
        commissionRate: reseller?.commissionRate || 0,
        currency: reseller?.currency || "TZS",
      },
      pendingWithdrawals: {
        count: pendingWithdrawals._count,
        amount: pendingWithdrawals._sum.amount || 0,
      },
      recentPayments,
      popularPackages,
    });
  } catch (error) {
    console.error("[Reseller Dashboard] Error:", error);
    return apiError("Failed to load dashboard", 500);
  }
}

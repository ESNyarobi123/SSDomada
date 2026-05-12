import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";

/**
 * GET /api/v1/admin/dashboard
 * Returns comprehensive system overview stats for the Super Admin dashboard.
 * Includes: revenue, resellers, devices, clients, withdrawals, system health.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Execute all queries in parallel for performance
    const [
      // Revenue stats
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenueYear,
      revenueAllTime,

      // Entity counts
      totalResellers,
      activeResellers,
      suspendedResellers,
      totalDevices,
      onlineDevices,
      offlineDevices,

      // Client/subscription stats
      activeSubscriptions,
      totalCustomers,

      // Financial
      pendingWithdrawals,
      pendingWithdrawalAmount,
      totalPayouts,

      // Recent activity
      recentPayments,
      recentResellers,

      // Platform earnings
      platformEarnings,
    ] = await Promise.all([
      // Revenue by period
      prisma.payment.aggregate({
        where: { status: "COMPLETED", completedAt: { gte: todayStart } },
        _sum: { amount: true, platformFee: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: "COMPLETED", completedAt: { gte: weekStart } },
        _sum: { amount: true, platformFee: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: "COMPLETED", completedAt: { gte: monthStart } },
        _sum: { amount: true, platformFee: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: "COMPLETED", completedAt: { gte: yearStart } },
        _sum: { amount: true, platformFee: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true, platformFee: true, resellerAmount: true },
        _count: true,
      }),

      // Resellers
      prisma.reseller.count(),
      prisma.reseller.count({ where: { isActive: true } }),
      prisma.reseller.count({ where: { isActive: false } }),

      // Devices
      prisma.device.count(),
      prisma.device.count({ where: { status: "ONLINE" } }),
      prisma.device.count({ where: { status: "OFFLINE" } }),

      // Clients
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "END_USER" } }),

      // Withdrawals
      prisma.withdrawal.count({ where: { status: "PENDING" } }),
      prisma.withdrawal.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
        _count: true,
      }),

      // Recent activity (last 10)
      prisma.payment.findMany({
        where: { status: "COMPLETED" },
        take: 10,
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          paymentType: true,
          completedAt: true,
          reseller: { select: { companyName: true } },
          user: { select: { name: true, phone: true } },
        },
      }),
      prisma.reseller.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          companyName: true,
          brandSlug: true,
          isActive: true,
          createdAt: true,
          _count: { select: { devices: true } },
        },
      }),

      // Platform total earnings (commission)
      prisma.payment.aggregate({
        where: { status: "COMPLETED" },
        _sum: { platformFee: true },
      }),
    ]);

    return apiSuccess({
      revenue: {
        today: { amount: revenueToday._sum.amount || 0, commission: revenueToday._sum.platformFee || 0, count: revenueToday._count },
        week: { amount: revenueWeek._sum.amount || 0, commission: revenueWeek._sum.platformFee || 0, count: revenueWeek._count },
        month: { amount: revenueMonth._sum.amount || 0, commission: revenueMonth._sum.platformFee || 0, count: revenueMonth._count },
        year: { amount: revenueYear._sum.amount || 0, commission: revenueYear._sum.platformFee || 0, count: revenueYear._count },
        allTime: { amount: revenueAllTime._sum.amount || 0, commission: revenueAllTime._sum.platformFee || 0, resellerShare: revenueAllTime._sum.resellerAmount || 0, count: revenueAllTime._count },
      },
      resellers: {
        total: totalResellers,
        active: activeResellers,
        suspended: suspendedResellers,
      },
      devices: {
        total: totalDevices,
        online: onlineDevices,
        offline: offlineDevices,
      },
      clients: {
        activeSubscriptions,
        totalCustomers,
      },
      financial: {
        platformEarnings: platformEarnings._sum.platformFee || 0,
        pendingWithdrawals: { count: pendingWithdrawals, amount: pendingWithdrawalAmount._sum.amount || 0 },
        totalPayouts: { count: totalPayouts._count, amount: totalPayouts._sum.amount || 0 },
      },
      recentActivity: {
        payments: recentPayments,
        newResellers: recentResellers,
      },
    });
  } catch (error) {
    console.error("[Admin Dashboard] Error:", error);
    return apiError("Failed to load dashboard data", 500);
  }
}

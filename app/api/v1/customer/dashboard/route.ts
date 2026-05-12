import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyCustomer, apiSuccess, apiError } from "@/server/middleware/customer-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/customer/dashboard
 * End-user: subscriptions, spend, recent payments.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyCustomer(req);
  if (ctx instanceof Response) return ctx;

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeSubs, subscriptions, paymentsMonth, paymentsAll, recentPayments] = await Promise.all([
      prisma.subscription.count({
        where: { userId: ctx.userId, status: "ACTIVE", expiresAt: { gt: now } },
      }),
      prisma.subscription.findMany({
        where: { userId: ctx.userId },
        take: 5,
        orderBy: { expiresAt: "desc" },
        include: {
          package: {
            select: {
              name: true,
              price: true,
              currency: true,
              duration: true,
              reseller: { select: { companyName: true, brandSlug: true } },
            },
          },
        },
      }),
      prisma.payment.aggregate({
        where: { userId: ctx.userId, status: "COMPLETED", completedAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { userId: ctx.userId, status: "COMPLETED" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: { userId: ctx.userId, status: "COMPLETED" },
        take: 8,
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          paymentType: true,
          completedAt: true,
          reseller: { select: { companyName: true } },
        },
      }),
    ]);

    return apiSuccess({
      profile: { name: ctx.name, email: ctx.email },
      subscriptions: {
        activeCount: activeSubs,
        recent: subscriptions,
      },
      spend: {
        thisMonth: paymentsMonth._sum.amount || 0,
        thisMonthCount: paymentsMonth._count,
        lifetime: paymentsAll._sum.amount || 0,
        lifetimeCount: paymentsAll._count,
      },
      recentPayments,
    });
  } catch (e) {
    console.error("[Customer Dashboard]", e);
    return apiError("Failed to load dashboard", 500);
  }
}

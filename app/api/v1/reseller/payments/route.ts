import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError } from "@/server/middleware/reseller-auth";
import { paginationSchema } from "@/lib/validations/reseller";

/**
 * GET /api/v1/reseller/payments
 * All payments made through this reseller's portal.
 * Includes daily/weekly/monthly charts, filter by date, package, status.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const status = searchParams.get("status") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search") || undefined;
    const packageId = searchParams.get("packageId") || undefined;
    const view = searchParams.get("view") || "list"; // "list" | "chart"

    const where: Record<string, unknown> = { resellerId: ctx.resellerId };
    if (status) (where as any).status = status;
    if (packageId) {
      (where as any).subscription = { packageId };
    }

    if (startDate || endDate) {
      (where as any).createdAt = {};
      if (startDate) (where as any).createdAt.gte = new Date(startDate);
      if (endDate) (where as any).createdAt.lte = new Date(endDate);
    }

    if (search) {
      (where as any).OR = [
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { snippeReference: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (view === "chart") {
      // Return daily revenue chart data
      const payments = await prisma.payment.findMany({
        where: { ...where, status: "COMPLETED" } as any,
        select: { amount: true, resellerAmount: true, platformFee: true, completedAt: true } as any,
        orderBy: { completedAt: "asc" } as any,
      });

      const dailyMap = new Map<string, { revenue: number; earnings: number; commission: number; count: number }>();
      for (const p of payments as any[]) {
        const day = (p.completedAt || p.createdAt)?.toISOString().split("T")[0] || "unknown";
        const existing = dailyMap.get(day) || { revenue: 0, earnings: 0, commission: 0, count: 0 };
        existing.revenue += p.amount || 0;
        existing.earnings += p.resellerAmount || 0;
        existing.commission += p.platformFee || 0;
        existing.count += 1;
        dailyMap.set(day, existing);
      }

      return apiSuccess({
        chart: Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data })),
      });
    }

    // List view
    const [payments, total, summary] = await Promise.all([
      prisma.payment.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, phone: true, email: true } },
          subscription: {
            select: { package: { select: { name: true, price: true, duration: true } } },
          },
        },
      }),
      prisma.payment.count({ where: where as any }),
      prisma.payment.aggregate({
        where: { resellerId: ctx.resellerId, status: "COMPLETED" as any },
        _sum: { amount: true, resellerAmount: true, platformFee: true },
        _count: true,
      }),
    ]);

    return apiSuccess(
      {
        payments,
        summary: {
          totalRevenue: summary._sum?.amount || 0,
          myEarnings: summary._sum?.resellerAmount || 0,
          commission: summary._sum?.platformFee || 0,
          totalTransactions: summary._count,
        },
      },
      { page, limit, total }
    );
  } catch (error) {
    console.error("[Reseller Payments GET] Error:", error);
    return apiError("Failed to fetch payments", 500);
  }
}

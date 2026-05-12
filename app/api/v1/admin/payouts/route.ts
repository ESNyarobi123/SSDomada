import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";
import { paginationSchema } from "@/lib/validations/admin";

/**
 * GET /api/v1/admin/payouts
 * List all withdrawal requests and payouts.
 * Supports filtering by status, reseller, date range.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const status = searchParams.get("status") || undefined;
    const resellerId = searchParams.get("resellerId") || undefined;
    const view = searchParams.get("view") || "withdrawals"; // "withdrawals" or "payouts"

    if (view === "payouts") {
      // Show processed Snippe payouts
      const where: any = {};
      if (status) where.status = status;
      if (resellerId) where.resellerId = resellerId;

      const [payouts, total, summary] = await Promise.all([
        prisma.payout.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            reseller: { select: { id: true, companyName: true, brandSlug: true } },
            withdrawal: { select: { id: true, status: true } },
          },
        }),
        prisma.payout.count({ where }),
        prisma.payout.aggregate({
          where: { ...where, status: "COMPLETED" },
          _sum: { amount: true, fee: true, total: true },
          _count: true,
        }),
      ]);

      return apiSuccess(
        {
          payouts,
          summary: {
            totalPaid: summary._sum.amount || 0,
            totalFees: summary._sum.fee || 0,
            totalDebited: summary._sum.total || 0,
            completedCount: summary._count,
          },
        },
        { page, limit, total }
      );
    }

    // Default: show withdrawal requests
    const where: any = {};
    if (status) where.status = status;
    if (resellerId) where.resellerId = resellerId;

    const [withdrawals, total, pendingSummary] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reseller: {
            select: {
              id: true,
              companyName: true,
              brandSlug: true,
              walletBalance: true,
              totalEarnings: true,
            },
          },
          payout: {
            select: { id: true, snippeReference: true, status: true, completedAt: true },
          },
        },
      }),
      prisma.withdrawal.count({ where }),
      prisma.withdrawal.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return apiSuccess(
      {
        withdrawals,
        pendingSummary: {
          count: pendingSummary._count,
          totalAmount: pendingSummary._sum.amount || 0,
        },
      },
      { page, limit, total }
    );
  } catch (error) {
    console.error("[Admin Payouts GET] Error:", error);
    return apiError("Failed to fetch payouts", 500);
  }
}

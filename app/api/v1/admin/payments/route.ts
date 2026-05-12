import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";
import { paginationSchema } from "@/lib/validations/admin";

/**
 * GET /api/v1/admin/payments
 * List all payments with filtering by reseller, status, payment type, date range.
 * Includes revenue summaries.
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

    const resellerId = searchParams.get("resellerId") || undefined;
    const status = searchParams.get("status") || undefined;
    const paymentType = searchParams.get("paymentType") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search") || undefined;

    const where: any = {};

    if (resellerId) where.resellerId = resellerId;
    if (status) where.status = status;
    if (paymentType) where.paymentType = paymentType;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { snippeReference: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search } } },
      ];
    }

    const [payments, total, summary] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reseller: { select: { id: true, companyName: true, brandSlug: true } },
          user: { select: { id: true, name: true, email: true, phone: true } },
          subscription: {
            select: {
              id: true,
              status: true,
              package: { select: { name: true, duration: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where: { ...where, status: "COMPLETED" },
        _sum: { amount: true, platformFee: true, resellerAmount: true },
        _count: true,
      }),
    ]);

    return apiSuccess(
      {
        payments,
        summary: {
          totalAmount: summary._sum.amount || 0,
          totalPlatformFee: summary._sum.platformFee || 0,
          totalResellerAmount: summary._sum.resellerAmount || 0,
          completedCount: summary._count,
        },
      },
      { page, limit, total }
    );
  } catch (error) {
    console.error("[Admin Payments GET] Error:", error);
    return apiError("Failed to fetch payments", 500);
  }
}

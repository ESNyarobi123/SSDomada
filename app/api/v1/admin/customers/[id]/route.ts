import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/customers/[id]
 * Full customer profile: session history, subscriptions, payments.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const customer = await prisma.user.findUnique({
      where: { id, role: "END_USER" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) return apiError("Customer not found", 404, "NOT_FOUND");

    const [subscriptions, payments, wifiSessions, totalSpent] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        include: {
          package: {
            select: {
              name: true,
              price: true,
              duration: true,
              reseller: { select: { companyName: true, brandSlug: true } },
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          paymentType: true,
          customerPhone: true,
          snippeReference: true,
          completedAt: true,
          createdAt: true,
          reseller: { select: { companyName: true } },
        },
      }),
      prisma.wifiSession.findMany({
        where: { userId: id },
        orderBy: { startedAt: "desc" },
        take: 50,
        select: {
          id: true,
          clientMac: true,
          clientIp: true,
          startedAt: true,
          endedAt: true,
          dataUpMb: true,
          dataDownMb: true,
          site: { select: { name: true, reseller: { select: { companyName: true } } } },
        },
      }),
      prisma.payment.aggregate({
        where: { userId: id, status: "COMPLETED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return apiSuccess({
      ...customer,
      subscriptions,
      payments,
      wifiSessions,
      stats: {
        totalSpent: totalSpent._sum.amount || 0,
        totalTransactions: totalSpent._count,
        totalSubscriptions: subscriptions.length,
        totalSessions: wifiSessions.length,
      },
    });
  } catch (error) {
    console.error("[Admin Customer GET] Error:", error);
    return apiError("Failed to fetch customer details", 500);
  }
}

/**
 * PATCH /api/v1/admin/customers/[id]
 * Block/unblock a customer globally.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "block") {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      // Cancel all active subscriptions
      await prisma.subscription.updateMany({
        where: { userId: id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      await logAdminAction(admin.userId, "customer.blocked", "User", id, { reason: body.reason }, getClientIp(req));
      return apiSuccess({ id, status: "blocked", message: "Customer blocked. Active subscriptions cancelled." });
    }

    if (action === "unblock") {
      await prisma.user.update({
        where: { id },
        data: { isActive: true },
      });

      await logAdminAction(admin.userId, "customer.unblocked", "User", id, {}, getClientIp(req));
      return apiSuccess({ id, status: "active", message: "Customer unblocked." });
    }

    return apiError("Invalid action. Use 'block' or 'unblock'.", 400, "INVALID_ACTION");
  } catch (error: any) {
    if (error.code === "P2025") return apiError("Customer not found", 404, "NOT_FOUND");
    console.error("[Admin Customer PATCH] Error:", error);
    return apiError("Failed to update customer", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import {
  updateResellerSchema,
  adminUpdateResellerUserSchema,
} from "@/lib/validations/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/resellers/[id]
 * Get full reseller details including sites, revenue, devices, packages.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const reseller = await prisma.reseller.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, image: true, isActive: true, createdAt: true } },
        sites: { orderBy: { createdAt: "desc" } },
        captivePortalConfig: true,
        packages: { orderBy: { sortOrder: "asc" } },
        planSubscription: { include: { plan: true } },
        _count: { select: { devices: true, payments: true, withdrawals: true } },
      },
    });

    if (!reseller) return apiError("Reseller not found", 404, "NOT_FOUND");

    // Revenue breakdown
    const [totalRevenue, monthlyRevenue, pendingWithdrawals, recentPayments, deviceStats] = await Promise.all([
      prisma.payment.aggregate({
        where: { resellerId: id, status: "COMPLETED" },
        _sum: { amount: true, platformFee: true, resellerAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          resellerId: id,
          status: "COMPLETED",
          completedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true, platformFee: true, resellerAmount: true },
        _count: true,
      }),
      prisma.withdrawal.findMany({
        where: { resellerId: id, status: { in: ["PENDING", "APPROVED", "PROCESSING"] } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.findMany({
        where: { resellerId: id, status: "COMPLETED" },
        take: 10,
        orderBy: { completedAt: "desc" },
        select: {
          id: true, amount: true, currency: true, paymentType: true, customerPhone: true, completedAt: true,
          user: { select: { name: true, phone: true } },
        },
      }),
      prisma.device.groupBy({
        by: ["status"],
        where: { resellerId: id },
        _count: true,
      }),
    ]);

    return apiSuccess({
      ...reseller,
      revenue: {
        allTime: {
          totalAmount: totalRevenue._sum.amount || 0,
          platformFee: totalRevenue._sum.platformFee || 0,
          resellerEarnings: totalRevenue._sum.resellerAmount || 0,
          transactionCount: totalRevenue._count,
        },
        thisMonth: {
          totalAmount: monthlyRevenue._sum.amount || 0,
          platformFee: monthlyRevenue._sum.platformFee || 0,
          resellerEarnings: monthlyRevenue._sum.resellerAmount || 0,
          transactionCount: monthlyRevenue._count,
        },
      },
      pendingWithdrawals,
      recentPayments,
      deviceStats,
    });
  } catch (error) {
    console.error("[Admin Reseller GET] Error:", error);
    return apiError("Failed to fetch reseller details", 500);
  }
}

/**
 * PATCH /api/v1/admin/resellers/[id]
 * Update reseller profile, approve/suspend/ban.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const body = await req.json();

    // Handle special actions
    const action = body.action as string | undefined;

    if (action === "suspend") {
      const reseller = await prisma.reseller.update({
        where: { id },
        data: { isActive: false },
      });

      // Also deactivate user account
      await prisma.user.update({
        where: { id: reseller.userId },
        data: { isActive: false },
      });

      await logAdminAction(admin.userId, "reseller.suspended", "Reseller", id, { reason: body.reason }, getClientIp(req));

      return apiSuccess({ id, status: "suspended", message: "Reseller suspended successfully" });
    }

    if (action === "activate") {
      const reseller = await prisma.reseller.update({
        where: { id },
        data: { isActive: true },
      });

      await prisma.user.update({
        where: { id: reseller.userId },
        data: { isActive: true },
      });

      await logAdminAction(admin.userId, "reseller.activated", "Reseller", id, {}, getClientIp(req));

      return apiSuccess({ id, status: "active", message: "Reseller activated successfully" });
    }

    const { user: userPatch, action: _ignored, ...resellerBody } = body as Record<string, unknown> & {
      user?: unknown;
      action?: string;
    };

    const reseller = await prisma.reseller.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!reseller) return apiError("Reseller not found", 404, "NOT_FOUND");

    if (userPatch !== undefined && userPatch !== null) {
      const u = adminUpdateResellerUserSchema.parse(userPatch);
      if (Object.keys(u).length > 0) {
        if (u.email) {
          const email = u.email.toLowerCase().trim();
          const taken = await prisma.user.findFirst({
            where: { email, NOT: { id: reseller.userId } },
          });
          if (taken) return apiError("Email already in use", 409, "EMAIL_EXISTS");
          await prisma.user.update({
            where: { id: reseller.userId },
            data: {
              ...(u.name !== undefined ? { name: u.name } : {}),
              ...(u.phone !== undefined ? { phone: u.phone } : {}),
              email,
            },
          });
        } else {
          await prisma.user.update({
            where: { id: reseller.userId },
            data: u,
          });
        }
        await logAdminAction(admin.userId, "reseller.user_updated", "User", reseller.userId, u, getClientIp(req));
      }
    }

    const resellerKeys = Object.keys(resellerBody).filter((k) => resellerBody[k as keyof typeof resellerBody] !== undefined);
    if (resellerKeys.length > 0) {
      const validated = updateResellerSchema.parse(resellerBody);
      await prisma.reseller.update({
        where: { id },
        data: validated,
      });
      await logAdminAction(admin.userId, "reseller.updated", "Reseller", id, validated, getClientIp(req));
    }

    const updated = await prisma.reseller.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true } },
      },
    });

    return apiSuccess(updated);
  } catch (error: any) {
    if (error.code === "P2025") return apiError("Reseller not found", 404, "NOT_FOUND");
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "), 422, "VALIDATION_ERROR");
    }
    console.error("[Admin Reseller PATCH] Error:", error);
    return apiError("Failed to update reseller", 500);
  }
}

/**
 * DELETE /api/v1/admin/resellers/[id]
 * Permanently delete a reseller and all associated data.
 * This is destructive — use with extreme caution.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const reseller = await prisma.reseller.findUnique({
      where: { id },
      select: { userId: true, companyName: true },
    });

    if (!reseller) return apiError("Reseller not found", 404, "NOT_FOUND");

    // Delete reseller (cascade will remove sites, devices, packages, etc.)
    await prisma.reseller.delete({ where: { id } });

    // Delete the associated user account
    await prisma.user.delete({ where: { id: reseller.userId } });

    await logAdminAction(
      admin.userId,
      "reseller.deleted",
      "Reseller",
      id,
      { companyName: reseller.companyName },
      getClientIp(req)
    );

    return apiSuccess({ id, message: "Reseller and all associated data deleted permanently" });
  } catch (error) {
    console.error("[Admin Reseller DELETE] Error:", error);
    return apiError("Failed to delete reseller", 500);
  }
}

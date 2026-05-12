import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { updatePackageSchema } from "@/lib/validations/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/subscriptions/[id]
 * Get package details with subscription stats.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const pkg = await prisma.package.findUnique({
      where: { id },
      include: {
        reseller: { select: { id: true, companyName: true, brandSlug: true } },
        subscriptions: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { name: true, phone: true, email: true } },
          },
        },
        _count: { select: { subscriptions: true } },
      },
    });

    if (!pkg) return apiError("Package not found", 404, "NOT_FOUND");

    // Revenue from this package
    const revenue = await prisma.payment.aggregate({
      where: { subscription: { packageId: id }, status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    });

    return apiSuccess({
      ...pkg,
      revenue: {
        totalAmount: revenue._sum.amount || 0,
        transactionCount: revenue._count,
      },
    });
  } catch (error) {
    console.error("[Admin Package GET] Error:", error);
    return apiError("Failed to fetch package", 500);
  }
}

/**
 * PATCH /api/v1/admin/subscriptions/[id]
 * Update a WiFi package or toggle active/inactive.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const body = await req.json();

    // Toggle active/inactive
    if (body.action === "toggle") {
      const pkg = await prisma.package.findUnique({ where: { id } });
      if (!pkg) return apiError("Package not found", 404, "NOT_FOUND");

      const updated = await prisma.package.update({
        where: { id },
        data: { isActive: !pkg.isActive },
      });

      await logAdminAction(admin.userId, `package.${updated.isActive ? "activated" : "deactivated"}`, "Package", id, {}, getClientIp(req));
      return apiSuccess(updated);
    }

    const validated = updatePackageSchema.parse(body);
    const updated = await prisma.package.update({
      where: { id },
      data: validated,
    });

    await logAdminAction(admin.userId, "package.updated", "Package", id, validated, getClientIp(req));
    return apiSuccess(updated);
  } catch (error: any) {
    if (error.code === "P2025") return apiError("Package not found", 404, "NOT_FOUND");
    if (error.name === "ZodError") {
      return apiError("Validation failed", 422, "VALIDATION_ERROR");
    }
    console.error("[Admin Package PATCH] Error:", error);
    return apiError("Failed to update package", 500);
  }
}

/**
 * DELETE /api/v1/admin/subscriptions/[id]
 * Delete a package. Fails if there are active subscriptions.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    // Check for active subscriptions
    const activeCount = await prisma.subscription.count({
      where: { packageId: id, status: "ACTIVE" },
    });

    if (activeCount > 0) {
      return apiError(
        `Cannot delete package: ${activeCount} active subscriptions. Deactivate it instead.`,
        409,
        "ACTIVE_SUBSCRIPTIONS"
      );
    }

    const pkg = await prisma.package.delete({ where: { id } });

    await logAdminAction(admin.userId, "package.deleted", "Package", id, { name: pkg.name }, getClientIp(req));
    return apiSuccess({ id, message: "Package deleted" });
  } catch (error: any) {
    if (error.code === "P2025") return apiError("Package not found", 404, "NOT_FOUND");
    console.error("[Admin Package DELETE] Error:", error);
    return apiError("Failed to delete package", 500);
  }
}

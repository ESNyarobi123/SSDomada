import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { updatePackageSchema } from "@/lib/validations/reseller";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/reseller/packages/[id]
 * Package detail with recent subscriptions and revenue.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const pkg = await prisma.package.findFirst({
      where: { id, resellerId: ctx.resellerId },
      include: {
        subscriptions: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true, phone: true, email: true } } },
        },
        _count: { select: { subscriptions: true } },
      },
    });

    if (!pkg) return apiError("Package not found", 404, "NOT_FOUND");

    const revenue = await prisma.payment.aggregate({
      where: { subscription: { packageId: id }, resellerId: ctx.resellerId, status: "COMPLETED" as any },
      _sum: { amount: true, resellerAmount: true },
      _count: true,
    });

    return apiSuccess({
      ...pkg,
      revenue: {
        totalAmount: revenue._sum?.amount || 0,
        resellerEarnings: revenue._sum?.resellerAmount || 0,
        totalSold: revenue._count,
      },
    });
  } catch (error) {
    console.error("[Reseller Package GET] Error:", error);
    return apiError("Failed to fetch package", 500);
  }
}

/**
 * PATCH /api/v1/reseller/packages/[id]
 * Update package details or toggle active/featured.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const pkg = await prisma.package.findFirst({ where: { id, resellerId: ctx.resellerId } });
    if (!pkg) return apiError("Package not found", 404, "NOT_FOUND");

    const body = await req.json();

    if (body.action === "toggle") {
      const updated = await prisma.package.update({
        where: { id },
        data: { isActive: !pkg.isActive },
      });
      await logResellerAction(ctx.userId, `package.${updated.isActive ? "activated" : "deactivated"}`, "Package", id, {}, getClientIp(req));
      return apiSuccess(updated);
    }

    if (body.action === "feature") {
      const updated = await prisma.package.update({
        where: { id },
        data: { isFeatured: !(pkg as any).isFeatured },
      });
      await logResellerAction(ctx.userId, "package.featured_toggled", "Package", id, {}, getClientIp(req));
      return apiSuccess(updated);
    }

    const validated = updatePackageSchema.parse(body);
    const updated = await prisma.package.update({
      where: { id },
      data: validated as any,
    });

    await logResellerAction(ctx.userId, "package.updated", "Package", id, { name: validated.name }, getClientIp(req));
    return apiSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") return apiError("Validation failed", 422);
    console.error("[Reseller Package PATCH] Error:", error);
    return apiError("Failed to update package", 500);
  }
}

/**
 * DELETE /api/v1/reseller/packages/[id]
 * Delete package. Fails if active subscriptions exist.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const pkg = await prisma.package.findFirst({ where: { id, resellerId: ctx.resellerId } });
    if (!pkg) return apiError("Package not found", 404, "NOT_FOUND");

    const activeSubs = await prisma.subscription.count({
      where: { packageId: id, status: "ACTIVE" },
    });

    if (activeSubs > 0) {
      return apiError(`Cannot delete: ${activeSubs} active subscriptions. Deactivate the package instead.`, 409, "ACTIVE_SUBSCRIPTIONS");
    }

    await prisma.package.delete({ where: { id } });
    await logResellerAction(ctx.userId, "package.deleted", "Package", id, { name: pkg.name }, getClientIp(req));

    return apiSuccess({ id, message: "Package deleted" });
  } catch (error) {
    console.error("[Reseller Package DELETE] Error:", error);
    return apiError("Failed to delete package", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { updateResellerPlanSchema } from "@/lib/validations/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/platform-plans/[id]
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const plan = await prisma.resellerPlan.findUnique({
      where: { id },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });
    if (!plan) return apiError("Plan not found", 404, "NOT_FOUND");
    return apiSuccess(plan);
  } catch (error) {
    console.error("[Admin platform-plan GET] Error:", error);
    return apiError("Failed to load plan", 500);
  }
}

/**
 * PATCH /api/v1/admin/platform-plans/[id]
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const body = await req.json();
    const validated = updateResellerPlanSchema.parse(body);

    if (validated.slug !== undefined || validated.name !== undefined) {
      const orClause: Array<{ slug: string } | { name: { equals: string; mode: "insensitive" } }> = [];
      if (validated.slug !== undefined) orClause.push({ slug: validated.slug });
      if (validated.name !== undefined) {
        orClause.push({ name: { equals: validated.name, mode: "insensitive" } });
      }
      if (orClause.length > 0) {
        const existing = await prisma.resellerPlan.findFirst({
          where: {
            id: { not: id },
            OR: orClause,
          },
        });
        if (existing) {
          return apiError("Another plan already uses this name or slug", 409, "DUPLICATE");
        }
      }
    }

    const updated = await prisma.resellerPlan.update({
      where: { id },
      data: Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined)),
    });

    await logAdminAction(admin.userId, "platform_plan.updated", "ResellerPlan", id, validated, getClientIp(req));

    return apiSuccess(updated);
  } catch (error: any) {
    if (error.code === "P2025") return apiError("Plan not found", 404, "NOT_FOUND");
    if (error.name === "ZodError") {
      return apiError("Validation failed", 422, "VALIDATION_ERROR");
    }
    if (error.code === "P2002") {
      return apiError("Unique constraint violation", 409, "DUPLICATE");
    }
    console.error("[Admin platform-plan PATCH] Error:", error);
    return apiError("Failed to update plan", 500);
  }
}

/**
 * DELETE /api/v1/admin/platform-plans/[id]
 * Blocked if any reseller subscription references this plan.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const subCount = await prisma.resellerPlanSubscription.count({ where: { planId: id } });
    if (subCount > 0) {
      return apiError(
        `Cannot delete: ${subCount} reseller(s) are on this plan. Reassign them in reseller → Platform plan first.`,
        409,
        "PLAN_IN_USE"
      );
    }

    const plan = await prisma.resellerPlan.delete({ where: { id } });

    await logAdminAction(admin.userId, "platform_plan.deleted", "ResellerPlan", id, { slug: plan.slug }, getClientIp(req));

    return apiSuccess({ id, message: "Plan deleted" });
  } catch (error: any) {
    if (error.code === "P2025") return apiError("Plan not found", 404, "NOT_FOUND");
    console.error("[Admin platform-plan DELETE] Error:", error);
    return apiError("Failed to delete plan", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { adminUpdateResellerPlatformPlanSchema } from "@/lib/validations/admin";
import { computeInitialSubscriptionState } from "@/server/services/reseller-plan-access.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/resellers/[id]/platform-plan
 * Adjust SSDomada platform billing (ResellerPlanSubscription) for a reseller.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id: resellerId } = await params;

  try {
    const body = await req.json();
    const validated = adminUpdateResellerPlatformPlanSchema.parse(body);

    const reseller = await prisma.reseller.findUnique({
      where: { id: resellerId },
      select: { id: true },
    });
    if (!reseller) return apiError("Reseller not found", 404, "RESELLER_NOT_FOUND");

    const existing = await (prisma as any).resellerPlanSubscription.findUnique({
      where: { resellerId },
    });

    let plan: any = null;
    if (validated.planId) {
      plan = await (prisma as any).resellerPlan.findUnique({ where: { id: validated.planId } });
      if (!plan) return apiError("Plan not found", 404, "PLAN_NOT_FOUND");
    }

    if (!existing && !plan) {
      return apiError("planId is required when creating a platform subscription", 422, "PLAN_REQUIRED");
    }

    const data: Record<string, unknown> = {};
    if (validated.planId) data.planId = validated.planId;
    if (validated.status) data.status = validated.status;
    if (validated.currentPeriodEnd) data.currentPeriodEnd = new Date(validated.currentPeriodEnd);

    const updated = existing
      ? await (prisma as any).resellerPlanSubscription.update({
          where: { resellerId },
          data,
          include: { plan: true },
        })
      : await (prisma as any).resellerPlanSubscription.create({
          data: {
            resellerId,
            planId: plan.id,
            ...computeInitialSubscriptionState(plan, validated.status),
            ...(validated.currentPeriodEnd ? { currentPeriodEnd: new Date(validated.currentPeriodEnd) } : {}),
          },
          include: { plan: true },
        });

    await logAdminAction(admin.userId, "reseller.platform_plan_updated", "ResellerPlanSubscription", updated.id, validated, getClientIp(req));

    return apiSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed", 422, "VALIDATION_ERROR");
    }
    console.error("[Admin platform-plan PATCH] Error:", error);
    return apiError("Failed to update platform plan", 500);
  }
}

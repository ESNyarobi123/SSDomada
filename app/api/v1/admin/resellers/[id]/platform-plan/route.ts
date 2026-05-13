import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { adminUpdateResellerPlatformPlanSchema } from "@/lib/validations/admin";

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

    const existing = await (prisma as any).resellerPlanSubscription.findUnique({
      where: { resellerId },
    });
    if (!existing) {
      return apiError("No platform plan subscription for this reseller", 404, "NO_SUBSCRIPTION");
    }

    if (validated.planId) {
      const plan = await (prisma as any).resellerPlan.findUnique({ where: { id: validated.planId } });
      if (!plan) return apiError("Plan not found", 404, "PLAN_NOT_FOUND");
    }

    const data: Record<string, unknown> = {};
    if (validated.planId) data.planId = validated.planId;
    if (validated.status) data.status = validated.status;
    if (validated.currentPeriodEnd) data.currentPeriodEnd = new Date(validated.currentPeriodEnd);

    const updated = await (prisma as any).resellerPlanSubscription.update({
      where: { resellerId },
      data,
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

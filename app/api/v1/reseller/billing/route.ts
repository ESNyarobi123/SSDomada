import { NextRequest } from "next/server";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { ResellerPlanService } from "@/server/services/reseller-plan.service";
import { getPortalPublicBaseUrl } from "@/server/lib/public-app-base-url";

/**
 * GET /api/v1/reseller/billing
 * Returns current subscription + usage vs plan limits.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const data = await ResellerPlanService.getBillingAccess(ctx.resellerId);
    return apiSuccess(data);
  } catch (err) {
    console.error("[Reseller Billing GET] Error:", err);
    return apiError("Failed to load billing", 500);
  }
}

/**
 * POST /api/v1/reseller/billing
 * Body: { action: "subscribe", planId, phone? }
 *     | { action: "cancel" }
 *
 * Returns a Snippe checkout URL when payment is required, or activates a free plan immediately.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "cancel") {
      const sub = await ResellerPlanService.cancel(ctx.resellerId);
      await logResellerAction(ctx.userId, "billing.cancelled", "ResellerPlanSubscription", sub.id, {}, getClientIp(req));
      return apiSuccess(sub);
    }

    if (action === "subscribe") {
      if (!body.planId) return apiError("planId is required", 400, "VALIDATION");

      const baseUrl = getPortalPublicBaseUrl();
      const result = await ResellerPlanService.subscribe({
        resellerId: ctx.resellerId,
        planId: body.planId,
        customerPhone: body.phone,
        callbackUrl: `${baseUrl}/reseller/plan?billing=success`,
        webhookUrl: `${baseUrl}/api/webhooks/snippe`,
      });

      await logResellerAction(
        ctx.userId,
        "billing.subscribe",
        "ResellerPlanSubscription",
        result.subscription.id,
        { planId: body.planId, requiresPayment: result.requiresPayment },
        getClientIp(req),
      );

      return apiSuccess(result);
    }

    return apiError("Unknown action", 400, "BAD_REQUEST");
  } catch (err: any) {
    console.error("[Reseller Billing POST] Error:", err);
    return apiError(err.message || "Billing operation failed", 500);
  }
}

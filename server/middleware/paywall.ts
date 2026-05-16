import { NextResponse } from "next/server";
import {
  checkActiveResellerPlan,
  checkCapacity,
  checkFeatureAccess,
  isResellerPlanPaywallEnforced,
  type CapacityKey,
  type PlanFeatureKey,
  type PlanAccessDenied,
} from "@/server/services/reseller-plan-access.service";

/**
 * When `false`, reseller routes skip `ensureActiveResellerPlan` and `ensureCapacity`.
 * Missing row defaults to enforced (`true`) so production stays protected.
 */
export { isResellerPlanPaywallEnforced };

/**
 * Paywall checks for reseller-scoped API routes.
 *
 * Usage inside a route after verifyReseller:
 *
 *   const gate = await ensureActiveResellerPlan(ctx.resellerId);
 *   if (gate) return gate; // 402 response
 *
 *   const cap = await ensureCapacity(ctx.resellerId, "sites");
 *   if (cap) return cap;
 */

function paymentRequired(denied: PlanAccessDenied) {
  return NextResponse.json(
    {
      success: false,
      error: denied.message,
      code: denied.code,
      ...(denied.hint ? { hint: denied.hint } : {}),
    },
    { status: 402 },
  );
}

/**
 * Returns null if the reseller has an ACTIVE or TRIAL subscription that hasn't expired,
 * otherwise returns a 402 JSON response.
 */
export async function ensureActiveResellerPlan(resellerId: string) {
  const result = await checkActiveResellerPlan(resellerId);
  return result.ok ? null : paymentRequired(result);
}

/**
 * Enforce a capacity limit (e.g. when adding a new site/device).
 * Returns 402 if the reseller is at their plan's cap, else null.
 */
export async function ensureCapacity(resellerId: string, key: CapacityKey) {
  const result = await checkCapacity(resellerId, key);
  return result.ok ? null : paymentRequired(result);
}

export async function ensureFeatureAccess(resellerId: string, feature: PlanFeatureKey) {
  const result = await checkFeatureAccess(resellerId, feature);
  return result.ok ? null : paymentRequired(result);
}

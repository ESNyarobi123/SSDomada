import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { RESELLER_PLAN_PAYWALL_SETTING_KEY } from "@/lib/platform-settings";

/**
 * When `false`, reseller routes skip `ensureActiveResellerPlan` and `ensureCapacity`.
 * Missing row defaults to enforced (`true`) so production stays protected.
 */
export async function isResellerPlanPaywallEnforced(): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: RESELLER_PLAN_PAYWALL_SETTING_KEY },
  });
  if (!row) return true;
  const v = String(row.value).trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return true;
}

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

export type CapacityKey = "sites" | "devices" | "activeClients";

function paymentRequired(message: string, hint?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: "PAYMENT_REQUIRED",
      ...(hint ? { hint } : {}),
    },
    { status: 402 },
  );
}

/**
 * Returns null if the reseller has an ACTIVE or TRIAL subscription that hasn't expired,
 * otherwise returns a 402 JSON response.
 */
export async function ensureActiveResellerPlan(resellerId: string) {
  if (!(await isResellerPlanPaywallEnforced())) return null;

  const sub = await (prisma as any).resellerPlanSubscription.findUnique({
    where: { resellerId },
    include: { plan: true },
  });

  if (!sub) {
    return paymentRequired("No active subscription. Please subscribe to a plan.", {
      action: "subscribe",
      pricingUrl: "/pricing",
    });
  }

  const okStatuses = new Set(["ACTIVE", "TRIAL"]);
  if (!okStatuses.has(sub.status)) {
    return paymentRequired("Your subscription is not active.", {
      status: sub.status,
      pricingUrl: "/pricing",
    });
  }

  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
    return paymentRequired("Your subscription has expired.", {
      status: "EXPIRED",
      pricingUrl: "/pricing",
    });
  }

  return null;
}

/**
 * Enforce a capacity limit (e.g. when adding a new site/device).
 * Returns 402 if the reseller is at their plan's cap, else null.
 */
export async function ensureCapacity(resellerId: string, key: CapacityKey) {
  if (!(await isResellerPlanPaywallEnforced())) return null;

  const sub = await (prisma as any).resellerPlanSubscription.findUnique({
    where: { resellerId },
    include: { plan: true },
  });

  if (!sub?.plan) return null; // no plan info → don't block (will be caught by ensureActiveResellerPlan)

  const plan = sub.plan;
  let used = 0;
  let limit: number | null = null;
  let label: string = key;

  if (key === "sites") {
    used = await prisma.site.count({ where: { resellerId } });
    limit = plan.maxSites;
    label = "sites";
  } else if (key === "devices") {
    used = await prisma.device.count({ where: { resellerId } });
    limit = plan.maxDevices;
    label = "devices";
  } else if (key === "activeClients") {
    used = await prisma.radiusUser.count({
      where: { resellerId, isActive: true, expiresAt: { gt: new Date() } },
    });
    limit = plan.maxActiveClients;
    label = "active clients";
  }

  if (limit != null && used >= limit) {
    return paymentRequired(
      `You've reached the ${label} limit (${limit}) on your ${plan.name} plan. Upgrade to add more.`,
      { resource: key, used, limit, plan: plan.slug, pricingUrl: "/pricing" },
    );
  }

  return null;
}

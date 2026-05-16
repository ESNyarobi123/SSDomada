import { prisma } from "@/server/lib/prisma";
import { RESELLER_PLAN_PAYWALL_SETTING_KEY } from "@/lib/platform-settings";

export type CapacityKey = "sites" | "devices" | "activeClients";
export type PlanFeatureKey =
  | "customBranding"
  | "customDomain"
  | "smsNotifications"
  | "prioritySupport"
  | "apiAccess";

export const PLAN_FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  customBranding: "custom branding",
  customDomain: "custom domain support",
  smsNotifications: "SMS notifications",
  prioritySupport: "priority support",
  apiAccess: "API access",
};

export type PlanAccessDenied = {
  ok: false;
  statusCode: 402;
  code: string;
  message: string;
  hint?: Record<string, unknown>;
};

export type ActivePlanAccess = {
  ok: true;
  enforced: boolean;
  subscription: any | null;
  plan: any | null;
};

export type PlanAccessResult = ActivePlanAccess | PlanAccessDenied;

function paymentRequired(message: string, code: string, hint?: Record<string, unknown>): PlanAccessDenied {
  return {
    ok: false,
    statusCode: 402,
    code,
    message,
    ...(hint ? { hint } : {}),
  };
}

export async function isResellerPlanPaywallEnforced(): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: RESELLER_PLAN_PAYWALL_SETTING_KEY },
  });
  if (!row) return true;
  const v = String(row.value).trim().toLowerCase();
  return !(v === "false" || v === "0" || v === "no" || v === "off");
}

export async function checkActiveResellerPlan(resellerId: string): Promise<PlanAccessResult> {
  const enforced = await isResellerPlanPaywallEnforced();
  if (!enforced) {
    return { ok: true, enforced: false, subscription: null, plan: null };
  }

  const subscription = await (prisma as any).resellerPlanSubscription.findUnique({
    where: { resellerId },
    include: { plan: true },
  });

  if (!subscription?.plan) {
    return paymentRequired("No active subscription. Please subscribe to a plan.", "NO_ACTIVE_PLAN", {
      action: "subscribe",
      pricingUrl: "/pricing",
    });
  }

  const okStatuses = new Set(["ACTIVE", "TRIAL"]);
  if (!okStatuses.has(subscription.status)) {
    return paymentRequired("Your subscription is not active.", "PLAN_NOT_ACTIVE", {
      status: subscription.status,
      pricingUrl: "/pricing",
    });
  }

  if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < new Date()) {
    return paymentRequired("Your subscription has expired.", "PLAN_EXPIRED", {
      status: "EXPIRED",
      pricingUrl: "/pricing",
    });
  }

  return {
    ok: true,
    enforced: true,
    subscription,
    plan: subscription.plan,
  };
}

export async function checkCapacity(resellerId: string, key: CapacityKey): Promise<PlanAccessResult & { used?: number; limit?: number | null }> {
  const active = await checkActiveResellerPlan(resellerId);
  if (!active.ok) return active;
  if (!active.enforced || !active.plan) return { ...active, used: 0, limit: null };

  const plan = active.plan;
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
  } else {
    used = await prisma.radiusUser.count({
      where: { resellerId, isActive: true, expiresAt: { gt: new Date() } },
    });
    limit = plan.maxActiveClients;
    label = "active clients";
  }

  if (limit != null && used >= limit) {
    return paymentRequired(
      `You've reached the ${label} limit (${limit}) on your ${plan.name} plan. Upgrade to add more.`,
      "PLAN_LIMIT_REACHED",
      { resource: key, used, limit, plan: plan.slug, pricingUrl: "/pricing" },
    );
  }

  return { ...active, used, limit };
}

export async function checkFeatureAccess(resellerId: string, feature: PlanFeatureKey): Promise<PlanAccessResult> {
  const active = await checkActiveResellerPlan(resellerId);
  if (!active.ok) return active;
  if (!active.enforced || !active.plan) return active;

  if (!active.plan[feature]) {
    const label = PLAN_FEATURE_LABELS[feature];
    return paymentRequired(
      `Your ${active.plan.name} plan does not include ${label}. Upgrade to use this feature.`,
      "FEATURE_NOT_INCLUDED",
      { feature, plan: active.plan.slug, pricingUrl: "/pricing" },
    );
  }

  return active;
}

export function planFeaturesFromPlan(plan: any | null | undefined, enforced = true): Record<PlanFeatureKey, boolean> {
  const bypass = !enforced;
  return {
    customBranding: bypass || Boolean(plan?.customBranding),
    customDomain: bypass || Boolean(plan?.customDomain),
    smsNotifications: bypass || Boolean(plan?.smsNotifications),
    prioritySupport: bypass || Boolean(plan?.prioritySupport),
    apiAccess: bypass || Boolean(plan?.apiAccess),
  };
}

export async function getPlanAccessSnapshot(resellerId: string) {
  const active = await checkActiveResellerPlan(resellerId);
  if (!active.ok) {
    return {
      access: active,
      enforced: true,
      subscription: null,
      plan: null,
      features: planFeaturesFromPlan(null, true),
    };
  }

  return {
    access: active,
    enforced: active.enforced,
    subscription: active.subscription,
    plan: active.plan,
    features: planFeaturesFromPlan(active.plan, active.enforced),
  };
}

export function computePlanPeriodEnd(plan: { interval: string }, now = new Date()) {
  const end = new Date(now);
  if (plan.interval === "MONTHLY") end.setMonth(end.getMonth() + 1);
  else if (plan.interval === "YEARLY") end.setFullYear(end.getFullYear() + 1);
  else if (plan.interval === "LIFETIME") end.setFullYear(end.getFullYear() + 100);
  return end;
}

export function planDaysRemaining(endsAt: Date | string | null | undefined, now = new Date()): number | null {
  if (!endsAt) return null;
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export function formatPlanPeriodLabel(subscription: {
  status?: string;
  currentPeriodEnd?: Date | string | null;
  trialEndsAt?: Date | string | null;
} | null): string {
  if (!subscription?.currentPeriodEnd) return "No active plan";
  const days = planDaysRemaining(subscription.currentPeriodEnd);
  if (days == null) return "—";
  if (subscription.status === "TRIAL" && subscription.trialEndsAt) {
    const trialDays = planDaysRemaining(subscription.trialEndsAt);
    if (trialDays != null && trialDays <= days) {
      return trialDays === 0 ? "Trial ends today" : `Trial: ${trialDays} day${trialDays === 1 ? "" : "s"} left`;
    }
  }
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export function computeInitialSubscriptionState(
  plan: { interval: string; trialDays?: number | null },
  status?: string,
  now = new Date(),
) {
  const trialEndsAt =
    plan.trialDays && plan.trialDays > 0
      ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
      : null;
  return {
    status: status ?? (trialEndsAt ? "TRIAL" : "ACTIVE"),
    startedAt: now,
    currentPeriodEnd: trialEndsAt ?? computePlanPeriodEnd(plan, now),
    trialEndsAt,
  };
}

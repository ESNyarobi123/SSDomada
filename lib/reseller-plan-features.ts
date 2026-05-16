export type PlanFeatureKey =
  | "customBranding"
  | "customDomain"
  | "smsNotifications"
  | "prioritySupport"
  | "apiAccess";

export const PLAN_FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  customBranding: "Custom branding",
  customDomain: "Custom domain",
  smsNotifications: "SMS notifications",
  prioritySupport: "Priority support",
  apiAccess: "API access",
};

export type PublicResellerPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  trialDays: number;
  maxSites: number | null;
  maxDevices: number | null;
  maxActiveClients: number | null;
  customBranding: boolean;
  customDomain: boolean;
  smsNotifications: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  isFeatured?: boolean;
};

export function formatPlatformPlanPrice(n: number) {
  if (n <= 0) return "Free";
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(n);
}

export function platformPlanFeatureRows(p: PublicResellerPlan) {
  return [
    { label: p.maxSites == null ? "Unlimited sites" : `${p.maxSites} site${p.maxSites === 1 ? "" : "s"}`, ok: true },
    { label: p.maxDevices == null ? "Unlimited APs" : `${p.maxDevices} access points`, ok: true },
    {
      label: p.maxActiveClients == null ? "Unlimited active clients" : `${p.maxActiveClients} active clients`,
      ok: true,
    },
    { label: PLAN_FEATURE_LABELS.customBranding, ok: p.customBranding },
    { label: PLAN_FEATURE_LABELS.smsNotifications, ok: p.smsNotifications },
    { label: PLAN_FEATURE_LABELS.customDomain, ok: p.customDomain },
    { label: PLAN_FEATURE_LABELS.prioritySupport, ok: p.prioritySupport },
    { label: PLAN_FEATURE_LABELS.apiAccess, ok: p.apiAccess },
  ];
}

export function enabledFeatureLabels(features: Record<PlanFeatureKey, boolean> | null | undefined): string[] {
  if (!features) return [];
  return (Object.entries(features) as [PlanFeatureKey, boolean][])
    .filter(([, on]) => on)
    .map(([k]) => PLAN_FEATURE_LABELS[k]);
}

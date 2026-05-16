"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Crown, Loader2, Sparkles, ArrowLeft, CreditCard, AlertTriangle } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import {
  formatPlatformPlanPrice,
  platformPlanFeatureRows,
  type PublicResellerPlan,
} from "@/lib/reseller-plan-features";
import type { ResellerBillingSidebar } from "@/components/reseller/ResellerPlanSidebar";

type BillingPayload = ResellerBillingSidebar & {
  subscription: {
    status: string;
    cancelAtPeriodEnd: boolean;
    plan: { id: string; slug: string; name: string };
  } | null;
};

function PlanPickerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const manage = searchParams.get("manage") === "1";
  const expired = searchParams.get("expired") === "1";
  const billingSuccess = searchParams.get("billing") === "success";
  const requestedSlug = searchParams.get("plan")?.trim().toLowerCase() || "";

  const [plans, setPlans] = useState<PublicResellerPlan[]>([]);
  const [billing, setBilling] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [plansRes, billRes] = await Promise.all([
      fetch("/api/v1/plans").then((r) => r.json()),
      resellerJson<BillingPayload>("/api/v1/reseller/billing"),
    ]);
    if (plansRes.success && Array.isArray(plansRes.data)) setPlans(plansRes.data);
    if (billRes.ok && billRes.data) setBilling(billRes.data);
    else if (!billRes.ok) setErr(billRes.error || "Could not load your subscription");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !billing) return;
    if (billing.access.ok && !manage && !billingSuccess) {
      router.replace("/reseller/dashboard");
    }
  }, [loading, billing, manage, billingSuccess, router]);

  useEffect(() => {
    if (billingSuccess && billing?.access.ok) {
      setOk("Payment received. Your plan is active — welcome to your dashboard.");
    }
  }, [billingSuccess, billing?.access.ok]);

  async function choosePlan(planId: string) {
    setBusyPlanId(planId);
    setErr(null);
    setOk(null);
    const res = await fetch("/api/v1/reseller/billing", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({ action: "subscribe", planId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyPlanId(null);
    if (!res.ok || json.success === false) {
      setErr(json.error || "Could not activate this plan");
      return;
    }
    if (json.data?.checkoutUrl) {
      window.location.href = json.data.checkoutUrl;
      return;
    }
    await load();
    router.replace("/reseller/dashboard");
    router.refresh();
  }

  async function cancelAtPeriodEnd() {
    if (!confirm("Cancel your SSDomada plan at the end of this billing period?")) return;
    setBusyPlanId("cancel");
    const res = await fetch("/api/v1/reseller/billing", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({ action: "cancel" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyPlanId(null);
    if (!res.ok) setErr(json.error || "Cancel failed");
    else {
      setOk("Cancellation scheduled. Your plan stays active until the period ends.");
      await load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-24 text-onyx-400 justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        Loading plans…
      </div>
    );
  }

  const currentId = billing?.subscription?.plan?.id;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {manage && billing?.access.ok && (
        <Link
          href="/reseller/dashboard"
          className="inline-flex items-center gap-2 text-sm text-onyx-400 hover:text-gold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
      )}

      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          SSDomada platform
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          {manage ? "Your SSDomada plan" : "Choose your plan to get started"}
        </h1>
        <p className="text-onyx-400 mt-2 text-sm md:text-base">
          {manage
            ? "Upgrade, renew, or switch plans. Your WiFi portal and dashboard follow this subscription."
            : "Pick a free trial or paid plan. Until you activate one, your dashboard and customer portal stay paused."}
        </p>
      </div>

      {(expired || (!billing?.access.ok && billing?.access.code === "PLAN_EXPIRED")) && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-300" />
          <div>
            <p className="font-bold text-white">Your plan has expired</p>
            <p className="mt-1 text-red-100/90">
              Your captive portal and paid features are paused. Renew or start a new plan below to go live again.
            </p>
          </div>
        </div>
      )}

      {billing?.subscription?.status === "PAST_DUE" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Payment pending — complete checkout for <strong className="text-white">{billing.subscription.plan.name}</strong> or
          choose another plan.
        </div>
      )}

      {ok && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{ok}</div>
      )}
      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {billing?.period && billing.access.ok && (
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/30 to-transparent p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Current plan</div>
            <div className="text-xl font-black text-white">{billing.period.planName}</div>
            <div className="text-sm text-onyx-400 mt-0.5">{billing.period.label}</div>
          </div>
          {billing.subscription?.cancelAtPeriodEnd ? (
            <p className="text-xs text-amber-200">Cancellation scheduled at period end.</p>
          ) : manage ? (
            <button
              type="button"
              onClick={() => void cancelAtPeriodEnd()}
              disabled={busyPlanId === "cancel"}
              className="text-xs font-semibold text-red-300 hover:underline disabled:opacity-50"
            >
              Cancel at period end
            </button>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const isCurrent = currentId === p.id;
          const preselect = requestedSlug && p.slug === requestedSlug;
          return (
            <div
              key={p.id}
              className={`relative rounded-3xl p-7 border-2 transition-all ${
                p.isFeatured
                  ? "border-gold bg-gradient-to-br from-gold/10 via-onyx-900 to-onyx-900 shadow-xl shadow-gold/10"
                  : preselect
                    ? "border-gold-30 bg-onyx-900/80"
                    : "border-white/[0.08] bg-onyx-900/60 hover:border-gold-30"
              }`}
            >
              {p.isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-onyx-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Most popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                  Current
                </div>
              )}
              <h2 className="text-2xl font-black text-white mb-1">{p.name}</h2>
              {p.description && <p className="text-sm text-onyx-400 mb-5">{p.description}</p>}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-gold">{formatPlatformPlanPrice(p.price)}</span>
                  {p.price > 0 && <span className="text-sm text-onyx-400">/ {p.interval.toLowerCase()}</span>}
                </div>
                {p.trialDays > 0 && (
                  <div className="text-xs text-emerald-400 mt-1 font-bold">{p.trialDays}-day free trial</div>
                )}
              </div>
              <ul className="space-y-2.5 mb-7">
                {platformPlanFeatureRows(p).map((f, idx) => (
                  <li
                    key={idx}
                    className={`flex items-center gap-2 text-sm ${f.ok ? "text-onyx-200" : "text-onyx-600 line-through"}`}
                  >
                    <Check className={`w-4 h-4 shrink-0 ${f.ok ? "text-emerald-400" : "text-onyx-700"}`} />
                    {f.label}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busyPlanId !== null || isCurrent}
                onClick={() => void choosePlan(p.id)}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-black text-sm transition-all disabled:opacity-50 ${
                  p.isFeatured
                    ? "bg-gold text-onyx-950 shadow-lg shadow-gold/30 hover:bg-gold-400"
                    : "bg-white/[0.04] text-white border border-white/[0.08] hover:bg-white/[0.08]"
                }`}
              >
                {busyPlanId === p.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {isCurrent
                  ? "Current plan"
                  : p.price <= 0
                    ? "Start free"
                    : p.trialDays > 0
                      ? "Start trial"
                      : "Subscribe & pay"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResellerPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </div>
      }
    >
      <PlanPickerContent />
    </Suspense>
  );
}

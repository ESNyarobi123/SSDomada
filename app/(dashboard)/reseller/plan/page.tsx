"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Crown,
  Loader2,
  Sparkles,
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
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
  wallet?: { balance: number; currency: string };
  defaultPhone?: string | null;
};

type PlanPaymentMethod = "MOBILE" | "CARD" | "WALLET";

function formatTzs(amount: number) {
  return `${amount.toLocaleString()} TZS`;
}

function needsPaidCheckout(plan: PublicResellerPlan) {
  return plan.price > 0 && plan.trialDays <= 0;
}

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
  const [checkoutPlan, setCheckoutPlan] = useState<PublicResellerPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PlanPaymentMethod>("MOBILE");
  const [phone, setPhone] = useState("");
  const [mobileWaiting, setMobileWaiting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [plansRes, billRes] = await Promise.all([
      fetch("/api/v1/plans").then((r) => r.json()),
      resellerJson<BillingPayload>("/api/v1/reseller/billing"),
    ]);
    if (plansRes.success && Array.isArray(plansRes.data)) setPlans(plansRes.data);
    if (billRes.ok && billRes.data) {
      setBilling(billRes.data);
      if (billRes.data.defaultPhone) setPhone(billRes.data.defaultPhone);
    } else if (!billRes.ok) setErr(billRes.error || "Could not load your subscription");
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

  function openCheckout(plan: PublicResellerPlan) {
    setErr(null);
    setOk(null);
    if (needsPaidCheckout(plan)) {
      setPaymentMethod("MOBILE");
      setCheckoutPlan(plan);
      return;
    }
    void submitSubscribe(plan.id);
  }

  async function submitSubscribe(planId: string, method?: PlanPaymentMethod, payPhone?: string) {
    setBusyPlanId(planId);
    setErr(null);
    setOk(null);

    const payload: Record<string, string> = { action: "subscribe", planId };
    if (method) payload.paymentMethod = method;
    if (method === "MOBILE" && payPhone) payload.phone = payPhone.replace(/\s/g, "");

    const res = await fetch("/api/v1/reseller/billing", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setBusyPlanId(null);

    if (!res.ok || json.success === false) {
      setErr(json.error || "Could not activate this plan");
      return false;
    }

    if (json.data?.checkoutUrl) {
      window.location.href = json.data.checkoutUrl;
      return true;
    }

    if (json.data?.polling) {
      setMobileWaiting(true);
      setOk("Check your phone and approve the mobile money prompt.");
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const billRes = await resellerJson<BillingPayload>("/api/v1/reseller/billing");
        if (billRes.ok && billRes.data?.access.ok) {
          setMobileWaiting(false);
          setCheckoutPlan(null);
          await load();
          router.replace("/reseller/dashboard?billing=success");
          router.refresh();
          return true;
        }
      }
      setMobileWaiting(false);
      setErr("Payment not confirmed yet. If you already paid, wait a moment and refresh this page.");
      return false;
    }

    setCheckoutPlan(null);
    await load();
    router.replace("/reseller/dashboard");
    router.refresh();
    return true;
  }

  async function confirmCheckout() {
    if (!checkoutPlan) return;
    if (paymentMethod === "MOBILE" && !phone.match(/^[0-9+\-\s]{9,}$/)) {
      setErr("Enter a valid Tanzanian mobile money number");
      return;
    }
    if (
      paymentMethod === "WALLET" &&
      (billing?.wallet?.balance ?? 0) < checkoutPlan.price
    ) {
      setErr(
        `Insufficient wallet balance. You have ${formatTzs(billing?.wallet?.balance ?? 0)} but need ${formatTzs(checkoutPlan.price)}.`,
      );
      return;
    }
    await submitSubscribe(checkoutPlan.id, paymentMethod, phone);
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
  const walletBalance = billing?.wallet?.balance ?? 0;
  const canPayWithWallet = checkoutPlan ? walletBalance >= checkoutPlan.price : false;

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
                onClick={() => openCheckout(p)}
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

      {checkoutPlan && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !mobileWaiting && setCheckoutPlan(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gold-20 bg-gradient-to-b from-onyx-900 to-onyx-950 p-6 shadow-2xl relative"
          >
            <button
              type="button"
              disabled={mobileWaiting}
              onClick={() => setCheckoutPlan(null)}
              className="absolute top-4 right-4 text-onyx-400 hover:text-white transition-colors disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white pr-8">Pay for {checkoutPlan.name}</h2>
            <p className="text-2xl font-black text-gold mt-1">{formatPlatformPlanPrice(checkoutPlan.price)}</p>
            <p className="text-xs text-onyx-400 mt-1 mb-5">Choose how you want to pay SSDomada for this plan.</p>

            <div className="grid grid-cols-1 gap-2 mb-5">
              {(
                [
                  { id: "MOBILE" as const, label: "Mobile money", hint: "STK push on your phone", icon: Smartphone },
                  { id: "CARD" as const, label: "Card", hint: "Visa / Mastercard checkout", icon: CreditCard },
                  { id: "WALLET" as const, label: "Wallet balance", hint: `${formatTzs(walletBalance)} available`, icon: Wallet },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const disabled = opt.id === "WALLET" && !canPayWithWallet;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled || mobileWaiting}
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      paymentMethod === opt.id
                        ? "border-gold bg-gold/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-gold">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white">{opt.label}</span>
                      <span className="block text-xs text-onyx-400">{opt.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {paymentMethod === "MOBILE" && (
              <div className="mb-5">
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Mobile number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 outline-none"
                />
                <p className="text-[11px] text-onyx-500 mt-1.5">Airtel, M-Pesa, Mixx, or Halotel. Approve the prompt on your phone.</p>
              </div>
            )}

            {paymentMethod === "CARD" && (
              <p className="text-xs text-onyx-400 mb-5">You will be redirected to Snippe secure card checkout.</p>
            )}

            {paymentMethod === "WALLET" && (
              <p className="text-xs text-onyx-400 mb-5">
                {canPayWithWallet
                  ? `${formatTzs(checkoutPlan.price)} will be deducted from your WiFi earnings wallet.`
                  : "Top up your wallet from guest WiFi sales before paying from balance."}
              </p>
            )}

            <button
              type="button"
              disabled={busyPlanId !== null || mobileWaiting || (paymentMethod === "WALLET" && !canPayWithWallet)}
              onClick={() => void confirmCheckout()}
              className="w-full rounded-xl bg-gold py-3 text-sm font-black text-onyx-950 shadow-lg shadow-gold/25 hover:bg-gold-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {(busyPlanId || mobileWaiting) && <Loader2 className="w-4 h-4 animate-spin" />}
              {mobileWaiting
                ? "Waiting for payment…"
                : paymentMethod === "MOBILE"
                  ? "Send payment prompt"
                  : paymentMethod === "CARD"
                    ? "Continue to card checkout"
                    : "Pay from wallet"}
            </button>
          </div>
        </div>
      )}
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

"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  Clock,
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
  pendingCheckout?: { targetPlanId: string; paymentReference: string } | null;
};

type PlanPaymentMethod = "MOBILE" | "CARD" | "WALLET";

type PaymentWaitState = {
  planId: string;
  planName: string;
  price: number;
  phone: string;
  paymentReference?: string;
};

function formatTzs(amount: number) {
  return `${amount.toLocaleString()} TZS`;
}

function needsPaidCheckout(plan: PublicResellerPlan) {
  return plan.price > 0 && plan.trialDays <= 0;
}

function planPaymentSettled(billing: BillingPayload, targetPlanId: string): boolean {
  const sub = billing.subscription;
  if (!sub) return false;
  if (billing.pendingCheckout) return false;
  return sub.plan?.id === targetPlanId && sub.status === "ACTIVE";
}

function PlanPickerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const manage = searchParams.get("manage") === "1";
  const expired = searchParams.get("expired") === "1";
  const billingSuccess = searchParams.get("billing") === "success";
  const billingCancelled = searchParams.get("billing") === "cancelled";
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
  const [paymentWait, setPaymentWait] = useState<PaymentWaitState | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const pollStartedAt = useRef<number | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    if (!opts?.silent) setErr(null);
    const [plansRes, billRes] = await Promise.all([
      fetch("/api/v1/plans").then((r) => r.json()),
      resellerJson<BillingPayload>("/api/v1/reseller/billing"),
    ]);
    if (plansRes.success && Array.isArray(plansRes.data)) setPlans(plansRes.data);
    if (billRes.ok && billRes.data) {
      setBilling(billRes.data);
      if (billRes.data.defaultPhone && !phone) setPhone(billRes.data.defaultPhone);
    } else if (!billRes.ok && !opts?.silent) setErr(billRes.error || "Could not load your subscription");
    if (!opts?.silent) setLoading(false);
  }, [phone]);

  useEffect(() => {
    void load();
  }, [load]);

  // Do not redirect to dashboard while user is paying or on manage/expired flows.
  useEffect(() => {
    if (loading || !billing || paymentWait || billing.pendingCheckout) return;
    if (billing.access.ok && !manage && !billingSuccess && !expired) {
      router.replace("/reseller/dashboard");
    }
  }, [loading, billing, manage, billingSuccess, expired, paymentWait, router]);

  useEffect(() => {
    if (billingSuccess && billing?.access.ok) {
      setOk("Payment received. Your plan is active — welcome to your dashboard.");
    }
  }, [billingSuccess, billing?.access.ok]);

  useEffect(() => {
    if (!billingCancelled) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/v1/reseller/billing", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
        },
        body: JSON.stringify({ action: "abandon_checkout" }),
      });
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      await load({ silent: true });
      if (json.data?.restored) {
        setOk("Payment cancelled. Your current plan (including trial) is unchanged.");
        router.replace("/reseller/dashboard");
        router.refresh();
      } else {
        setOk("Payment cancelled.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [billingCancelled, load, router]);

  // Poll payment status without reloading the whole page.
  useEffect(() => {
    if (!paymentWait) return;

    pollStartedAt.current = Date.now();
    setWaitSeconds(0);

    const tick = setInterval(() => {
      if (pollStartedAt.current) {
        setWaitSeconds(Math.floor((Date.now() - pollStartedAt.current) / 1000));
      }
    }, 1000);

    let stopped = false;

    const poll = async () => {
      const billRes = await resellerJson<BillingPayload>("/api/v1/reseller/billing");
      if (stopped || !billRes.ok || !billRes.data) return;

      if (planPaymentSettled(billRes.data, paymentWait.planId)) {
        stopped = true;
        setPaymentWait(null);
        setCheckoutPlan(null);
        router.replace("/reseller/dashboard?billing=success");
        router.refresh();
      }
    };

    const interval = setInterval(() => void poll(), 3000);
    void poll();

    const timeout = setTimeout(async () => {
      if (stopped) return;
      stopped = true;
      await fetch("/api/v1/reseller/billing", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
        },
        body: JSON.stringify({
          action: "abandon_checkout",
          paymentReference: paymentWait.paymentReference,
        }),
      });
      setPaymentWait(null);
      setCheckoutPlan(null);
      setErr("Payment not confirmed in time. Your current plan is unchanged — try again when ready.");
      await load({ silent: true });
    }, 120_000);

    return () => {
      stopped = true;
      clearInterval(tick);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentWait, load, router]);

  async function abandonWaitingPayment() {
    if (!paymentWait) return;
    await fetch("/api/v1/reseller/billing", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({
        action: "abandon_checkout",
        paymentReference: paymentWait.paymentReference,
      }),
    });
    setPaymentWait(null);
    setCheckoutPlan(null);
    setErr(null);
    setOk("Payment cancelled. Your current plan is unchanged.");
    await load({ silent: true });
  }

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

    const plan = plans.find((p) => p.id === planId) || checkoutPlan;
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

    if (json.data?.polling && plan) {
      setCheckoutPlan(null);
      setPaymentWait({
        planId: plan.id,
        planName: plan.name,
        price: plan.price,
        phone: payPhone?.replace(/\s/g, "") || phone,
        paymentReference: json.data.paymentReference,
      });
      return true;
    }

    setCheckoutPlan(null);
    await load({ silent: true });
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
    if (paymentMethod === "WALLET" && (billing?.wallet?.balance ?? 0) < checkoutPlan.price) {
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
      await load({ silent: true });
    }
  }

  if (paymentWait) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4">
        <div className="rounded-3xl border border-gold-20 bg-gradient-to-br from-gold-5/30 via-onyx-900 to-onyx-950 p-8 text-center shadow-2xl">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gold/15 border border-gold/25 flex items-center justify-center mb-6">
            <Smartphone className="w-8 h-8 text-gold animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Waiting for payment</h1>
          <p className="text-onyx-300 mt-2 text-sm leading-relaxed">
            We sent a mobile money prompt to{" "}
            <span className="text-white font-semibold">{paymentWait.phone}</span>. Approve it on your phone to
            activate <span className="text-gold font-semibold">{paymentWait.planName}</span>.
          </p>
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-onyx-400">Plan</span>
              <span className="font-bold text-white">{paymentWait.planName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-onyx-400">Amount</span>
              <span className="font-bold text-gold">{formatTzs(paymentWait.price)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-onyx-400">Status</span>
              <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Checking… {waitSeconds}s
              </span>
            </div>
          </div>
          <p className="text-xs text-onyx-500 mt-5">
            Stay on this page until payment is confirmed. Do not close the browser.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => void abandonWaitingPayment()}
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-onyx-300 hover:bg-white/5 transition-colors"
            >
              Cancel payment
            </button>
          </div>
        </div>
      </div>
    );
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

      {billing?.subscription?.status === "PAST_DUE" && !billing.access.ok && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex gap-3">
          <Clock className="w-5 h-5 shrink-0 text-amber-300" />
          <span>
            Payment pending — complete checkout for <strong className="text-white">{billing.subscription.plan.name}</strong> or
            choose another plan.
          </span>
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
          onClick={() => setCheckoutPlan(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gold-20 bg-gradient-to-b from-onyx-900 to-onyx-950 p-6 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setCheckoutPlan(null)}
              className="absolute top-4 right-4 text-onyx-400 hover:text-white transition-colors"
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
                    disabled={disabled || busyPlanId !== null}
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
              disabled={busyPlanId !== null || (paymentMethod === "WALLET" && !canPayWithWallet)}
              onClick={() => void confirmCheckout()}
              className="w-full rounded-xl bg-gold py-3 text-sm font-black text-onyx-950 shadow-lg shadow-gold/25 hover:bg-gold-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busyPlanId !== null && <Loader2 className="w-4 h-4 animate-spin" />}
              {paymentMethod === "MOBILE"
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

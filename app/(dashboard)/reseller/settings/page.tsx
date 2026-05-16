"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Save, KeyRound, Bell, Shield, Zap, Clock, Monitor, CreditCard } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";

type SettingsPayload = {
  account: { email: string | null; phone: string | null; emailVerified: boolean; memberSince: string };
  subscription: { active: boolean; accountActive: boolean; commissionRate: number | null; brandSlug: string | null };
  platformPlan: {
    subscription: {
      status: string;
      currentPeriodEnd: string;
      trialEndsAt: string | null;
      cancelAtPeriodEnd: boolean;
      plan: Plan;
    } | null;
    usage: { sites: number; devices: number; activeClients: number };
    limits: { maxSites: number | null; maxDevices: number | null; maxActiveClients: number | null; maxStaff: number | null } | null;
    features: {
      customBranding: boolean;
      customDomain: boolean;
      smsNotifications: boolean;
      prioritySupport: boolean;
      apiAccess: boolean;
    } | null;
    atCapacity: { sites: boolean; devices: boolean; activeClients: boolean };
  };
  notifications: {
    id: string;
    emailOnPayment: boolean;
    emailOnWithdrawal: boolean;
    emailOnNewClient: boolean;
    emailOnDeviceDown: boolean;
    smsOnPayment: boolean;
    smsOnWithdrawal: boolean;
    smsOnDeviceDown: boolean;
    emailAddress: string | null;
    smsPhone: string | null;
  };
  security: { recentLogins: { createdAt: string; ipAddress: string | null }[] };
};

type Plan = {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  trialDays: number;
};

function formatTzs(n: number) {
  if (n <= 0) return "Free";
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(n);
}

export default function ResellerSettingsPage() {
  const [requestedPlanSlug, setRequestedPlanSlug] = useState("");
  const [s, setS] = useState<SettingsPayload | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [notif, setNotif] = useState<Partial<SettingsPayload["notifications"]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await resellerJson<SettingsPayload>("/api/v1/reseller/settings");
    if (!r.ok) setErr(r.error || "Failed");
    else if (r.data) {
      setS(r.data);
      setNotif(r.data.notifications);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    try {
      setRequestedPlanSlug(new URLSearchParams(window.location.search).get("plan")?.trim().toLowerCase() || "");
    } catch {
      setRequestedPlanSlug("");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/v1/plans");
      const json = await res.json().catch(() => ({}));
      if (!cancelled && json.success && Array.isArray(json.data)) {
        setPlans(json.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!plans.length || selectedPlanId) return;
    const requested = requestedPlanSlug ? plans.find((p) => p.slug === requestedPlanSlug) : null;
    setSelectedPlanId(requested?.id || s?.platformPlan.subscription?.plan.id || plans[0].id);
  }, [plans, requestedPlanSlug, s?.platformPlan.subscription?.plan.id, selectedPlanId]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pw");
    setErr(null);
    const res = await fetch("/api/v1/reseller/settings", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({
        action: "password",
        currentPassword: pw.current,
        newPassword: pw.next,
        confirmPassword: pw.confirm,
      }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) setErr(json.error || "Failed");
    else {
      setPw({ current: "", next: "", confirm: "" });
      alert(json.data?.message || "Password updated");
    }
  }

  async function saveNotif(e: React.FormEvent) {
    e.preventDefault();
    setBusy("notif");
    setErr(null);
    const res = await fetch("/api/v1/reseller/settings", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({
        action: "notifications",
        emailOnPayment: notif.emailOnPayment,
        emailOnWithdrawal: notif.emailOnWithdrawal,
        emailOnNewClient: notif.emailOnNewClient,
        emailOnDeviceDown: notif.emailOnDeviceDown,
        smsOnPayment: s?.platformPlan.features?.smsNotifications ? notif.smsOnPayment : false,
        smsOnWithdrawal: s?.platformPlan.features?.smsNotifications ? notif.smsOnWithdrawal : false,
        smsOnDeviceDown: s?.platformPlan.features?.smsNotifications ? notif.smsOnDeviceDown : false,
        emailAddress: notif.emailAddress || null,
        smsPhone: notif.smsPhone || null,
      }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) setErr(json.error || "Failed");
    else {
      setS((prev) => (prev ? { ...prev, notifications: json.data } : prev));
      alert("Notification preferences saved");
    }
  }

  async function subscribePlan() {
    if (!selectedPlanId) return;
    setBusy("billing");
    setErr(null);
    const res = await fetch("/api/v1/reseller/billing", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({ action: "subscribe", planId: selectedPlanId, phone: s?.account.phone || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || json.success === false) {
      setErr(json.error || "Could not start plan subscription");
      return;
    }
    if (json.data?.checkoutUrl) {
      window.location.href = json.data.checkoutUrl;
      return;
    }
    await load();
  }

  async function cancelPlan() {
    if (!confirm("Cancel this platform plan at period end?")) return;
    setBusy("billing");
    setErr(null);
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
    setBusy(null);
    if (!res.ok || json.success === false) {
      setErr(json.error || "Could not cancel plan");
      return;
    }
    await load();
  }

  if (loading || !s) {
    return (
      <div className="flex items-center gap-3 py-20 text-onyx-400">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const currentPlatformSub = s.platformPlan.subscription;
  const canUseSms = Boolean(s.platformPlan.features?.smsNotifications);
  const canUseApi = Boolean(s.platformPlan.features?.apiAccess);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-onyx-400 mt-1">Password, alerts, and your SSDomada platform subscription.</p>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Platform plan & API ── */}
      <section className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-5 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-20 to-transparent opacity-50" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-gold" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Platform subscription</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Plan status</div>
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border mt-1 ${
              s.subscription.active
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/15"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.subscription.active ? "bg-emerald-400" : "bg-red-400"}`} />
              {currentPlatformSub?.status || (s.subscription.active ? "Active" : "No plan")}
            </span>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Current plan</div>
            <div className="text-lg font-black text-gold mt-1">{currentPlatformSub?.plan.name || "—"}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Period end</div>
            <div className="text-sm text-white mt-1">
              {currentPlatformSub ? new Date(currentPlatformSub.currentPeriodEnd).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ["Sites", s.platformPlan.usage.sites, s.platformPlan.limits?.maxSites],
            ["APs", s.platformPlan.usage.devices, s.platformPlan.limits?.maxDevices],
            ["Active clients", s.platformPlan.usage.activeClients, s.platformPlan.limits?.maxActiveClients],
          ].map(([label, used, limit]) => (
            <div key={label as string} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">{label as string}</div>
              <div className="text-sm font-bold text-white mt-1">
                {used as number} / {limit == null ? "∞" : (limit as number)}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-onyx-950/40 p-4 space-y-3">
          <p className="text-sm text-onyx-400">
            Start, upgrade, or renew your SSDomada subscription on the plan page. Your WiFi portal pauses when the plan expires.
          </p>
          <Link
            href="/reseller/plan?manage=1"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 hover:bg-gold-400 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            {currentPlatformSub ? "Manage SSDomada plan" : "Choose a plan"}
          </Link>
          {currentPlatformSub?.cancelAtPeriodEnd && (
            <p className="text-xs text-amber-200">Cancellation is scheduled at period end.</p>
          )}
        </div>
        {canUseApi ? (
          <p className="text-xs text-onyx-500">
            Your plan includes{" "}
            <a className="text-gold hover:underline font-semibold" href="/api/v1/reseller/docs" target="_blank" rel="noreferrer">
              developer API documentation
            </a>{" "}
            (for integrations and automation).
          </p>
        ) : (
          <p className="text-xs text-onyx-500">Developer API access is not included in your current plan. Upgrade to connect external systems.</p>
        )}
      </section>

      {/* ── Security ── */}
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Security</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-3 max-w-md">
          <div>
            <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Current password</label>
            <input
              type="password"
              placeholder="Current"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">New password (min 8)</label>
            <input
              type="password"
              placeholder="New (min 8)"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Confirm new password</label>
            <input
              type="password"
              placeholder="Confirm new"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy === "pw"}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all"
          >
            <KeyRound className="w-4 h-4" />
            Update password
          </button>
        </form>
      </section>

      {/* ── Notifications ── */}
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-sky-400" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Notifications</h2>
        </div>
        <form onSubmit={saveNotif} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-2.5">
            {(
              [
                ["emailOnPayment", "Email on payment", "email"],
                ["emailOnWithdrawal", "Email on withdrawal", "email"],
                ["emailOnNewClient", "Email on new client", "email"],
                ["emailOnDeviceDown", "Email on device down", "email"],
                ["smsOnPayment", "SMS on payment", "sms"],
                ["smsOnWithdrawal", "SMS on withdrawal", "sms"],
                ["smsOnDeviceDown", "SMS on device down", "sms"],
              ] as const
            ).map(([key, label, type]) => (
              <label key={key} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors ${
                type === "sms" && !canUseSms ? "cursor-not-allowed opacity-45" : "cursor-pointer"
              } ${
                notif[key]
                  ? "border border-gold-20 bg-gold-5/20"
                  : "border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold ${notif[key] ? "text-gold" : "text-onyx-400"}`}>{label}</span>
                </div>
                <div className={`relative w-9 h-5 rounded-full transition-colors ${notif[key] ? "bg-gold" : "bg-white/10"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${notif[key] ? "left-[18px] bg-onyx-950" : "left-0.5 bg-onyx-400"}`} />
                  <input
                    type="checkbox"
                    checked={!!notif[key]}
                    disabled={type === "sms" && !canUseSms}
                    onChange={(e) => setNotif((n) => ({ ...n, [key]: e.target.checked }))}
                    className="sr-only"
                  />
                </div>
              </label>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Alert email</label>
              <input
                type="email"
                value={notif.emailAddress || ""}
                onChange={(e) => setNotif((n) => ({ ...n, emailAddress: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">SMS phone</label>
              <input
                value={notif.smsPhone || ""}
                onChange={(e) => setNotif((n) => ({ ...n, smsPhone: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy === "notif"}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            Save notifications
          </button>
        </form>
      </section>

      {/* ── Recent logins ── */}
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-amber-400" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent logins</h2>
        </div>
        {s.security.recentLogins.length === 0 ? (
          <p className="text-sm text-onyx-400">No login events recorded.</p>
        ) : (
          <ul className="space-y-0 divide-y divide-white/[0.04]">
            {s.security.recentLogins.map((l, i) => (
              <li key={i} className="flex justify-between items-center py-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-onyx-500" />
                  <span className="text-sm text-onyx-300">{new Date(l.createdAt).toLocaleString()}</span>
                </div>
                <span className="font-mono text-xs text-onyx-500 bg-white/[0.04] px-2.5 py-1 rounded-lg">{l.ipAddress || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

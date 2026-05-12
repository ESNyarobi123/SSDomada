"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, KeyRound, Bell, BookOpen, Shield, Zap, Clock, Monitor } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";

type SettingsPayload = {
  account: { email: string | null; phone: string | null; emailVerified: boolean; memberSince: string };
  subscription: { active: boolean; commissionRate: number | null; brandSlug: string | null };
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

export default function ResellerSettingsPage() {
  const [s, setS] = useState<SettingsPayload | null>(null);
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
  }, []);

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
        smsOnPayment: notif.smsOnPayment,
        smsOnWithdrawal: notif.smsOnWithdrawal,
        smsOnDeviceDown: notif.smsOnDeviceDown,
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

  if (loading || !s) {
    return (
      <div className="flex items-center gap-3 py-20 text-onyx-400">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-onyx-400 mt-1">Security, alerts, subscription status, and API reference.</p>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Subscription & API ── */}
      <section className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-5 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-20 to-transparent opacity-50" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-gold" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Subscription & API</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Status</div>
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border mt-1 ${
              s.subscription.active
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/15"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.subscription.active ? "bg-emerald-400" : "bg-red-400"}`} />
              {s.subscription.active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Commission</div>
            <div className="text-lg font-black text-gold mt-1">{s.subscription.commissionRate != null ? `${Math.round(s.subscription.commissionRate * 100)}%` : "—"}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Slug</div>
            <div className="text-sm font-mono text-white mt-1">@{s.subscription.brandSlug}</div>
          </div>
        </div>
        <p className="text-xs text-onyx-500">
          Reseller OpenAPI spec (use session Bearer token):{" "}
          <a className="text-gold hover:underline font-mono" href="/api/v1/reseller/docs" target="_blank" rel="noreferrer">
            /api/v1/reseller/docs
          </a>{" "}
          — open in browser while logged in, or copy your token from devtools Application → Local Storage →
          ssdomada_token and pass{" "}
          <code className="text-onyx-400">Authorization: Bearer …</code>
        </p>
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
              <label key={key} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors ${
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

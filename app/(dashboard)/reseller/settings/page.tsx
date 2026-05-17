"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Save,
  KeyRound,
  Bell,
  Shield,
  Zap,
  Clock,
  Monitor,
  CreditCard,
  UserCircle,
  Mail,
  Smartphone,
} from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import {
  AccountAlert,
  AccountInput,
  AccountPageHeader,
  AccountPageShell,
  AccountPrimaryButton,
  AccountSecondaryButton,
  AccountSection,
  FieldLabel,
  SettingsNav,
  ToggleRow,
  UsageMeter,
} from "@/components/reseller/ResellerAccountUi";

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

type Plan = { id: string; slug: string; name: string; price: number; currency: string; interval: string; trialDays: number };

const NAV = [
  { id: "plan", label: "Platform plan", icon: <Zap className="w-4 h-4" /> },
  { id: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { id: "activity", label: "Login activity", icon: <Monitor className="w-4 h-4" /> },
];

export default function ResellerSettingsPage() {
  const [activeSection, setActiveSection] = useState("plan");
  const [s, setS] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    if (hash && NAV.some((n) => n.id === hash)) setActiveSection(hash);
  }, []);

  function flash(msg: string) {
    setSuccess(msg);
    setErr(null);
    window.setTimeout(() => setSuccess(null), 4000);
  }

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
      flash(json.data?.message || "Password updated");
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
      flash("Notification preferences saved");
    }
  }

  if (loading || !s) {
    return (
      <div className="flex items-center gap-3 py-20 text-onyx-400">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        Loading settings…
      </div>
    );
  }

  const sub = s.platformPlan.subscription;
  const canUseSms = Boolean(s.platformPlan.features?.smsNotifications);
  const canUseApi = Boolean(s.platformPlan.features?.apiAccess);

  return (
    <AccountPageShell>
      <AccountPageHeader
        title="Settings"
        description="Manage your SSDomada subscription, password, alerts, and security."
        actions={
          <AccountSecondaryButton href="/reseller/profile">
            <UserCircle className="w-4 h-4" />
            Profile & brand
          </AccountSecondaryButton>
        }
      />

      {err && <AccountAlert variant="error">{err}</AccountAlert>}
      {success && <AccountAlert variant="success">{success}</AccountAlert>}

      <div className="flex flex-col gap-6">
        <SettingsNav items={NAV} active={activeSection} onSelect={setActiveSection} />

        <div className="min-w-0 space-y-5">
          {activeSection === "plan" && (
            <>
              <AccountSection
                id="plan"
                title="SSDomada platform plan"
                description="Your subscription controls site limits, features, and whether your guest portal stays online."
                icon={<Zap className="w-5 h-5" />}
              >
                <div className="grid sm:grid-cols-3 gap-3 mb-5">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Status</div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border mt-2 ${
                        s.subscription.active
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/15"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${s.subscription.active ? "bg-emerald-400" : "bg-red-400"}`}
                      />
                      {sub?.status || (s.subscription.active ? "Active" : "No plan")}
                    </span>
                  </div>
                  <div className="rounded-xl border border-gold-15 bg-gold-5/30 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Current plan</div>
                    <div className="text-lg font-black text-gold mt-2">{sub?.plan.name || "—"}</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Renews / ends</div>
                    <div className="text-sm font-semibold text-white mt-2">
                      {sub ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mb-5">
                  <UsageMeter label="Sites" used={s.platformPlan.usage.sites} limit={s.platformPlan.limits?.maxSites ?? null} />
                  <UsageMeter label="Access points" used={s.platformPlan.usage.devices} limit={s.platformPlan.limits?.maxDevices ?? null} />
                  <UsageMeter
                    label="Active clients"
                    used={s.platformPlan.usage.activeClients}
                    limit={s.platformPlan.limits?.maxActiveClients ?? null}
                  />
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-onyx-950/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <p className="text-sm text-onyx-400 max-w-md">
                    Upgrade, renew, or change billing on the plan page. Guest WiFi pauses when your platform plan expires.
                  </p>
                  <Link
                    href="/reseller/plan?manage=1"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 hover:bg-gold-400 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    {sub ? "Manage plan" : "Choose a plan"}
                  </Link>
                </div>

                {sub?.cancelAtPeriodEnd && (
                  <p className="mt-3 text-xs text-amber-200 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    Cancellation scheduled — access continues until period end.
                  </p>
                )}

                {canUseApi ? (
                  <p className="mt-4 text-xs text-onyx-500">
                    API access included —{" "}
                    <a className="text-gold hover:underline font-semibold" href="/docs" target="_blank" rel="noreferrer">
                      view documentation
                    </a>
                    .
                  </p>
                ) : (
                  <p className="mt-4 text-xs text-onyx-500">Upgrade your plan for developer API access and automations.</p>
                )}
              </AccountSection>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-onyx-500">Account email</span>
                  <p className="text-white font-medium mt-0.5">{s.account.email || "—"}</p>
                </div>
                <div>
                  <span className="text-onyx-500">Member since</span>
                  <p className="text-white font-medium mt-0.5">
                    {new Date(s.account.memberSince).toLocaleDateString()}
                  </p>
                </div>
                {s.subscription.commissionRate != null && (
                  <div>
                    <span className="text-onyx-500">Platform fee</span>
                    <p className="text-white font-medium mt-0.5">
                      {(s.subscription.commissionRate * 100).toFixed(0)}% per transaction
                    </p>
                  </div>
                )}
                {s.subscription.brandSlug && (
                  <div>
                    <span className="text-onyx-500">Portal slug</span>
                    <p className="text-gold font-mono mt-0.5">@{s.subscription.brandSlug}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === "security" && (
            <AccountSection
              id="security"
              title="Password"
              description="Use a strong password you do not reuse elsewhere."
              icon={<Shield className="w-5 h-5" />}
              accent="red"
            >
              <form onSubmit={changePassword} className="space-y-4 max-w-md">
                <div>
                  <FieldLabel>Current password</FieldLabel>
                  <AccountInput
                    type="password"
                    value={pw.current}
                    onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <FieldLabel>New password</FieldLabel>
                  <AccountInput
                    type="password"
                    value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <FieldLabel>Confirm new password</FieldLabel>
                  <AccountInput
                    type="password"
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <AccountPrimaryButton type="submit" loading={busy === "pw"}>
                  <KeyRound className="w-4 h-4" />
                  Update password
                </AccountPrimaryButton>
              </form>
            </AccountSection>
          )}

          {activeSection === "notifications" && (
            <AccountSection
              id="notifications"
              title="Alerts"
              description="Choose how we notify you about payments, clients, and device issues."
              icon={<Bell className="w-5 h-5" />}
              accent="sky"
            >
              <form onSubmit={saveNotif} className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-onyx-500 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </p>
                  <ToggleRow
                    label="Payment received"
                    checked={!!notif.emailOnPayment}
                    onChange={(v) => setNotif((n) => ({ ...n, emailOnPayment: v }))}
                  />
                  <ToggleRow
                    label="Withdrawal processed"
                    checked={!!notif.emailOnWithdrawal}
                    onChange={(v) => setNotif((n) => ({ ...n, emailOnWithdrawal: v }))}
                  />
                  <ToggleRow
                    label="New client"
                    checked={!!notif.emailOnNewClient}
                    onChange={(v) => setNotif((n) => ({ ...n, emailOnNewClient: v }))}
                  />
                  <ToggleRow
                    label="Device offline"
                    checked={!!notif.emailOnDeviceDown}
                    onChange={(v) => setNotif((n) => ({ ...n, emailOnDeviceDown: v }))}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-onyx-500 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" /> SMS
                    {!canUseSms && <span className="normal-case font-normal text-onyx-600">(not on your plan)</span>}
                  </p>
                  <ToggleRow
                    label="Payment received"
                    checked={!!notif.smsOnPayment}
                    disabled={!canUseSms}
                    onChange={(v) => setNotif((n) => ({ ...n, smsOnPayment: v }))}
                  />
                  <ToggleRow
                    label="Withdrawal processed"
                    checked={!!notif.smsOnWithdrawal}
                    disabled={!canUseSms}
                    onChange={(v) => setNotif((n) => ({ ...n, smsOnWithdrawal: v }))}
                  />
                  <ToggleRow
                    label="Device offline"
                    checked={!!notif.smsOnDeviceDown}
                    disabled={!canUseSms}
                    onChange={(v) => setNotif((n) => ({ ...n, smsOnDeviceDown: v }))}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <FieldLabel>Alert email (optional override)</FieldLabel>
                    <AccountInput
                      type="email"
                      value={notif.emailAddress || ""}
                      onChange={(e) => setNotif((n) => ({ ...n, emailAddress: e.target.value }))}
                      placeholder={s.account.email || "you@example.com"}
                    />
                  </div>
                  <div>
                    <FieldLabel>SMS phone</FieldLabel>
                    <AccountInput
                      value={notif.smsPhone || ""}
                      onChange={(e) => setNotif((n) => ({ ...n, smsPhone: e.target.value }))}
                      disabled={!canUseSms}
                      placeholder="+255…"
                    />
                  </div>
                </div>

                <AccountPrimaryButton type="submit" loading={busy === "notif"}>
                  <Save className="w-4 h-4" />
                  Save notifications
                </AccountPrimaryButton>
              </form>
            </AccountSection>
          )}

          {activeSection === "activity" && (
            <AccountSection
              id="activity"
              title="Recent logins"
              description="Sessions that signed into this reseller account."
              icon={<Monitor className="w-5 h-5" />}
              accent="amber"
            >
              {s.security.recentLogins.length === 0 ? (
                <p className="text-sm text-onyx-400">No login events recorded yet.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] overflow-hidden">
                  {s.security.recentLogins.map((l, i) => (
                    <li
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 text-sm text-onyx-300">
                        <Clock className="w-4 h-4 text-onyx-500 shrink-0" />
                        {new Date(l.createdAt).toLocaleString()}
                      </div>
                      <span className="font-mono text-xs text-onyx-400 bg-onyx-950 border border-white/[0.06] px-2.5 py-1 rounded-lg w-fit">
                        {l.ipAddress || "Unknown IP"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AccountSection>
          )}
        </div>
      </div>
    </AccountPageShell>
  );
}

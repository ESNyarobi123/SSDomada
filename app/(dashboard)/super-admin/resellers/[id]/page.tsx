"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Ban,
  CheckCircle,
  Pencil,
  CreditCard,
  Router,
  Package,
  Globe,
  LogIn,
  Trash2,
  Megaphone,
  Radio,
  MapPin,
  ExternalLink,
  RefreshCw,
  Shield,
} from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { authFetch, getStoredToken, setStoredToken } from "@/lib/auth-client";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";

type TabId = "overview" | "account" | "payments" | "devices" | "catalog" | "portal" | "platform" | "tools";

type Detail = {
  id: string;
  companyName: string;
  brandSlug: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  commissionRate: number;
  walletBalance: number;
  totalEarnings: number;
  currency: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
    image: string | null;
  };
  sites: Array<{ id: string; name: string; location: string | null; omadaSiteId: string | null; isActive: boolean }>;
  packages: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    duration: string;
    durationMinutes: number;
    isActive: boolean;
    sortOrder: number;
    maxDevices: number;
  }>;
  captivePortalConfig: {
    id: string;
    companyName: string | null;
    welcomeText: string | null;
    primaryColor: string;
    accentColor: string;
    template: string;
    redirectUrl: string | null;
    termsUrl: string | null;
  } | null;
  planSubscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    plan: { id: string; name: string; slug: string; price: number; interval: string };
  } | null;
  revenue: {
    allTime: { totalAmount: number; platformFee: number; resellerEarnings: number; transactionCount: number };
    thisMonth: { totalAmount: number; platformFee: number; resellerEarnings: number; transactionCount: number };
  };
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    paymentType: string;
    customerPhone: string | null;
    completedAt: string | null;
    user: { name: string | null; phone: string | null };
  }>;
  pendingWithdrawals: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    payoutMethod: string | null;
  }>;
  deviceStats: Array<{ status: string; _count: number }>;
  _count: { devices: number; payments: number; withdrawals: number };
};

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentType: string;
  customerPhone: string | null;
  completedAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  subscription: { id: string; status: string; package: { name: string; duration: string } } | null;
};

type DeviceRow = {
  id: string;
  name: string;
  mac: string;
  status: string;
  type: string;
  lastSeen: string | null;
  site: { id: string; name: string; location: string | null };
};

type SubRow = {
  id: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  package: { id: string; name: string; price: number; duration: string; reseller: { companyName: string } };
};

type PublicPlan = { id: string; name: string; slug: string; price: number; interval: string };

const tabs: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "account", label: "Account" },
  { id: "payments", label: "Payments" },
  { id: "devices", label: "Devices" },
  { id: "catalog", label: "Packages & subs" },
  { id: "portal", label: "Captive portal" },
  { id: "platform", label: "Platform plan" },
  { id: "tools", label: "Admin tools" },
];

export default function AdminResellerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");

  const [companyName, setCompanyName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [commissionRate, setCommissionRate] = useState("0.1");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payMeta, setPayMeta] = useState({ page: 1, limit: 15, total: 0 });
  const [payLoading, setPayLoading] = useState(false);

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [devLoading, setDevLoading] = useState(false);

  const [subs, setSubs] = useState<SubRow[]>([]);
  const [subMeta, setSubMeta] = useState({ page: 1, limit: 15, total: 0 });
  const [subLoading, setSubLoading] = useState(false);

  const [publicPlans, setPublicPlans] = useState<PublicPlan[]>([]);
  const [planForm, setPlanForm] = useState({ planId: "", status: "", currentPeriodEnd: "" });

  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const r = await adminJson<Detail>(`/api/v1/admin/resellers/${id}`);
    setLoading(false);
    if (!r.ok) {
      setErr(r.error || "Not found");
      setD(null);
    } else {
      const row = r.data!;
      setD(row);
      setCompanyName(row.companyName);
      setBrandSlug(row.brandSlug);
      setPhone(row.phone || "");
      setAddress(row.address || "");
      setCommissionRate(String(row.commissionRate));
      setUserName(row.user.name || "");
      setUserEmail(row.user.email);
      setUserPhone(row.user.phone || "");
      if (row.planSubscription) {
        setPlanForm({
          planId: row.planSubscription.plan.id,
          status: row.planSubscription.status,
          currentPeriodEnd: row.planSubscription.currentPeriodEnd.slice(0, 16),
        });
      } else {
        setPlanForm({ planId: "", status: "", currentPeriodEnd: "" });
      }
    }
  }, [id]);

  const loadPayments = useCallback(async () => {
    setPayLoading(true);
    const q = new URLSearchParams({
      resellerId: id,
      page: String(payMeta.page),
      limit: String(payMeta.limit),
    });
    type PayPayload = { payments: PaymentRow[]; summary: Record<string, number> };
    const r = await adminJson<PayPayload>(`/api/v1/admin/payments?${q}`);
    setPayLoading(false);
    if (r.ok && r.data) {
      setPayments(r.data.payments);
      if (r.meta) setPayMeta((m) => ({ ...m, ...r.meta! }));
    }
  }, [id, payMeta.page, payMeta.limit]);

  const loadDevices = useCallback(async () => {
    setDevLoading(true);
    const q = new URLSearchParams({ resellerId: id, limit: "50", page: "1" });
    type DevPayload = { devices: DeviceRow[] };
    const r = await adminJson<DevPayload>(`/api/v1/admin/devices?${q}`);
    setDevLoading(false);
    if (r.ok && r.data) setDevices(r.data.devices);
  }, [id]);

  const loadSubs = useCallback(async () => {
    setSubLoading(true);
    const q = new URLSearchParams({
      view: "subscriptions",
      resellerId: id,
      page: String(subMeta.page),
      limit: String(subMeta.limit),
    });
    type SubPayload = { subscriptions: SubRow[] };
    const r = await adminJson<SubPayload>(`/api/v1/admin/subscriptions?${q}`);
    setSubLoading(false);
    if (r.ok && r.data) {
      setSubs(r.data.subscriptions);
      if (r.meta) setSubMeta((m) => ({ ...m, ...r.meta! }));
    }
  }, [id, subMeta.page, subMeta.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "payments") void loadPayments();
  }, [tab, loadPayments]);

  useEffect(() => {
    if (tab === "devices") void loadDevices();
  }, [tab, loadDevices]);

  useEffect(() => {
    if (tab === "catalog") void loadSubs();
  }, [tab, loadSubs]);

  useEffect(() => {
    if (tab !== "platform") return;
    void (async () => {
      const res = await fetch("/api/v1/plans");
      const json = await res.json().catch(() => ({}));
      if (json.success && Array.isArray(json.data)) setPublicPlans(json.data);
    })();
  }, [tab]);

  const deviceBreakdown = useMemo(() => {
    if (!d?.deviceStats) return { online: 0, offline: 0, pending: 0 };
    let online = 0,
      offline = 0,
      pending = 0;
    for (const s of d.deviceStats) {
      if (s.status === "ONLINE") online = s._count;
      if (s.status === "OFFLINE") offline = s._count;
      if (s.status === "PENDING") pending = s._count;
    }
    return { online, offline, pending };
  }, [d?.deviceStats]);

  async function patchAction(action: "suspend" | "activate") {
    if (!confirm(action === "suspend" ? "Suspend this reseller and their login?" : "Re-activate this reseller?")) return;
    setBusy(true);
    const res = await authFetch(`/api/v1/admin/resellers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(json.error || "Failed");
      return;
    }
    void load();
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const rate = Number(commissionRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 1) {
      alert("Commission rate must be between 0 and 1");
      setBusy(false);
      return;
    }
    const res = await authFetch(`/api/v1/admin/resellers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        brandSlug: brandSlug.toLowerCase(),
        phone: phone || undefined,
        address: address || undefined,
        commissionRate: rate,
        user: {
          name: userName,
          email: userEmail,
          phone: userPhone || null,
        },
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(json.error || "Failed");
      return;
    }
    void load();
  }

  async function impersonate() {
    if (!confirm("Open a reseller session in this browser? Your super-admin token is saved until you return.")) return;
    setBusy(true);
    const res = await authFetch(`/api/v1/admin/resellers/${id}/impersonate`, { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (!res.ok || !json.success) {
      alert(json.error || "Failed");
      return;
    }
    const backup = getStoredToken();
    try {
      if (backup) sessionStorage.setItem("ssdomada_impersonation_backup_token", backup);
      sessionStorage.setItem("ssdomada_impersonation_active", "1");
      sessionStorage.setItem("ssdomada_impersonation_return_path", `/super-admin/resellers/${id}`);
    } catch {
      /* ignore */
    }
    setStoredToken(json.data.token);
    window.location.href = "/reseller/dashboard";
  }

  async function sendNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!noticeBody.trim()) return;
    setBusy(true);
    const res = await authFetch(`/api/v1/admin/resellers/${id}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: noticeTitle.trim() || undefined, body: noticeBody.trim() }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(json.error || "Failed");
      return;
    }
    setNoticeTitle("");
    setNoticeBody("");
    alert("Notice delivered to this reseller’s dashboard.");
  }

  async function deleteReseller() {
    if (deleteConfirm !== d?.companyName) {
      alert(`Type the company name exactly (${d?.companyName}) to confirm deletion.`);
      return;
    }
    if (!confirm("This permanently deletes the reseller, user, sites, devices, and related data. Continue?")) return;
    setBusy(true);
    const res = await authFetch(`/api/v1/admin/resellers/${id}`, { method: "DELETE" });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(json.error || "Failed");
      return;
    }
    window.location.href = "/super-admin/resellers";
  }

  async function savePlatformPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!d?.planSubscription) return;
    setBusy(true);
    const res = await authFetch(`/api/v1/admin/resellers/${id}/platform-plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: planForm.planId || undefined,
        status: planForm.status || undefined,
        currentPeriodEnd: planForm.currentPeriodEnd ? new Date(planForm.currentPeriodEnd).toISOString() : undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(json.error || "Failed");
      return;
    }
    void load();
  }

  async function togglePackage(pkgId: string) {
    const res = await authFetch(`/api/v1/admin/subscriptions/${pkgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle" }),
    });
    const json = await res.json();
    if (!res.ok) alert(json.error || "Failed");
    else void load();
  }

  async function patchDevice(deviceId: string, status: "OFFLINE" | "PENDING") {
    const res = await authFetch(`/api/v1/admin/devices/${deviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) alert(json.error || "Failed");
    else void loadDevices();
  }

  async function saveSubscription(sub: SubRow, nextStatus: string, expiresLocal: string) {
    const body: { status?: string; expiresAt?: string } = {};
    if (nextStatus && nextStatus !== sub.status) body.status = nextStatus;
    if (expiresLocal) {
      const dt = new Date(expiresLocal);
      if (!Number.isNaN(dt.getTime())) body.expiresAt = dt.toISOString();
    }
    if (!body.status && !body.expiresAt) {
      alert("Change status or expiry before saving.");
      return;
    }
    setBusy(true);
    const res = await authFetch(`/api/v1/admin/wifi-subscriptions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) alert(json.error || "Failed");
    else void loadSubs();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-rose-300" />
      </div>
    );
  }

  if (err || !d) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/super-admin/resellers" className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to resellers
        </Link>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{err || "Loading…"}</div>
      </div>
    );
  }

  const portalPreviewUrl = typeof window !== "undefined" ? `${window.location.origin}/portal/${d.brandSlug}` : `/portal/${d.brandSlug}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/super-admin/resellers" className="inline-flex items-center gap-2 text-sm text-gold hover:underline w-fit">
          <ArrowLeft className="h-4 w-4" />
          Resellers
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-onyx-200 hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {d.isActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void patchAction("suspend")}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              Suspend reseller
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void patchAction("activate")}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Activate reseller
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">{d.companyName}</h1>
          <p className="text-onyx-400 mt-1">
            <span className="font-mono text-gold/90">@{d.brandSlug}</span> · {d.user.email}
            {!d.user.isActive && <span className="ml-2 text-amber-400 font-bold">(login disabled)</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-white/[0.08] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === t.id ? "bg-gold text-onyx-950" : "text-onyx-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-4">
              <div className="text-[10px] font-bold uppercase text-onyx-500">Wallet</div>
              <div className="text-xl font-black text-gold">{formatTzsCompact(d.walletBalance)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-4">
              <div className="text-[10px] font-bold uppercase text-onyx-500">Lifetime earnings</div>
              <div className="text-xl font-black text-white">{formatTzsCompact(d.totalEarnings)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-4">
              <div className="text-[10px] font-bold uppercase text-onyx-500">All-time gross</div>
              <div className="text-xl font-black text-white">{formatTzsCompact(d.revenue.allTime.totalAmount)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-4">
              <div className="text-[10px] font-bold uppercase text-onyx-500">Devices</div>
              <div className="text-xl font-black text-white">{d._count.devices}</div>
              <div className="text-[10px] text-onyx-500 mt-1">
                {deviceBreakdown.online} online · {deviceBreakdown.offline} offline · {deviceBreakdown.pending} pending
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
                <MapPin className="h-4 w-4 text-gold" />
                Sites
              </h2>
              <ul className="space-y-2 text-sm">
                {d.sites.length === 0 ? (
                  <li className="text-onyx-500">No sites.</li>
                ) : (
                  d.sites.map((s) => (
                    <li key={s.id} className="flex justify-between gap-2 rounded-lg border border-white/5 px-3 py-2">
                      <span className="font-medium text-white">{s.name}</span>
                      <span className="text-xs text-onyx-500">{s.omadaSiteId ? "Omada linked" : "Local"}</span>
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/super-admin/sites"
                className="mt-3 inline-block text-xs font-semibold text-gold hover:underline"
              >
                Open global sites view
              </Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
                <CreditCard className="h-4 w-4 text-gold" />
                Recent payments
              </h2>
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {d.recentPayments.length === 0 ? (
                  <li className="text-onyx-500">No completed payments yet.</li>
                ) : (
                  d.recentPayments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 border-b border-white/5 py-2">
                      <span className="text-onyx-300">{p.user.name || p.user.phone || p.customerPhone || "—"}</span>
                      <span className="font-semibold text-gold">{formatTzs(p.amount)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {d.pendingWithdrawals.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h2 className="mb-3 font-bold text-amber-200">Pending withdrawals</h2>
              <ul className="divide-y divide-white/5 text-sm">
                {d.pendingWithdrawals.map((w) => (
                  <li key={w.id} className="flex justify-between py-2 text-onyx-200">
                    <span>{formatTzs(w.amount)}</span>
                    <span className="text-onyx-500">{w.status}</span>
                  </li>
                ))}
              </ul>
              <Link href="/super-admin/payouts" className="mt-2 inline-block text-xs font-semibold text-gold hover:underline">
                Process in payouts
              </Link>
            </div>
          )}

          {d.planSubscription && (
            <div className="rounded-2xl border border-gold-20/40 bg-gold-5/10 p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-gold-600-op">SSDomada plan</div>
                <div className="text-lg font-bold text-white">{d.planSubscription.plan.name}</div>
                <div className="text-xs text-onyx-400">
                  {d.planSubscription.status} · renews {new Date(d.planSubscription.currentPeriodEnd).toLocaleString()}
                </div>
              </div>
              <button type="button" onClick={() => setTab("platform")} className="text-xs font-bold text-gold hover:underline">
                Edit plan →
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "account" && (
        <form onSubmit={saveAccount} className="rounded-2xl border border-white/10 bg-onyx-900/40 p-6 space-y-5 max-w-2xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Pencil className="h-5 w-5 text-gold" />
            Company & login
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-onyx-400">Company name</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-onyx-400">Brand slug</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 font-mono text-white"
                value={brandSlug}
                onChange={(e) => setBrandSlug(e.target.value)}
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-onyx-400">Commission rate (0–1)</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-onyx-400">Company phone</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          <label className="space-y-1 text-sm block">
            <span className="text-onyx-400">Address</span>
            <textarea
              className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white min-h-[72px]"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <div className="border-t border-white/10 pt-4 space-y-4">
            <div className="text-xs font-bold uppercase text-gold-600-op">Reseller login (user)</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-onyx-400">Name</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-onyx-400">Email</span>
                <input
                  type="email"
                  className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-onyx-400">User phone</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                />
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 hover:bg-gold-400 disabled:opacity-50"
          >
            Save changes
          </button>
        </form>
      )}

      {tab === "payments" && (
        <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="font-bold text-white">Payment history</h2>
            {payLoading && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-onyx-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/5 text-onyx-200">
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{p.user.name || p.user.phone || p.customerPhone || "—"}</td>
                    <td className="px-4 py-2 font-semibold text-gold">{formatTzs(p.amount)}</td>
                    <td className="px-4 py-2">{p.status}</td>
                    <td className="px-4 py-2 text-onyx-400">{p.paymentType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <button
              type="button"
              disabled={payMeta.page <= 1 || payLoading}
              onClick={() => setPayMeta((m) => ({ ...m, page: Math.max(1, m.page - 1) }))}
              className="text-xs font-bold text-gold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-onyx-500">
              Page {payMeta.page} of {Math.max(1, Math.ceil(payMeta.total / payMeta.limit))}
            </span>
            <button
              type="button"
              disabled={payMeta.page * payMeta.limit >= payMeta.total || payLoading}
              onClick={() => setPayMeta((m) => ({ ...m, page: m.page + 1 }))}
              className="text-xs font-bold text-gold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {tab === "devices" && (
        <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Router className="h-4 w-4 text-gold" />
              Devices
            </h2>
            {devLoading && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-onyx-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">MAC</th>
                  <th className="px-4 py-2">Site</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((dev) => (
                  <tr key={dev.id} className="border-t border-white/5 text-onyx-200">
                    <td className="px-4 py-2 font-medium text-white">{dev.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{dev.mac}</td>
                    <td className="px-4 py-2">{dev.site.name}</td>
                    <td className="px-4 py-2">{dev.status}</td>
                    <td className="px-4 py-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => void patchDevice(dev.id, "OFFLINE")}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-200"
                      >
                        Suspend (mark offline)
                      </button>
                      <button
                        type="button"
                        onClick={() => void patchDevice(dev.id, "PENDING")}
                        className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-onyx-300"
                      >
                        Clear override
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "catalog" && (
        <div className="space-y-8">
          <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
              <Package className="h-5 w-5 text-gold" />
              Wi‑Fi packages
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-onyx-500 text-xs uppercase border-b border-white/10">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Price</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {d.packages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-white/5 text-onyx-200">
                      <td className="py-2 pr-4 font-medium text-white">{pkg.name}</td>
                      <td className="py-2 pr-4">{formatTzs(pkg.price)}</td>
                      <td className="py-2 pr-4 text-onyx-400">{pkg.duration}</td>
                      <td className="py-2 pr-4">{pkg.isActive ? "Yes" : "No"}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => void togglePackage(pkg.id)}
                          className="text-xs font-bold text-gold hover:underline"
                        >
                          Toggle active
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Radio className="h-4 w-4 text-gold" />
                End-user subscriptions (this reseller)
              </h2>
              {subLoading && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead className="bg-white/[0.03] text-onyx-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Package</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Expires</th>
                    <th className="px-3 py-2">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <SubscriptionAdminRow key={s.id} sub={s} busy={busy} onSave={saveSubscription} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
              <button
                type="button"
                disabled={subMeta.page <= 1 || subLoading}
                onClick={() => setSubMeta((m) => ({ ...m, page: Math.max(1, m.page - 1) }))}
                className="text-xs font-bold text-gold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-onyx-500">
                Page {subMeta.page} of {Math.max(1, Math.ceil(subMeta.total / subMeta.limit))}
              </span>
              <button
                type="button"
                disabled={subMeta.page * subMeta.limit >= subMeta.total || subLoading}
                onClick={() => setSubMeta((m) => ({ ...m, page: m.page + 1 }))}
                className="text-xs font-bold text-gold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "portal" && (
        <div className="space-y-6 max-w-3xl">
          <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Globe className="h-5 w-5 text-gold" />
              Captive portal
            </h2>
            <p className="text-sm text-onyx-400">
              Public customer Wi‑Fi page for this brand. Full branding editor lives in the reseller console (captive portal section).
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={portalPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-bold text-gold hover:bg-gold/20"
              >
                <ExternalLink className="h-4 w-4" />
                Open public portal
              </a>
              <Link
                href="/reseller/captive-portal"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/5"
              >
                Reseller editor (after impersonate)
              </Link>
            </div>
          </div>
          {d.captivePortalConfig ? (
            <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-6 grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-onyx-500 text-xs uppercase">Welcome</div>
                <div className="text-white">{d.captivePortalConfig.welcomeText || "—"}</div>
              </div>
              <div>
                <div className="text-onyx-500 text-xs uppercase">Portal title</div>
                <div className="text-white">{d.captivePortalConfig.companyName || d.companyName}</div>
              </div>
              <div>
                <div className="text-onyx-500 text-xs uppercase">Primary / accent</div>
                <div className="flex gap-2 items-center text-white">
                  <span className="inline-block w-6 h-6 rounded border border-white/20" style={{ background: d.captivePortalConfig.primaryColor }} />
                  {d.captivePortalConfig.primaryColor}
                  <span className="inline-block w-6 h-6 rounded border border-white/20 ml-2" style={{ background: d.captivePortalConfig.accentColor }} />
                  {d.captivePortalConfig.accentColor}
                </div>
              </div>
              <div>
                <div className="text-onyx-500 text-xs uppercase">Template</div>
                <div className="text-white font-mono">{d.captivePortalConfig.template}</div>
              </div>
              {d.captivePortalConfig.redirectUrl && (
                <div className="sm:col-span-2">
                  <div className="text-onyx-500 text-xs uppercase">Redirect after pay</div>
                  <div className="text-gold break-all">{d.captivePortalConfig.redirectUrl}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-onyx-500 text-sm">No captive portal config row (unexpected).</div>
          )}
        </div>
      )}

      {tab === "platform" && (
        <div className="max-w-xl">
          {!d.planSubscription ? (
            <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-6 text-onyx-400">
              This reseller has no SSDomada platform subscription record yet.
            </div>
          ) : (
            <form onSubmit={savePlatformPlan} className="rounded-2xl border border-white/10 bg-onyx-900/40 p-6 space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Shield className="h-5 w-5 text-gold" />
                Platform billing
              </h2>
              <label className="block text-sm space-y-1">
                <span className="text-onyx-400">Plan</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                  value={planForm.planId}
                  onChange={(e) => setPlanForm((f) => ({ ...f, planId: e.target.value }))}
                >
                  {publicPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatTzs(p.price)} / {p.interval}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm space-y-1">
                <span className="text-onyx-400">Status</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                  value={planForm.status}
                  onChange={(e) => setPlanForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {["TRIAL", "ACTIVE", "PAST_DUE", "EXPIRED", "CANCELLED"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm space-y-1">
                <span className="text-onyx-400">Current period end</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-white"
                  value={planForm.currentPeriodEnd}
                  onChange={(e) => setPlanForm((f) => ({ ...f, currentPeriodEnd: e.target.value }))}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 disabled:opacity-50"
              >
                Save platform plan
              </button>
            </form>
          )}
        </div>
      )}

      {tab === "tools" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-6 space-y-3">
            <h2 className="flex items-center gap-2 font-bold text-white">
              <LogIn className="h-5 w-5 text-gold" />
              View as reseller
            </h2>
            <p className="text-sm text-onyx-400">
              Starts a reseller session in this browser. Your super-admin token is stored in session storage until you click
              &quot;Return to admin&quot; in the reseller layout.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void impersonate()}
              className="rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 hover:bg-gold-400 disabled:opacity-50"
            >
              Impersonate reseller
            </button>
          </div>

          <form onSubmit={sendNotice} className="rounded-2xl border border-gold-20/30 bg-gold-5/10 p-6 space-y-3">
            <h2 className="flex items-center gap-2 font-bold text-white">
              <Megaphone className="h-5 w-5 text-gold" />
              Dashboard notice
            </h2>
            <p className="text-sm text-onyx-400">Shows at the top of this reseller&apos;s dashboard until they dismiss it.</p>
            <input
              className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-sm text-white"
              placeholder="Title (optional)"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-sm text-white min-h-[100px]"
              placeholder="Message body"
              value={noticeBody}
              onChange={(e) => setNoticeBody(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl border border-gold/40 bg-gold/20 px-4 py-2 text-sm font-bold text-gold hover:bg-gold/30 disabled:opacity-50"
            >
              Send notice
            </button>
          </form>

          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 space-y-3 lg:col-span-2">
            <h2 className="flex items-center gap-2 font-bold text-red-200">
              <Trash2 className="h-5 w-5" />
              Delete reseller permanently
            </h2>
            <p className="text-sm text-onyx-400">
              Removes the reseller profile, login user, sites, devices, packages, and related records per database cascade rules.
            </p>
            <input
              className="w-full max-w-md rounded-xl border border-red-500/30 bg-onyx-950 px-3 py-2 text-sm text-white"
              placeholder={`Type "${d.companyName}" to enable delete`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || deleteConfirm !== d.companyName}
              onClick={() => void deleteReseller()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40"
            >
              Delete account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionAdminRow({
  sub,
  busy,
  onSave,
}: {
  sub: SubRow;
  busy: boolean;
  onSave: (sub: SubRow, status: string, expiresLocal: string) => void;
}) {
  const [status, setStatus] = useState(sub.status);
  const [expires, setExpires] = useState(sub.expiresAt.slice(0, 16));

  useEffect(() => {
    setStatus(sub.status);
    setExpires(sub.expiresAt.slice(0, 16));
  }, [sub.id, sub.status, sub.expiresAt]);

  return (
    <tr className="border-t border-white/5 align-top">
      <td className="px-3 py-2 text-onyx-200">
        {sub.user.name || sub.user.phone || sub.user.email || sub.user.id.slice(0, 8)}
      </td>
      <td className="px-3 py-2 text-white font-medium">{sub.package.name}</td>
      <td className="px-3 py-2">
        <select
          className="w-full min-w-[120px] rounded-lg border border-white/10 bg-onyx-950 px-2 py-1 text-xs text-white"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="datetime-local"
          className="w-full min-w-[160px] rounded-lg border border-white/10 bg-onyx-950 px-2 py-1 text-xs text-white"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(sub, status, expires)}
          className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20 disabled:opacity-40"
        >
          Save
        </button>
      </td>
    </tr>
  );
}

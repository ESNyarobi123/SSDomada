"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  Package,
  CreditCard,
  Users,
  Clock,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  Search,
  Store,
  X,
  Radio,
} from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatTzs } from "@/lib/format-currency";

type Tab = "catalog" | "customers";

type Summary = {
  totalPackages: number;
  activePackages: number;
  totalSubscriptions: number;
  subscriptionsByStatus: Record<string, number>;
};

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: string;
  durationMinutes: number;
  maxDevices: number;
  isActive: boolean;
  sortOrder: number;
  reseller: { id: string; companyName: string; brandSlug: string };
  _count: { subscriptions: number };
};

type WifiSub = {
  id: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  package: {
    id: string;
    name: string;
    price: number;
    duration: string;
    durationMinutes: number;
    reseller: { id: string; companyName: string; brandSlug: string };
  };
};

type ResellerOpt = { id: string; companyName: string; brandSlug: string };

const DURATION_PRESETS: { label: string; duration: string; minutes: number }[] = [
  { label: "30 min", duration: "MINUTES_30", minutes: 30 },
  { label: "1 hour", duration: "HOUR_1", minutes: 60 },
  { label: "3 hours", duration: "HOURS_3", minutes: 180 },
  { label: "6 hours", duration: "HOURS_6", minutes: 360 },
  { label: "12 hours", duration: "HOURS_12", minutes: 720 },
  { label: "1 day", duration: "HOURS_24", minutes: 1440 },
  { label: "7 days", duration: "DAYS_7", minutes: 10080 },
  { label: "30 days", duration: "DAYS_30", minutes: 43200 },
  { label: "90 days", duration: "DAYS_90", minutes: 129600 },
  { label: "365 days", duration: "DAYS_365", minutes: 525600 },
];

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [wifiSubs, setWifiSubs] = useState<WifiSub[]>([]);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [pkgSearch, setPkgSearch] = useState("");
  const [pkgQuery, setPkgQuery] = useState("");
  const [pkgReseller, setPkgReseller] = useState("");
  const [pkgStatus, setPkgStatus] = useState<"all" | "active" | "inactive">("all");

  const [subSearch, setSubSearch] = useState("");
  const [subQuery, setSubQuery] = useState("");
  const [subReseller, setSubReseller] = useState("");
  const [subStatus, setSubStatus] = useState<string>("");

  const [resellers, setResellers] = useState<ResellerOpt[]>([]);

  const [showCreatePkg, setShowCreatePkg] = useState(false);
  const [editPkg, setEditPkg] = useState<Pkg | null>(null);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [editSub, setEditSub] = useState<WifiSub | null>(null);

  const loadSummary = useCallback(async () => {
    const r = await adminJson<Summary>("/api/v1/admin/subscriptions?view=summary");
    if (r.ok && r.data) setSummary(r.data);
  }, []);

  const loadResellers = useCallback(async () => {
    const r = await adminJson<ResellerOpt[]>(`/api/v1/admin/resellers?limit=200&page=1`);
    if (r.ok && r.data) setResellers(r.data);
  }, []);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    q.set("view", "packages");
    if (pkgQuery.trim()) q.set("search", pkgQuery.trim());
    if (pkgReseller) q.set("resellerId", pkgReseller);
    if (pkgStatus === "active") q.set("status", "active");
    if (pkgStatus === "inactive") q.set("status", "inactive");
    const r = await adminJson<{ packages: Pkg[] }>(`/api/v1/admin/subscriptions?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setPackages(r.data!.packages || []);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, pkgQuery, pkgReseller, pkgStatus]);

  const loadWifiSubs = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    if (subQuery.trim()) q.set("search", subQuery.trim());
    if (subReseller) q.set("resellerId", subReseller);
    if (subStatus) q.set("status", subStatus);
    const r = await adminJson<{ subscriptions: WifiSub[]; statusBreakdown: Record<string, number> }>(
      `/api/v1/admin/wifi-subscriptions?${q}`
    );
    if (!r.ok) setErr(r.error || "Failed");
    else {
      const d = r.data!;
      setWifiSubs(d.subscriptions || []);
      setBreakdown(d.statusBreakdown || {});
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, subQuery, subReseller, subStatus]);

  useEffect(() => {
    void loadSummary();
    void loadResellers();
  }, [loadSummary, loadResellers]);

  useEffect(() => {
    if (tab === "catalog") void loadPackages();
    else void loadWifiSubs();
  }, [tab, loadPackages, loadWifiSubs]);

  const activeSubsTotal = useMemo(() => {
    if (!summary?.subscriptionsByStatus) return 0;
    return summary.subscriptionsByStatus.ACTIVE ?? 0;
  }, [summary]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white md:text-4xl">Subscription center</h1>
          <p className="mt-1 text-onyx-400 max-w-2xl">
            <strong className="text-onyx-200">Wi‑Fi packages</strong> are catalog plans resellers sell on the captive portal.{" "}
            <strong className="text-onyx-200">Customer subscriptions</strong> are live access rows for end-users — create, extend,
            suspend, or cancel them here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadSummary();
            if (tab === "catalog") void loadPackages();
            else void loadWifiSubs();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all self-start"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh all
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <Package className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Packages (all)</span>
          </div>
          <div className="text-2xl font-black text-white">{summary?.totalPackages ?? "—"}</div>
          <div className="text-[10px] text-onyx-500 mt-0.5">{summary?.activePackages ?? 0} active in catalog</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Active subs</span>
          </div>
          <div className="text-2xl font-black text-white">{activeSubsTotal}</div>
          <div className="text-[10px] text-onyx-500 mt-0.5">End-users with valid access</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
              <Users className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Subscriptions (rows)</span>
          </div>
          <div className="text-2xl font-black text-white">{summary?.totalSubscriptions ?? "—"}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">List page</span>
          </div>
          <div className="text-2xl font-black text-white">
            {meta.page}
            <span className="text-sm text-onyx-400">/{Math.max(1, Math.ceil(meta.total / meta.limit)) || 1}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-gold-10 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setTab("catalog");
              setMeta((m) => ({ ...m, page: 1 }));
            }}
            className={`px-4 py-2.5 text-sm font-bold transition-colors flex items-center gap-2 ${
              tab === "catalog" ? "bg-gold-10 text-gold" : "text-onyx-400 hover:text-onyx-200"
            }`}
          >
            <Package className="w-4 h-4" />
            Wi‑Fi packages
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("customers");
              setMeta((m) => ({ ...m, page: 1 }));
            }}
            className={`px-4 py-2.5 text-sm font-bold transition-colors flex items-center gap-2 ${
              tab === "customers" ? "bg-gold-10 text-gold" : "text-onyx-400 hover:text-onyx-200"
            }`}
          >
            <Radio className="w-4 h-4" />
            Customer subscriptions
          </button>
        </div>
        {tab === "catalog" ? (
          <button
            type="button"
            onClick={() => setShowCreatePkg(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 hover:bg-gold-400"
          >
            <Plus className="h-4 w-4" />
            New package
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreateSub(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 hover:bg-gold-400"
          >
            <Plus className="h-4 w-4" />
            New subscription
          </button>
        )}
      </div>

      {tab === "customers" && Object.keys(breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(breakdown).map(([k, v]) => (
            <span
              key={k}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border ${
                k === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : k === "EXPIRED"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/15"
                    : k === "CANCELLED"
                      ? "bg-red-500/10 text-red-400 border-red-500/15"
                      : k === "SUSPENDED"
                        ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
                        : "bg-white/[0.04] text-onyx-300 border-white/[0.08]"
              }`}
            >
              {k}: <span className="text-white">{v}</span>
            </span>
          ))}
        </div>
      )}

      {tab === "catalog" && (
        <div className="flex flex-wrap gap-2 items-end rounded-xl border border-white/[0.08] bg-onyx-900/30 p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase text-onyx-500">Search packages / reseller</label>
            <div className="flex gap-2 mt-1">
              <input
                value={pkgSearch}
                onChange={(e) => setPkgSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setPkgQuery(pkgSearch)}
                className="flex-1 rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-sm text-white"
                placeholder="Name, company, slug…"
              />
              <button
                type="button"
                onClick={() => {
                  setPkgQuery(pkgSearch);
                  setMeta((m) => ({ ...m, page: 1 }));
                }}
                className="rounded-lg border border-gold-10 px-3 py-2 text-gold hover:bg-gold-10"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-onyx-500">Reseller</label>
            <select
              value={pkgReseller}
              onChange={(e) => {
                setPkgReseller(e.target.value);
                setMeta((m) => ({ ...m, page: 1 }));
              }}
              className="mt-1 block w-full min-w-[180px] rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-sm text-white"
            >
              <option value="">All resellers</option>
              {resellers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-onyx-500">Catalog</label>
            <select
              value={pkgStatus}
              onChange={(e) => {
                setPkgStatus(e.target.value as typeof pkgStatus);
                setMeta((m) => ({ ...m, page: 1 }));
              }}
              className="mt-1 block rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-sm text-white"
            >
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>
      )}

      {tab === "customers" && (
        <div className="flex flex-wrap gap-2 items-end rounded-xl border border-white/[0.08] bg-onyx-900/30 p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase text-onyx-500">Search customer</label>
            <div className="flex gap-2 mt-1">
              <input
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSubQuery(subSearch)}
                className="flex-1 rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-sm text-white"
                placeholder="Phone, email, name…"
              />
              <button
                type="button"
                onClick={() => {
                  setSubQuery(subSearch);
                  setMeta((m) => ({ ...m, page: 1 }));
                }}
                className="rounded-lg border border-gold-10 px-3 py-2 text-gold hover:bg-gold-10"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-onyx-500">Reseller</label>
            <select
              value={subReseller}
              onChange={(e) => {
                setSubReseller(e.target.value);
                setMeta((m) => ({ ...m, page: 1 }));
              }}
              className="mt-1 block min-w-[180px] rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-sm text-white"
            >
              <option value="">All</option>
              {resellers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-onyx-500">Status</label>
            <select
              value={subStatus}
              onChange={(e) => {
                setSubStatus(e.target.value);
                setMeta((m) => ({ ...m, page: 1 }));
              }}
              className="mt-1 block rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-sm text-white"
            >
              <option value="">Any</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>
      )}

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : tab === "catalog" ? (
        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                <th className="px-5 py-3 font-semibold">Package</th>
                <th className="px-5 py-3 font-semibold">Reseller</th>
                <th className="px-5 py-3 font-semibold">Duration</th>
                <th className="px-5 py-3 text-right font-semibold">Price</th>
                <th className="px-5 py-3 text-right font-semibold">Subs</th>
                <th className="px-5 py-3 font-semibold">Active</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-gold-5/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{p.name}</td>
                  <td className="px-5 py-3 text-onyx-300">
                    <Link href={`/super-admin/resellers/${p.reseller.id}`} className="hover:text-gold hover:underline inline-flex items-center gap-1">
                      <Store className="w-3 h-3" />
                      {p.reseller.companyName}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center text-xs bg-white/[0.04] px-2.5 py-1 rounded-lg text-onyx-300">
                      {p.duration}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gold">{formatTzs(p.price)}</td>
                  <td className="px-5 py-3 text-right text-onyx-300">{p._count.subscriptions}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                        p.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                      }`}
                    >
                      {p.isActive ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditPkg(p)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await authFetch(`/api/v1/admin/subscriptions/${p.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "toggle" }),
                        });
                        const j = await res.json();
                        if (!res.ok) alert(j.error || "Failed");
                        else void loadPackages();
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-onyx-300 hover:text-white"
                    >
                      <ToggleLeft className="w-3 h-3" /> Toggle
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete package “${p.name}”?`)) return;
                        const res = await authFetch(`/api/v1/admin/subscriptions/${p.id}`, { method: "DELETE" });
                        const j = await res.json();
                        if (!res.ok) alert(j.error || "Failed");
                        else {
                          void loadPackages();
                          void loadSummary();
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-400 hover:underline"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Package</th>
                <th className="px-5 py-3 font-semibold">Reseller</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Expires</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {wifiSubs.map((s) => (
                <tr key={s.id} className="hover:bg-gold-5/20 transition-colors">
                  <td className="px-5 py-3 text-white">
                    <div>{s.user.name || s.user.phone || "—"}</div>
                    <div className="text-[10px] text-onyx-500 font-mono">{s.user.id.slice(0, 10)}…</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-onyx-200">{s.package.name}</span>
                    <div className="text-[10px] text-onyx-500">{formatTzs(s.package.price)}</div>
                  </td>
                  <td className="px-5 py-3 text-onyx-400">{s.package.reseller.companyName}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                        s.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : s.status === "EXPIRED"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/15"
                            : s.status === "CANCELLED"
                              ? "bg-red-500/10 text-red-400 border-red-500/15"
                              : "bg-white/[0.04] text-onyx-300 border-white/[0.08]"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-onyx-400">{new Date(s.expiresAt).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditSub(s)}
                      className="text-xs font-bold text-gold hover:underline"
                    >
                      Edit
                    </button>
                    <Link href={`/super-admin/customers`} className="text-xs font-bold text-onyx-400 hover:text-white">
                      Users
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Cancel this subscription? (soft — sets CANCELLED)")) return;
                        const res = await authFetch(`/api/v1/admin/wifi-subscriptions/${s.id}`, { method: "DELETE" });
                        const j = await res.json();
                        if (!res.ok) alert(j.error || "Failed");
                        else {
                          void loadWifiSubs();
                          void loadSummary();
                        }
                      }}
                      className="text-xs font-bold text-red-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.total > meta.limit && (
        <div className="flex items-center justify-between text-xs text-onyx-400">
          <span>
            {meta.total} total · page {meta.page}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={meta.page <= 1 || loading}
              onClick={() => setMeta((m) => ({ ...m, page: Math.max(1, m.page - 1) }))}
              className="rounded-lg border border-gold-10 px-3 py-1.5 hover:bg-gold-5 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={meta.page * meta.limit >= meta.total || loading}
              onClick={() => setMeta((m) => ({ ...m, page: m.page + 1 }))}
              className="rounded-lg border border-gold-10 px-3 py-1.5 hover:bg-gold-5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreatePkg && (
        <PackageFormModal
          title="Create Wi‑Fi package"
          resellers={resellers}
          onClose={() => setShowCreatePkg(false)}
          onSaved={() => {
            setShowCreatePkg(false);
            void loadPackages();
            void loadSummary();
          }}
        />
      )}
      {editPkg && (
        <PackageFormModal
          title="Edit package"
          resellers={resellers}
          initial={editPkg}
          onClose={() => setEditPkg(null)}
          onSaved={() => {
            setEditPkg(null);
            void loadPackages();
            void loadSummary();
          }}
        />
      )}
      {showCreateSub && (
        <CreateSubModal
          resellers={resellers}
          onClose={() => setShowCreateSub(false)}
          onSaved={() => {
            setShowCreateSub(false);
            void loadWifiSubs();
            void loadSummary();
          }}
        />
      )}
      {editSub && (
        <EditSubModal
          sub={editSub}
          onClose={() => setEditSub(null)}
          onSaved={() => {
            setEditSub(null);
            void loadWifiSubs();
            void loadSummary();
          }}
        />
      )}
    </div>
  );
}

function PackageFormModal({
  title,
  resellers,
  initial,
  onClose,
  onSaved,
}: {
  title: string;
  resellers: ResellerOpt[];
  initial?: Pkg;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [resellerId, setResellerId] = useState(initial?.reseller.id || "");
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [price, setPrice] = useState(initial?.price ?? 1000);
  const [presetIdx, setPresetIdx] = useState(() => {
    if (!initial) return 5;
    const i = DURATION_PRESETS.findIndex((d) => d.duration === initial.duration);
    return i >= 0 ? i : 5;
  });
  const [maxDevices, setMaxDevices] = useState(initial?.maxDevices ?? 1);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);

  const preset = DURATION_PRESETS[presetIdx] ?? DURATION_PRESETS[5];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!initial && !resellerId) {
      alert("Pick a reseller.");
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        const res = await authFetch(`/api/v1/admin/subscriptions/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || undefined,
            price: Math.round(Number(price)),
            duration: preset.duration,
            durationMinutes: preset.minutes,
            maxDevices: Math.round(Number(maxDevices)),
            sortOrder: Math.round(Number(sortOrder)),
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Failed");
      } else {
        const res = await authFetch(`/api/v1/admin/subscriptions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resellerId,
            name,
            description: description || undefined,
            price: Math.round(Number(price)),
            currency: "TZS",
            duration: preset.duration,
            durationMinutes: preset.minutes,
            maxDevices: Math.round(Number(maxDevices)),
            sortOrder: Math.round(Number(sortOrder)),
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Failed");
      }
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-gold-10 bg-onyx-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 text-onyx-400 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 text-sm">
          {!initial && (
            <label className="block space-y-1">
              <span className="text-onyx-400">Reseller</span>
              <select
                required
                value={resellerId}
                onChange={(e) => setResellerId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              >
                <option value="">Select…</option>
                {resellers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.companyName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-onyx-400">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-onyx-400">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white min-h-[60px]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-onyx-400">Price (TZS)</span>
              <input
                type="number"
                min={100}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-onyx-400">Max devices</span>
              <input
                type="number"
                min={1}
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-onyx-400">Duration preset</span>
            <select
              value={presetIdx}
              onChange={(e) => setPresetIdx(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            >
              {DURATION_PRESETS.map((d, i) => (
                <option key={d.duration} value={i}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-onyx-400">Sort order</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-onyx-300">
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gold px-4 py-2 font-bold text-onyx-950 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateSubModal({
  resellers,
  onClose,
  onSaved,
}: {
  resellers: ResellerOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [resellerId, setResellerId] = useState("");
  const [packages, setPackages] = useState<{ id: string; name: string; price: number }[]>([]);
  const [packageId, setPackageId] = useState("");
  const [userId, setUserId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!resellerId) {
      setPackages([]);
      setPackageId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const q = new URLSearchParams({ view: "packages", resellerId, limit: "100", page: "1" });
      const r = await adminJson<{ packages: { id: string; name: string; price: number }[] }>(`/api/v1/admin/subscriptions?${q}`);
      if (!cancelled && r.ok && r.data?.packages) {
        setPackages(r.data.packages);
        setPackageId((id) => (r.data!.packages.some((p) => p.id === id) ? id : r.data!.packages[0]?.id || ""));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resellerId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!packageId || !userId.trim()) {
      alert("Package and end-user id (cuid) are required. Find the user under Customers.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { packageId, userId: userId.trim() };
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const res = await authFetch(`/api/v1/admin/wifi-subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-gold-10 bg-onyx-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">New customer subscription</h2>
          <button type="button" onClick={onClose} className="p-2 text-onyx-400 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 text-sm">
          <p className="text-xs text-onyx-500">
            End-user id must be a WiFi customer (<code className="text-gold">END_USER</code>). Open{" "}
            <Link href="/super-admin/customers" className="text-gold underline">
              Customers
            </Link>{" "}
            to copy the id.
          </p>
          <label className="block space-y-1">
            <span className="text-onyx-400">Reseller (filters packages)</span>
            <select
              required
              value={resellerId}
              onChange={(e) => setResellerId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            >
              <option value="">Select…</option>
              {resellers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.companyName}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-onyx-400">Package</span>
            <select
              required
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              disabled={!packages.length}
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatTzs(p.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-onyx-400">End-user id (cuid)</span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 font-mono text-xs text-white"
              placeholder="clxxxxxxxx…"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-onyx-400">Expires at (optional — default from package)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-onyx-300">
              Close
            </button>
            <button
              type="submit"
              disabled={saving || !packages.length}
              className="rounded-lg bg-gold px-4 py-2 font-bold text-onyx-950 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditSubModal({
  sub,
  onClose,
  onSaved,
}: {
  sub: WifiSub;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(sub.status);
  const [expiresAt, setExpiresAt] = useState(sub.expiresAt.slice(0, 16));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: { status?: string; expiresAt?: string } = {};
      if (status !== sub.status) body.status = status;
      const ex = new Date(expiresAt);
      if (!Number.isNaN(ex.getTime()) && ex.toISOString() !== new Date(sub.expiresAt).toISOString()) {
        body.expiresAt = ex.toISOString();
      }
      if (!body.status && !body.expiresAt) {
        alert("Change status or expiry.");
        setSaving(false);
        return;
      }
      const res = await authFetch(`/api/v1/admin/wifi-subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gold-10 bg-onyx-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Edit subscription</h2>
          <button type="button" onClick={onClose} className="p-2 text-onyx-400 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 text-sm">
          <div className="text-onyx-400 text-xs">
            {sub.user.name || sub.user.phone} · {sub.package.name}
          </div>
          <label className="block space-y-1">
            <span className="text-onyx-400">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            >
              {["ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-onyx-400">Expires</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-onyx-300">
              Close
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-gold px-4 py-2 font-bold text-onyx-950 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

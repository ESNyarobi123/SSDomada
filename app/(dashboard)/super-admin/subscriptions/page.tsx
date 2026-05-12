"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Package, CreditCard, Users, Clock } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { formatTzs } from "@/lib/format-currency";

type Pkg = {
  id: string;
  name: string;
  price: number;
  duration: string;
  isActive: boolean;
  reseller: { companyName: string; brandSlug: string };
  _count: { subscriptions: number };
};

type Sub = {
  id: string;
  status: string;
  createdAt: string;
  user: { name: string | null; phone: string | null };
  package: { name: string; price: number; reseller: { companyName: string } };
};

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<"packages" | "subscriptions">("packages");
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    q.set("view", tab);
    const r = await adminJson<{ packages?: Pkg[]; subscriptions?: Sub[]; statusBreakdown?: Record<string, number> }>(
      `/api/v1/admin/subscriptions?${q}`
    );
    if (!r.ok) setErr(r.error || "Failed");
    else if (tab === "packages") {
      setPackages(r.data!.packages || []);
      setBreakdown({});
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    } else {
      const d = r.data as { subscriptions: Sub[]; statusBreakdown: Record<string, number> };
      setSubs(d.subscriptions || []);
      setBreakdown(d.statusBreakdown || {});
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPkgs = packages.length;
  const activePkgs = packages.filter((p) => p.isActive).length;
  const totalSubs = Object.values(breakdown).reduce((a, b) => a + b, 0) || subs.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">Plans & subscriptions</h1>
        <p className="mt-1 text-onyx-400">All reseller packages and end-user subscription rows.</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <Package className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Packages</span>
          </div>
          <div className="text-2xl font-black text-white">{totalPkgs}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Active plans</span>
          </div>
          <div className="text-2xl font-black text-white">{activePkgs}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
              <Users className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Subscriptions</span>
          </div>
          <div className="text-2xl font-black text-white">{totalSubs}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Page</span>
          </div>
          <div className="text-2xl font-black text-white">{meta.page}<span className="text-sm text-onyx-400">/{Math.ceil(meta.total / meta.limit) || 1}</span></div>
        </div>
      </div>

      {/* ── Tab toggle ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-gold-10 overflow-hidden">
          {(["packages", "subscriptions"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setMeta((m) => ({ ...m, page: 1 }));
              }}
              className={`px-4 py-2.5 text-sm font-bold capitalize transition-colors ${
                tab === t ? "bg-gold-10 text-gold" : "text-onyx-400 hover:text-onyx-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Status breakdown pills ── */}
      {tab === "subscriptions" && Object.keys(breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(breakdown).map(([k, v]) => (
            <span key={k} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border ${
              k === "ACTIVE"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : k === "EXPIRED"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/15"
                : k === "CANCELLED"
                ? "bg-red-500/10 text-red-400 border-red-500/15"
                : "bg-white/[0.04] text-onyx-300 border-white/[0.08]"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                k === "ACTIVE" ? "bg-emerald-400" : k === "EXPIRED" ? "bg-amber-400" : k === "CANCELLED" ? "bg-red-400" : "bg-onyx-400"
              }`} />
              {k}: <span className="text-white">{v}</span>
            </span>
          ))}
        </div>
      )}

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Packages table ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : tab === "packages" ? (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-gold-5/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{p.name}</td>
                  <td className="px-5 py-3 text-onyx-300">{p.reseller.companyName}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center text-xs bg-white/[0.04] px-2.5 py-1 rounded-lg text-onyx-300">{p.duration}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gold">{formatTzs(p.price)}</td>
                  <td className="px-5 py-3 text-right text-onyx-300">{p._count.subscriptions}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                      p.isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                      {p.isActive ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Subscriptions table ── */
        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Package</th>
                <th className="px-5 py-3 font-semibold">Reseller</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-gold-5/20 transition-colors">
                  <td className="px-5 py-3 text-white">{s.user.name || s.user.phone || "—"}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center text-xs bg-white/[0.04] px-2.5 py-1 rounded-lg text-onyx-300">{s.package.name}</span>
                  </td>
                  <td className="px-5 py-3 text-onyx-400">{s.package.reseller.companyName}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                      s.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : s.status === "EXPIRED"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/15"
                        : s.status === "CANCELLED"
                        ? "bg-red-500/10 text-red-400 border-red-500/15"
                        : "bg-white/[0.04] text-onyx-300 border-white/[0.08]"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        s.status === "ACTIVE" ? "bg-emerald-400" : s.status === "EXPIRED" ? "bg-amber-400" : s.status === "CANCELLED" ? "bg-red-400" : "bg-onyx-400"
                      }`} />
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-onyx-400">{new Date(s.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta.total > meta.limit && (
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-onyx-400">
              <span>{meta.total} total · page {meta.page}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setMeta((m) => ({ ...m, page: m.page - 1 }))}
                  className="rounded-lg border border-gold-10 px-3 py-1.5 hover:bg-gold-5 disabled:opacity-40 transition-colors"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={meta.page * meta.limit >= meta.total}
                  onClick={() => setMeta((m) => ({ ...m, page: m.page + 1 }))}
                  className="rounded-lg border border-gold-10 px-3 py-1.5 hover:bg-gold-5 disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

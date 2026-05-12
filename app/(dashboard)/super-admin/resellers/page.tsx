"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, RefreshCw, Plus, Store, ArrowRight, Users, Router, DollarSign } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { formatTzsCompact } from "@/lib/format-currency";

type ResellerRow = {
  id: string;
  companyName: string;
  brandSlug: string;
  phone: string | null;
  isActive: boolean;
  commissionRate: number;
  user: { name: string | null; email: string; phone: string | null };
  _count: { devices: number; packages: number; payments: number; sites: number; withdrawals: number };
  revenue: {
    totalAmount: number;
    platformFee: number;
    resellerEarnings: number;
    transactionCount: number;
  };
};

export default function AdminResellersPage() {
  const [rows, setRows] = useState<ResellerRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    if (query.trim()) q.set("search", query.trim());
    if (status === "active") q.set("status", "active");
    if (status === "suspended") q.set("status", "suspended");
    const r = await adminJson<ResellerRow[]>(`/api/v1/admin/resellers?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setRows(r.data || []);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  const activeCount = rows.filter((r) => r.isActive).length;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue.totalAmount, 0);
  const totalDevices = rows.reduce((s, r) => s + r._count.devices, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Resellers</h1>
          <p className="mt-1 text-onyx-400">Search, filter, open detail — suspend/activate is audited.</p>
        </div>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 transition-all"
        >
          <Plus className="h-4 w-4" />
          Public register
        </Link>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <Store className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total</span>
          </div>
          <div className="text-2xl font-black text-white">{meta.total}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Active</span>
          </div>
          <div className="text-2xl font-black text-white">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
              <Router className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Devices</span>
          </div>
          <div className="text-2xl font-black text-white">{totalDevices}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Revenue</span>
          </div>
          <div className="text-lg font-black text-gold">{formatTzsCompact(totalRevenue)}</div>
        </div>
      </div>

      {/* ── Search & filters ── */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQuery(search.trim());
                setMeta((m) => ({ ...m, page: 1 }));
              }
            }}
            placeholder="Company, slug, email, phone…"
            className="w-full rounded-xl border border-gold-10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "suspended"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setMeta((m) => ({ ...m, page: 1 }));
              }}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wide border transition-all ${
                status === s
                  ? "border-gold-30 bg-gold-10 text-gold shadow-sm shadow-gold/5"
                  : "border-gold-10 text-onyx-400 hover:border-gold-20 hover:text-onyx-200"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setQuery(search.trim());
              setMeta((m) => ({ ...m, page: 1 }));
            }}
            className="rounded-xl border border-gold-30 bg-gold-10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                  <th className="px-5 py-3 font-semibold">Reseller</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Gross revenue</th>
                  <th className="px-5 py-3 font-semibold text-right">Commission</th>
                  <th className="px-5 py-3 font-semibold text-right">Devices</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gold-5/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gold-10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-gold">{initials(r.companyName)}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-white">{r.companyName}</div>
                          <div className="text-xs text-onyx-400 font-mono">@{r.brandSlug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-onyx-300">
                      <div>{r.user.email}</div>
                      <div className="text-xs text-onyx-400">{r.user.phone || "—"}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                        r.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {r.isActive ? "Active" : "Suspended"}
                      </span>
                      <div className="text-[10px] text-onyx-500 mt-1">Fee {Math.round(r.commissionRate * 100)}%</div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-white">{formatTzsCompact(r.revenue.totalAmount)}</td>
                    <td className="px-5 py-3 text-right text-gold font-bold">{formatTzsCompact(r.revenue.platformFee)}</td>
                    <td className="px-5 py-3 text-right text-onyx-300">{r._count.devices}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/super-admin/resellers/${r.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline">
                        Open <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta.total > meta.limit && (
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-onyx-400">
              <span>
                {meta.total} total · page {meta.page}
              </span>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, RefreshCw, Users, CreditCard, Wifi, DollarSign } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { formatTzsCompact } from "@/lib/format-currency";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { subscriptions: number; payments: number; wifiSessions: number };
  totalSpent: number;
  latestSession: { clientMac: string; startedAt: string; site: { name: string } } | null;
  activeSubscription: { package: { name: string; reseller: { companyName: string } } } | null;
};

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0 });
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    if (query.trim()) q.set("search", query.trim());
    const r = await adminJson<Customer[]>(`/api/v1/admin/customers?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setRows(r.data || []);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, query]);

  useEffect(() => {
    void load();
  }, [load]);

  function initials(name: string | null) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  const activeCount = rows.filter((r) => r.isActive).length;
  const totalSpent = rows.reduce((s, r) => s + r.totalSpent, 0);
  const withSubs = rows.filter((r) => r.activeSubscription).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">End customers</h1>
        <p className="mt-1 text-onyx-400">Global WiFi buyers — search phone, email, name, or MAC (via sessions).</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <Users className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total</span>
          </div>
          <div className="text-2xl font-black text-white">{meta.total}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Wifi className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Active</span>
          </div>
          <div className="text-2xl font-black text-white">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
              <CreditCard className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">With plan</span>
          </div>
          <div className="text-2xl font-black text-white">{withSubs}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Total spent</span>
          </div>
          <div className="text-lg font-black text-gold">{formatTzsCompact(totalSpent)}</div>
        </div>
      </div>

      {/* ── Search & filters ── */}
      <div className="flex flex-wrap gap-2">
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
            placeholder="Search…"
            className="w-full rounded-xl border border-gold-10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery(search.trim());
            setMeta((m) => ({ ...m, page: 1 }));
          }}
          className="rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
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
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">MAC / site</th>
                  <th className="px-5 py-3 font-semibold">Active package</th>
                  <th className="px-5 py-3 text-right font-semibold">Spent</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-gold-5/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gold-10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-gold">{initials(c.name || c.phone)}</span>
                        </div>
                        <div>
                          <div className="font-medium text-white">{c.name || c.phone || c.email || c.id.slice(0, 8)}</div>
                          <div className="text-xs text-onyx-400">{c.phone || c.email || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-onyx-400">
                      {c.latestSession ? (
                        <>
                          <span className="font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">{c.latestSession.clientMac}</span>
                          <div className="mt-0.5">{c.latestSession.site.name}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-onyx-300">
                      {c.activeSubscription ? (
                        <>
                          <span className="inline-flex items-center text-xs bg-white/[0.04] px-2.5 py-1 rounded-lg">{c.activeSubscription.package.name}</span>
                          <div className="text-xs text-onyx-400 mt-0.5">{c.activeSubscription.package.reseller.companyName}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-gold">{formatTzsCompact(c.totalSpent)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                        c.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {c.isActive ? "Active" : "Blocked"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

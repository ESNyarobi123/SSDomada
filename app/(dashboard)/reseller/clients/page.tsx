"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Download, UserPlus, Filter, Users, DollarSign, Wifi, X, ArrowRight, Ticket } from "lucide-react";
import { authFetch } from "@/lib/auth-client";
import { resellerJson } from "@/lib/reseller-fetch";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";
import { ChartPanel, Histogram, type HistItem } from "@/components/reseller/ResellerCharts";

type ClientRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  totalSpent: number;
  totalPayments: number;
  latestSubscription: {
    status: string;
    expiresAt: string;
    package: { name: string };
  } | null;
  latestSession: { clientMac: string; startedAt: string; endedAt: string | null } | null;
};

export default function ResellerClientsPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0 });
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);
  const [vForm, setVForm] = useState({ packageId: "", quantity: 5, note: "" });
  const [clientGrowth, setClientGrowth] = useState<HistItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    if (query.trim()) q.set("search", query.trim());
    if (activeOnly) q.set("activeOnly", "true");
    const r = await resellerJson<ClientRow[]>(`/api/v1/reseller/clients?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setRows(r.data || []);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, query, activeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const r = await resellerJson<Array<{ id: string; name: string }>>("/api/v1/reseller/packages?status=active");
      if (r.ok && r.data) setPackages(r.data);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await resellerJson<{ chart: { date: string; newClients: number }[] }>(
        "/api/v1/reseller/analytics?type=clients&period=30d"
      );
      if (r.ok && r.data?.chart?.length) {
        setClientGrowth(
          r.data.chart.slice(-30).map((c) => ({
            label: c.date.slice(5),
            value: c.newClients,
            title: `${c.date}: ${c.newClients} new clients`,
          }))
        );
      } else setClientGrowth([]);
    })();
  }, []);

  async function exportCsv() {
    const q = new URLSearchParams();
    if (query.trim()) q.set("search", query.trim());
    q.set("format", "csv");
    const res = await authFetch(`/api/v1/reseller/clients?${q}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createVouchers(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/v1/reseller/clients/vouchers", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({
        packageId: vForm.packageId,
        quantity: Number(vForm.quantity),
        note: vForm.note || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error || "Failed");
    else {
      setVoucherOpen(false);
      alert(`Generated ${json.data?.generated ?? 0} voucher(s).`);
    }
  }

  function isSessionActive(s: ClientRow["latestSession"], sub: ClientRow["latestSubscription"]) {
    if (sub?.status === "ACTIVE" && sub.expiresAt && new Date(sub.expiresAt) > new Date()) return true;
    if (s && !s.endedAt) return true;
    return false;
  }

  const activeCount = rows.filter((c) => isSessionActive(c.latestSession, c.latestSubscription)).length;
  const totalSpend = rows.reduce((a, c) => a + c.totalSpent, 0);

  function initials(name: string | null) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Clients</h1>
          <p className="text-onyx-400 mt-1">
            Everyone who bought WiFi through your portal. Search by phone, name, email, or MAC. Export to CSV anytime.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportCsv()}
            className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setVoucherOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Vouchers
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Summary strip ── */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total clients</span>
            </div>
            <div className="text-xl font-black text-white">{meta.total}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Online now</span>
            </div>
            <div className="text-xl font-black text-white">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Total spend</span>
            </div>
            <div className="text-xl font-black text-white">{formatTzsCompact(totalSpend)}</div>
          </div>
        </div>
      )}

      {/* ── Chart ── */}
      {clientGrowth.length > 0 && (
        <ChartPanel
          title="New clients (30 days)"
          subtitle="Unique subscribers with first subscription in period — from analytics API."
        >
          <Histogram variant="sky" items={clientGrowth} barHeightPx={112} formatValue={(n) => `${Math.round(n)}`} />
        </ChartPanel>
      )}

      {/* ── Search & filters ── */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-600-op" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQuery(input.trim());
                setMeta((m) => ({ ...m, page: 1 }));
              }
            }}
            placeholder="Search phone, name, email, MAC…"
            className="w-full rounded-xl border border-gold-10 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery(input.trim());
            setMeta((m) => ({ ...m, page: 1 }));
          }}
          className="rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
        >
          Search
        </button>
        <label className="inline-flex items-center gap-2.5 text-sm text-onyx-300 border border-gold-10 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-gold-20 transition-colors">
          <Filter className="w-4 h-4 text-gold" />
          <input type="checkbox" checked={activeOnly} onChange={(e) => { setActiveOnly(e.target.checked); setMeta((m) => ({ ...m, page: 1 })); }} className="w-4 h-4 rounded border-gold-30 bg-white/[0.04] text-gold focus:ring-gold/20" />
          Active only
        </label>
      </div>

      {/* ── Client table ── */}
      <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20 text-onyx-400">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-onyx-400 border-b border-white/[0.06]">
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Latest package</th>
                  <th className="px-5 py-3 font-semibold">Spend</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gold-10 flex items-center justify-center mx-auto mb-4">
                        <Users className="w-7 h-7 text-gold" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">No clients yet</h3>
                      <p className="text-sm text-onyx-400">Clients will appear here once they purchase WiFi.</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id} className="hover:bg-gold-5/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gold-10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-gold">{initials(c.name)}</span>
                          </div>
                          <div>
                            <div className="font-medium text-white">{c.name || "—"}</div>
                            <div className="text-xs text-onyx-400">{c.phone || c.email || "—"}</div>
                            {c.latestSession?.clientMac && (
                              <div className="text-[10px] font-mono text-onyx-500 mt-0.5">{c.latestSession.clientMac}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-onyx-300 bg-white/[0.04] px-2.5 py-1 rounded-lg">
                          {c.latestSubscription?.package?.name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-gold font-bold">{formatTzs(c.totalSpent)}</div>
                        <div className="text-xs text-onyx-400">{c.totalPayments} payments</div>
                      </td>
                      <td className="px-5 py-3">
                        {isSessionActive(c.latestSession, c.latestSubscription) ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold bg-white/[0.04] text-onyx-400 border border-white/[0.08]">
                            <span className="w-1.5 h-1.5 rounded-full bg-onyx-400" />
                            Idle
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/reseller/clients/${c.id}`} className="text-gold text-xs font-semibold inline-flex items-center gap-1 hover:underline">
                          Profile <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {meta.total > meta.limit && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-white/[0.06] text-xs text-onyx-400">
            <span>
              {meta.total} clients · page {meta.page}
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

      {/* ── Voucher modal ── */}
      {voucherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setVoucherOpen(false)}>
          <form
            onSubmit={createVouchers}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gold-20 bg-gradient-to-b from-onyx-900 to-onyx-950 p-6 space-y-4 shadow-2xl relative"
          >
            <button type="button" onClick={() => setVoucherOpen(false)} className="absolute top-4 right-4 text-onyx-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-10 flex items-center justify-center">
                <Ticket className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-bold text-white">Generate vouchers</h2>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Package</label>
              <select
                required
                value={vForm.packageId}
                onChange={(e) => setVForm((f) => ({ ...f, packageId: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              >
                <option value="">Select…</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Quantity</label>
              <input
                type="number"
                min={1}
                max={100}
                value={vForm.quantity}
                onChange={(e) => setVForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Note (optional)</label>
              <input
                value={vForm.note}
                onChange={(e) => setVForm((f) => ({ ...f, note: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setVoucherOpen(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-onyx-300 hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 transition-all">
                Generate
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

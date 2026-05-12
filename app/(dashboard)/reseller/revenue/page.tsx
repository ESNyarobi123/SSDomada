"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, BarChart3, List, RefreshCw, DollarSign, Wallet, Percent, Receipt } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";
import { ChartPanel, Histogram } from "@/components/reseller/ResellerCharts";

type PaymentRow = {
  id: string;
  amount: number;
  resellerAmount: number | null;
  platformFee: number | null;
  currency: string;
  status: string;
  paymentType: string;
  createdAt: string;
  completedAt: string | null;
  user: { name: string | null; phone: string | null; email: string | null };
  subscription: { package: { name: string } } | null;
};

type ListPayload = {
  payments: PaymentRow[];
  summary: { totalRevenue: number; myEarnings: number; commission: number; totalTransactions: number };
};

export default function ResellerRevenuePage() {
  const [view, setView] = useState<"list" | "chart">("list");
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<ListPayload["summary"] | null>(null);
  const [chart, setChart] = useState<{ date: string; revenue: number; earnings: number; commission: number; count: number }[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 30, total: 0 });
  const [status, setStatus] = useState("");
  const [packageId, setPackageId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await resellerJson<Array<{ id: string; name: string }>>("/api/v1/reseller/packages");
      if (r.ok && r.data) setPackages(r.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    })();
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    q.set("view", "list");
    if (status) q.set("status", status);
    if (packageId) q.set("packageId", packageId);
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    const r = await resellerJson<ListPayload>(`/api/v1/reseller/payments?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setRows(r.data!.payments);
      setSummary(r.data!.summary);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, status, packageId, startDate, endDate]);

  const loadChart = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("view", "chart");
    if (status) q.set("status", status);
    if (packageId) q.set("packageId", packageId);
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    const r = await resellerJson<{ chart: typeof chart }>(`/api/v1/reseller/payments?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else setChart(r.data!.chart || []);
    setLoading(false);
  }, [status, packageId, startDate, endDate]);

  useEffect(() => {
    if (view === "list") void loadList();
    else void loadChart();
  }, [view, loadList, loadChart]);

  const chartItems = chart.slice(-45).map((c) => ({
    label: c.date.slice(5),
    value: c.revenue,
    title: `${c.date}: ${formatTzsCompact(c.revenue)} · ${c.count} tx · you ${formatTzsCompact(c.earnings)}`,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Revenue & payments</h1>
        <p className="text-onyx-400 mt-1">Every payment from your portal, with commission and your net share.</p>
      </div>

      {/* ── Summary cards ── */}
      {summary && view === "list" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total revenue</span>
            </div>
            <div className="text-xl font-black text-white">{formatTzsCompact(summary.totalRevenue)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Your earnings</span>
            </div>
            <div className="text-xl font-black text-gold">{formatTzsCompact(summary.myEarnings)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Commission</span>
            </div>
            <div className="text-xl font-black text-white">{formatTzsCompact(summary.commission)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Transactions</span>
            </div>
            <div className="text-xl font-black text-white">{summary.totalTransactions}</div>
          </div>
        </div>
      )}

      {/* ── Tab toggle & filters ── */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex rounded-xl border border-gold-10 overflow-hidden">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-4 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors ${view === "list" ? "bg-gold-10 text-gold" : "text-onyx-400 hover:text-onyx-200"}`}
          >
            <List className="w-4 h-4" />
            List
          </button>
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-4 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors ${view === "chart" ? "bg-gold-10 text-gold" : "text-onyx-400 hover:text-onyx-200"}`}
          >
            <BarChart3 className="w-4 h-4" />
            Daily chart
          </button>
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setMeta((m) => ({ ...m, page: 1 }));
          }}
          className="rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-gold-30 outline-none transition-colors"
        >
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
        <select
          value={packageId}
          onChange={(e) => {
            setPackageId(e.target.value);
            setMeta((m) => ({ ...m, page: 1 }));
          }}
          className="rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2.5 text-sm text-white min-w-[10rem] focus:border-gold-30 outline-none transition-colors"
        >
          <option value="">All packages</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-gold-30 outline-none transition-colors"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-gold-30 outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => (view === "list" ? void loadList() : void loadChart())}
          className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : view === "chart" ? (
        <ChartPanel
          title="Gross revenue per day"
          subtitle="Completed payments only. Respects status, package, and date filters above. Up to 45 days shown."
        >
          <Histogram items={chartItems} barHeightPx={140} />
        </ChartPanel>
      ) : (
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-onyx-400 border-b border-white/[0.06]">
                <th className="px-5 py-3 font-semibold">When</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Package</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Gross</th>
                <th className="px-5 py-3 font-semibold text-right">You</th>
                <th className="px-5 py-3 font-semibold text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-gold-5/30 transition-colors">
                  <td className="px-5 py-2.5 text-xs text-onyx-400 whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 text-white">{p.user?.name || p.user?.phone || "—"}</td>
                  <td className="px-5 py-2.5">
                    <span className="inline-flex items-center text-xs text-onyx-300 bg-white/[0.04] px-2.5 py-1 rounded-lg">
                      {p.subscription?.package?.name || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                      p.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : p.status === "PENDING"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/15"
                        : "bg-red-500/10 text-red-400 border-red-500/15"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        p.status === "COMPLETED" ? "bg-emerald-400" : p.status === "PENDING" ? "bg-amber-400" : "bg-red-400"
                      }`} />
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold text-white">{formatTzs(p.amount)}</td>
                  <td className="px-5 py-2.5 text-right text-gold font-bold">{formatTzs(p.resellerAmount ?? 0)}</td>
                  <td className="px-5 py-2.5 text-right text-onyx-400">{formatTzs(p.platformFee ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta.total > meta.limit && (
            <div className="flex justify-between items-center px-5 py-3 border-t border-white/[0.06] text-xs text-onyx-400">
              <span>
                {meta.total} rows · page {meta.page}
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

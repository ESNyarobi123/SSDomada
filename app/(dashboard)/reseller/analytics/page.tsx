"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Download, TrendingUp, Users, Package, Clock, RefreshCw, DollarSign, Wallet, Percent } from "lucide-react";
import { authFetch } from "@/lib/auth-client";
import { resellerJson } from "@/lib/reseller-fetch";
import { formatTzsCompact } from "@/lib/format-currency";
import { Histogram, RankedBars } from "@/components/reseller/ResellerCharts";

type Period = "7d" | "30d" | "90d" | "1y";
type AnalyticsTab = "revenue" | "clients" | "packages" | "usage";

type RevenuePayload = {
  chart: { date: string; revenue: number; earnings: number; count: number }[];
  totals: Record<string, number>;
};
type ClientsPayload = { chart: { date: string; newClients: number }[]; totalUniqueClients: number };
type PackagesPayload = {
  packages: {
    id: string;
    name: string;
    revenue: number;
    salesInPeriod: number;
    _count: { subscriptions: number };
  }[];
};
type UsagePayload = { peakHours: { hour: number; sessions: number; dataMb: number }[]; totalSessions: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function payloadForTab(tab: AnalyticsTab, payload: unknown): unknown {
  if (!isRecord(payload)) return null;
  if (tab === "revenue" && Array.isArray(payload.chart) && isRecord(payload.totals)) return payload;
  if (tab === "clients" && Array.isArray(payload.chart) && typeof payload.totalUniqueClients === "number") {
    return payload;
  }
  if (tab === "packages" && Array.isArray(payload.packages)) return payload;
  if (tab === "usage" && Array.isArray(payload.peakHours)) return payload;
  return null;
}

export default function ResellerAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [tab, setTab] = useState<AnalyticsTab>("revenue");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setPayload(null);
    const r = await resellerJson<unknown>(`/api/v1/reseller/analytics?type=${tab}&period=${period}`);
    if (!r.ok) {
      setErr(r.error || "Failed");
      setPayload(null);
    } else setPayload(r.data);
    setLoading(false);
  }, [tab, period]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectTab(next: AnalyticsTab) {
    if (next === tab) return;
    setTab(next);
    setPayload(null);
    setErr(null);
    setLoading(true);
  }

  function selectPeriod(next: Period) {
    if (next === period) return;
    setPeriod(next);
    setPayload(null);
    setErr(null);
    setLoading(true);
  }

  const tabPayload = payloadForTab(tab, payload);

  async function exportCsv() {
    const res = await authFetch(`/api/v1/reseller/analytics?type=export&period=${period}`);
    if (!res.ok) {
      setErr("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Reports & analytics</h1>
          <p className="text-onyx-400 mt-1">Revenue curves, client growth, package performance, and peak WiFi hours.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={period}
            onChange={(e) => selectPeriod(e.target.value as Period)}
            className="rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-gold-30 outline-none transition-colors"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Tab pills ── */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["revenue", "Revenue", TrendingUp],
            ["clients", "Clients", Users],
            ["packages", "Packages", Package],
            ["usage", "Peak hours", Clock],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border transition-all ${
              tab === id
                ? "bg-gold-10 text-gold border-gold-30 shadow-sm shadow-gold/5"
                : "border-gold-10 text-onyx-400 hover:border-gold-20 hover:text-onyx-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Chart container ── */}
      <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-6 min-h-[320px]">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        )}
        {!loading && tab === "revenue" && tabPayload ? (
          <RevenueView data={tabPayload as RevenuePayload} />
        ) : null}
        {!loading && tab === "clients" && tabPayload ? (
          <ClientsView data={tabPayload as ClientsPayload} />
        ) : null}
        {!loading && tab === "packages" && tabPayload ? (
          <PackagesView data={tabPayload as PackagesPayload} />
        ) : null}
        {!loading && tab === "usage" && tabPayload ? (
          <UsageView data={tabPayload as UsagePayload} />
        ) : null}
        {!loading && !tabPayload && !err ? (
          <p className="text-sm text-onyx-500 py-12 text-center">No analytics data for this period.</p>
        ) : null}
      </div>
    </div>
  );
}

function RevenueView({ data }: { data: RevenuePayload }) {
  const chart = data.chart ?? [];
  const items = chart.map((c) => ({
    label: c.date.slice(5),
    value: c.revenue,
    title: `${c.date}: ${formatTzsCompact(c.revenue)} · ${c.count} tx`,
  }));
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Revenue</span>
          </div>
          <div className="text-xl font-black text-white">{formatTzsCompact(data.totals.revenue)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Your share</span>
          </div>
          <div className="text-xl font-black text-gold">{formatTzsCompact(data.totals.earnings)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Commission</span>
          </div>
          <div className="text-xl font-black text-white">{formatTzsCompact(data.totals.commission)}</div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Daily gross revenue</h3>
        <p className="text-xs text-onyx-400 mb-4">Daily totals for the period you selected above.</p>
        <Histogram items={items} barHeightPx={128} />
      </div>
    </div>
  );
}

function ClientsView({ data }: { data: ClientsPayload }) {
  const chart = data.chart ?? [];
  const items = chart.map((c) => ({
    label: c.date.slice(5),
    value: c.newClients,
    title: `${c.date}: ${c.newClients} new`,
  }));
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4 inline-flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <Users className="w-3.5 h-3.5 text-sky-400" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Unique subscribers (all time)</span>
          <div className="text-xl font-black text-white">{data.totalUniqueClients}</div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white mb-1">New clients per day</h3>
        <p className="text-xs text-onyx-400 mb-4">First-time buyers in the selected window.</p>
        <Histogram variant="sky" items={items} barHeightPx={120} formatValue={(n) => `${Math.round(n)}`} />
      </div>
    </div>
  );
}

function PackagesView({ data }: { data: PackagesPayload }) {
  const packages = data.packages ?? [];
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Revenue in period</h3>
        <p className="text-xs text-onyx-400 mb-4">Best-selling plans in the period you selected.</p>
        <RankedBars
          rows={packages.map((p) => ({
            name: p.name,
            value: p.revenue,
            hint: `${p.salesInPeriod} sales in period · ${p._count.subscriptions} subscribers`,
          }))}
        />
      </div>
      <div className="rounded-xl border border-gold-10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-onyx-400 border-b border-white/[0.06]">
              <th className="px-5 py-3 font-semibold">Package</th>
              <th className="px-5 py-3 font-semibold">Subs</th>
              <th className="px-5 py-3 font-semibold">Sales (period)</th>
              <th className="px-5 py-3 font-semibold text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {packages.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-onyx-500">
                  No package sales in this period.
                </td>
              </tr>
            ) : (
              packages.map((p) => (
              <tr key={p.id} className="hover:bg-gold-5/30 transition-colors">
                <td className="px-5 py-2.5 font-medium text-white">{p.name}</td>
                <td className="px-5 py-2.5 text-onyx-300">{p._count?.subscriptions ?? 0}</td>
                <td className="px-5 py-2.5 text-onyx-300">{p.salesInPeriod}</td>
                <td className="px-5 py-2.5 text-right text-gold font-bold">{formatTzsCompact(p.revenue)}</td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsageView({ data }: { data: UsagePayload }) {
  const peakHours = data.peakHours ?? [];
  const items = [...peakHours]
    .sort((a, b) => a.hour - b.hour)
    .map((h) => ({
      label: String(h.hour).padStart(2, "0"),
      value: h.sessions,
      title: `${String(h.hour).padStart(2, "0")}:00 — ${h.sessions} sessions · ${Math.round(h.dataMb)} MB`,
    }));
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4 inline-flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Clock className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Sessions in period</span>
          <div className="text-xl font-black text-white">{data.totalSessions}</div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Sessions by hour of day</h3>
        <p className="text-xs text-onyx-400 mb-4">When customers connect most often (24-hour view).</p>
        <Histogram variant="violet" items={items} barHeightPx={100} formatValue={(n) => `${Math.round(n)}`} />
      </div>
    </div>
  );
}

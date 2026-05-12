"use client";

import { useEffect, useState } from "react";
import { Loader2, DollarSign, Users, Receipt, TrendingUp } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { formatTzsCompact } from "@/lib/format-currency";
import { Histogram, RankedBars } from "@/components/reseller/ResellerCharts";

type Overview = {
  period: string;
  revenue: {
    totalAmount: number;
    platformFee: number;
    resellerShare: number;
    transactionCount: number;
    averageTransaction: number;
  };
  topResellers: Array<{
    resellerId: string;
    _sum: { amount: number; platformFee: number };
    _count: number;
    reseller?: { companyName: string; brandSlug: string };
  }>;
  newCustomers: number;
  paymentTypeBreakdown: Record<string, { count: number; amount: number }>;
};

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [daily, setDaily] = useState<{ date: string; amount: number; commission: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const [o, r] = await Promise.all([
        adminJson<Overview>(`/api/v1/admin/analytics?type=overview&period=${period}`),
        adminJson<{ daily: typeof daily }>(`/api/v1/admin/analytics?type=revenue&period=${period}`),
      ]);
      if (!o.ok) setErr(o.error || "Failed");
      else setOverview(o.data!);
      if (r.ok && r.data?.daily) setDaily(r.data.daily.slice(-28));
      else setDaily([]);
      setLoading(false);
    })();
  }, [period]);

  const hist = daily.map((d) => ({
    label: d.date.slice(5),
    value: d.amount,
    title: `${d.date}: ${formatTzsCompact(d.amount)}`,
  }));

  const ranked =
    overview?.topResellers?.map((t) => ({
      name: t.reseller?.companyName || t.resellerId.slice(0, 8),
      value: t._sum.amount,
    })) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white md:text-4xl">Analytics</h1>
          <p className="mt-1 text-onyx-400">Platform revenue, reseller ranking, and payment mix from admin APIs.</p>
        </div>
        <div className="flex rounded-xl border border-gold-10 overflow-hidden">
          {["7d", "30d", "90d", "1y"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 text-xs font-bold transition-colors ${
                period === p ? "bg-gold-10 text-gold" : "text-onyx-400 hover:text-onyx-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {loading || !overview ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-60" />
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-gold" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Gross volume</span>
              </div>
              <div className="text-xl font-black text-white">{formatTzsCompact(overview.revenue.totalAmount)}</div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Platform fees</span>
              </div>
              <div className="text-xl font-black text-gold">{formatTzsCompact(overview.revenue.platformFee)}</div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">New customers</span>
              </div>
              <div className="text-xl font-black text-white">{overview.newCustomers}</div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Receipt className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Transactions</span>
              </div>
              <div className="text-xl font-black text-white">{overview.revenue.transactionCount}</div>
            </div>
          </div>

          {/* ── Daily revenue chart ── */}
          <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Daily revenue</h2>
            {hist.length === 0 ? <p className="text-sm text-onyx-500">No data.</p> : <Histogram items={hist} barHeightPx={120} />}
          </div>

          {/* ── Top resellers ── */}
          <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Top resellers (period)</h2>
            <RankedBars rows={ranked} maxRows={10} />
          </div>

          {/* ── Payment types ── */}
          <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Payment types</h2>
            <ul className="space-y-2 text-sm">
              {Object.entries(overview.paymentTypeBreakdown).map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-white/[0.06] py-2">
                  <span className="text-onyx-300">{k}</span>
                  <span className="text-gold font-semibold">
                    {v.count} · {formatTzsCompact(v.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

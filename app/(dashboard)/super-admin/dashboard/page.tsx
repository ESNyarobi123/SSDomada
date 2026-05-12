"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, TrendingUp, Store, Router, Users, Wallet, Activity, ArrowRight, DollarSign, Calendar, Clock, Zap, Shield, CreditCard } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";
import { ChartPanel, Histogram, StackedStrip, type HistItem } from "@/components/reseller/ResellerCharts";

type DashboardData = {
  revenue: {
    today: { amount: number; commission: number; count: number };
    week: { amount: number; commission: number; count: number };
    month: { amount: number; commission: number; count: number };
    year: { amount: number; commission: number; count: number };
    allTime: { amount: number; commission: number; resellerShare: number; count: number };
  };
  resellers: { total: number; active: number; suspended: number };
  devices: { total: number; online: number; offline: number };
  clients: { activeSubscriptions: number; totalCustomers: number };
  financial: {
    platformEarnings: number;
    pendingWithdrawals: { count: number; amount: number };
    totalPayouts: { count: number; amount: number };
  };
  recentActivity: {
    payments: Array<{
      id: string;
      amount: number;
      currency: string;
      paymentType: string;
      completedAt: string | null;
      reseller: { companyName: string } | null;
      user: { name: string | null; phone: string | null };
    }>;
    newResellers: Array<{
      id: string;
      companyName: string;
      brandSlug: string;
      isActive: boolean;
      createdAt: string;
      _count: { devices: number };
    }>;
  };
};

type HealthData = {
  section?: string;
  checks: Record<string, { status: string; latency?: number; message?: string }>;
  stats: { totalResellers: number; totalDevices: number; totalPayments: number; pendingWithdrawals: number };
  timestamp: string;
};

export default function SuperAdminDashboardPage() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [revenueHist, setRevenueHist] = useState<HistItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      const [dRes, hRes, revRes] = await Promise.all([
        adminJson<DashboardData>("/api/v1/admin/dashboard"),
        adminJson<HealthData>("/api/v1/admin/settings?section=health"),
        adminJson<{ daily: { date: string; amount: number; commission: number; count: number }[] }>(
          "/api/v1/admin/analytics?type=revenue&period=30d"
        ),
      ]);
      if (!dRes.ok) {
        setErr(dRes.error || "Failed to load dashboard");
        return;
      }
      setDash(dRes.data!);
      if (hRes.ok && hRes.data) setHealth(hRes.data);
      if (revRes.ok && revRes.data?.daily?.length) {
        const slice = revRes.data.daily.slice(-21);
        setRevenueHist(
          slice.map((x) => ({
            label: x.date.slice(5),
            value: x.amount,
            title: `${x.date}: ${formatTzsCompact(x.amount)} · ${x.count} tx`,
          }))
        );
      } else setRevenueHist([]);
    })();
  }, []);

  if (err) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        {err}
        <p className="mt-2 text-sm text-onyx-400">Ensure you are signed in as SUPER_ADMIN.</p>
      </div>
    );
  }
  if (!dash) {
    return (
      <div className="flex items-center gap-3 py-24 text-onyx-400">
        <Loader2 className="h-8 w-8 animate-spin text-rose-300" />
        Loading control center…
      </div>
    );
  }

  const omada = health?.checks?.omadaController;
  const dbOk = health?.checks?.database?.status === "healthy";
  const pendingDev = Math.max(0, dash.devices.total - dash.devices.online - dash.devices.offline);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Dashboard overview</h1>
          <p className="mt-1 text-onyx-400">Live aggregates from your billing database and controller health checks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/super-admin/payouts"
            className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-bold text-gold hover:bg-gold-20 transition-all"
          >
            <Wallet className="h-4 w-4" />
            Withdrawals
          </Link>
          <Link
            href="/super-admin/resellers"
            className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            Resellers <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── Revenue cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-60" />
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Revenue today</span>
          </div>
          <div className="text-xl font-black text-white">{formatTzsCompact(dash.revenue.today.amount)}</div>
          <div className="text-xs text-onyx-400 mt-1">{dash.revenue.today.count} payments</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">This week</span>
          </div>
          <div className="text-xl font-black text-white">{formatTzsCompact(dash.revenue.week.amount)}</div>
          <div className="text-xs text-onyx-400 mt-1">Commission {formatTzsCompact(dash.revenue.week.commission)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">This month</span>
          </div>
          <div className="text-xl font-black text-white">{formatTzsCompact(dash.revenue.month.amount)}</div>
          <div className="text-xs text-onyx-400 mt-1">Year: {formatTzsCompact(dash.revenue.year.amount)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">All time gross</span>
          </div>
          <div className="text-xl font-black text-gold">{formatTzsCompact(dash.revenue.allTime.amount)}</div>
          <div className="text-xs text-onyx-400 mt-1">Platform fees {formatTzsCompact(dash.revenue.allTime.commission)}</div>
        </div>
      </div>

      {/* ── Revenue chart + Health ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <TrendingUp className="h-5 w-5 text-gold" />
              Revenue trend
            </h2>
            <span className="text-xs text-onyx-400">Last ~30 days · completed payments</span>
          </div>
          {revenueHist.length === 0 ? (
            <p className="text-sm text-onyx-500">No chart data in this window.</p>
          ) : (
            <Histogram items={revenueHist} barHeightPx={120} />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-20 to-transparent opacity-50" />
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gold-600-op">
              <Shield className="h-4 w-4 text-gold" />
              System health
            </h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-onyx-400">Database</span>
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                  dbOk ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/15"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbOk ? "bg-emerald-400" : "bg-red-400"}`} />
                  {dbOk ? "Healthy" : "Issue"}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-onyx-400">Omada controller</span>
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                  omada?.status === "connected" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${omada?.status === "connected" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {omada?.status === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>
              {omada?.message && <p className="text-xs text-onyx-500">{omada.message}</p>}
            </div>
          </div>

          <ChartPanel title="Device posture" subtitle="All APs in the platform (from device registry).">
            <StackedStrip
              segments={[
                { key: "on", value: dash.devices.online, className: "bg-emerald-500", label: "Online" },
                { key: "off", value: dash.devices.offline, className: "bg-amber-500", label: "Offline" },
                { key: "pend", value: pendingDev, className: "bg-sky-500", label: "Other" },
              ]}
            />
          </ChartPanel>
        </div>
      </div>

      {/* ── Entity cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
              <Store className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Resellers</span>
          </div>
          <div className="text-2xl font-black text-white">
            {dash.resellers.active}
            <span className="text-lg text-onyx-400">/{dash.resellers.total}</span>
          </div>
          <div className="text-xs text-onyx-400 mt-1">{dash.resellers.suspended} suspended</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Router className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Devices</span>
          </div>
          <div className="text-2xl font-black text-white">{dash.devices.total}</div>
          <div className="text-xs text-onyx-400 mt-1">{dash.devices.online} online</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">WiFi clients</span>
          </div>
          <div className="text-2xl font-black text-white">{dash.clients.activeSubscriptions}</div>
          <div className="text-xs text-onyx-400 mt-1">{dash.clients.totalCustomers} registered end users</div>
        </div>
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-60" />
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Pending withdrawals</span>
          </div>
          <div className="text-2xl font-black text-white">{dash.financial.pendingWithdrawals.count}</div>
          <div className="text-sm font-bold text-gold">{formatTzs(dash.financial.pendingWithdrawals.amount)}</div>
        </div>
      </div>

      {/* ── Recent activity tables ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gold-600-op">
              <CreditCard className="w-4 h-4 text-gold" />
              Recent payments
            </h2>
            <Link href="/super-admin/payments" className="text-xs font-semibold text-gold hover:underline">
              View all
            </Link>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/[0.04]">
                {dash.recentActivity.payments.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-onyx-500">No payments yet.</td>
                  </tr>
                ) : (
                  dash.recentActivity.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gold-5/20 transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="font-medium text-white">{p.reseller?.companyName || "—"}</div>
                        <div className="text-xs text-onyx-400">{p.user?.name || p.user?.phone || "—"}</div>
                      </td>
                      <td className="px-5 py-2.5 text-right font-bold text-gold">{formatTzs(p.amount)}</td>
                      <td className="px-5 py-2.5 text-right text-xs text-onyx-400 whitespace-nowrap">
                        {p.completedAt ? new Date(p.completedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gold-600-op">
              <Store className="w-4 h-4 text-gold" />
              New resellers
            </h2>
            <Link href="/super-admin/resellers" className="text-xs font-semibold text-gold hover:underline">
              Manage
            </Link>
          </div>
          <ul className="max-h-72 divide-y divide-white/[0.04] overflow-y-auto">
            {dash.recentActivity.newResellers.length === 0 ? (
              <li className="px-5 py-8 text-center text-onyx-500">No resellers yet.</li>
            ) : (
              dash.recentActivity.newResellers.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-gold-5/20 transition-colors">
                  <div>
                    <div className="font-medium text-white">{r.companyName}</div>
                    <div className="text-xs text-onyx-400 font-mono">@{r.brandSlug}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                    r.isActive
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${r.isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                    {r.isActive ? "Active" : "Off"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

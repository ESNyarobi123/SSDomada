"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  TrendingUp,
  Users,
  Router,
  Wallet,
  Banknote,
  ArrowUpRight,
  Package,
  BarChart3,
  SlidersHorizontal,
  Wifi,
  Zap,
  CircleDot,
  Clock,
} from "lucide-react";
import { authFetch } from "@/lib/auth-client";
import { resellerJson } from "@/lib/reseller-fetch";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";
import { ChartPanel, Histogram, RankedBars, StackedStrip, type HistItem } from "@/components/reseller/ResellerCharts";

type Dash = {
  revenue: {
    today: { total: number; earnings: number; count: number };
    week: { total: number; earnings: number; count: number };
    month: { total: number; earnings: number; count: number };
    allTime: {
      total: number;
      earnings: number;
      commission: number;
      count: number;
    };
  };
  clients: { activeNow: number; newThisMonth: number };
  devices: { total: number; online: number; offline: number };
  wallet: { balance: number; totalEarnings: number; commissionRate: number; currency: string };
  pendingWithdrawals: { count: number; amount: number };
  recentPayments: Array<{
    id: string;
    amount: number;
    resellerAmount: number | null;
    currency: string;
    paymentType: string;
    customerPhone: string | null;
    completedAt: string | null;
    user: { name: string | null; phone: string | null };
  }>;
  popularPackages: Array<{
    id: string;
    name: string;
    price: number;
    duration: string;
    _count: { subscriptions: number };
  }>;
  packagesSummary: { total: number; active: number };
  subscriptionStats: { activePaid: number; suspended: number; expiredOrCancelled: number };
  recentSubscriptions: Array<{
    id: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    user: { name: string | null; phone: string | null };
    package: { name: string; price: number };
  }>;
};

export default function ResellerDashboardPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<HistItem[]>([]);

  useEffect(() => {
    (async () => {
      const [dashRes, trendRes] = await Promise.all([
        authFetch("/api/v1/reseller/dashboard"),
        resellerJson<{ chart: { date: string; revenue: number; count: number }[] }>(
          "/api/v1/reseller/analytics?type=revenue&period=7d"
        ),
      ]);
      const json = await dashRes.json();
      if (!dashRes.ok) {
        setErr(json.error || "Failed to load");
        return;
      }
      setD(json.data);
      if (trendRes.ok && trendRes.data?.chart?.length) {
        const slice = trendRes.data.chart.slice(-14);
        setRevenueTrend(
          slice.map((c) => ({
            label: c.date.slice(5),
            value: c.revenue,
            title: `${c.date}: ${formatTzsCompact(c.revenue)} · ${c.count} tx`,
          }))
        );
      } else setRevenueTrend([]);
    })();
  }, []);

  if (err) {
    return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{err}</div>;
  }
  if (!d) {
    return (
      <div className="flex items-center gap-3 text-onyx-400 py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        Loading dashboard…
      </div>
    );
  }

  const pendingAp = Math.max(0, d.devices.total - d.devices.online - d.devices.offline);
  const maxRev = Math.max(d.revenue.today.total, d.revenue.week.total, d.revenue.month.total, 1);
  const bars = [
    { label: "Today", value: d.revenue.today.total, earnings: d.revenue.today.earnings },
    { label: "Week", value: d.revenue.week.total, earnings: d.revenue.week.earnings },
    { label: "Month", value: d.revenue.month.total, earnings: d.revenue.month.earnings },
  ];

  const onlinePct = d.devices.total > 0 ? Math.round((d.devices.online / d.devices.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Dashboard</h1>
          <p className="text-onyx-400 mt-1">Revenue, clients, and network health at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/reseller/packages", icon: Package, label: "Packages" },
            { href: "/reseller/analytics", icon: BarChart3, label: "Analytics" },
            { href: "/reseller/ssids", icon: Wifi, label: "SSIDs" },
            { href: "/reseller/settings", icon: SlidersHorizontal, label: "Settings" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-5/50 px-4 py-2 text-sm font-semibold text-onyx-200 hover:bg-gold-10 hover:border-gold-20 transition-all"
            >
              <l.icon className="w-4 h-4 text-gold" />
              {l.label}
            </Link>
          ))}
          <Link
            href="/reseller/devices"
            className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            Devices <ArrowUpRight className="w-4 h-4" />
          </Link>
          <Link
            href="/reseller/withdrawals"
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Wallet className="w-4 h-4" />
            Withdraw
          </Link>
        </div>
      </div>

      {/* ── Revenue strip — gold accent cards ── */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: "Revenue today", icon: Zap, gross: d.revenue.today.total, net: d.revenue.today.earnings, n: d.revenue.today.count },
          { label: "This week", icon: TrendingUp, gross: d.revenue.week.total, net: d.revenue.week.earnings, n: d.revenue.week.count },
          { label: "This month", icon: BarChart3, gross: d.revenue.month.total, net: d.revenue.month.earnings, n: d.revenue.month.count },
        ].map((x) => (
          <div key={x.label} className="group relative rounded-2xl border border-gold-15 bg-gradient-to-br from-gold-5/60 via-transparent to-transparent p-5 hover:border-gold-30 hover:shadow-lg hover:shadow-gold/5 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-60" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center group-hover:bg-gold-20 transition-colors">
                <x.icon className="w-4 h-4 text-gold" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-600-op">{x.label}</div>
            </div>
            <div className="text-2xl font-black text-white">{formatTzsCompact(x.gross)}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-semibold text-gold">You keep</span>
              <span className="text-xs font-bold text-gold">{formatTzsCompact(x.net)}</span>
            </div>
            <div className="text-[11px] text-onyx-400 mt-2">{x.n} completed payments</div>
          </div>
        ))}
      </div>

      {/* ── Key metrics — wallet + stats ── */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Wallet — hero card with gold gradient */}
        <div className="sm:col-span-2 xl:col-span-1 rounded-2xl border border-gold-30 bg-gradient-to-br from-gold/10 via-gold-5/30 to-transparent p-5 relative overflow-hidden group hover:shadow-xl hover:shadow-gold/10 transition-all duration-300">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-gold/10 rounded-full blur-3xl group-hover:bg-gold/15 transition-colors" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gold/5 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-gold" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-600-op">Wallet balance</div>
            </div>
            <div className="text-3xl font-black text-gradient">{formatTzsCompact(d.wallet.balance)}</div>
            <div className="text-xs text-onyx-300 mt-2">Total earned · <span className="text-gold">{formatTzsCompact(d.wallet.totalEarnings)}</span></div>
          </div>
        </div>

        {/* Active subscribers */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 group hover:border-white/[0.15] transition-all duration-300">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-onyx-400">Active subscribers</div>
          </div>
          <div className="text-3xl font-black text-white">{d.clients.activeNow}</div>
          <div className="text-xs text-emerald-400 mt-2 font-medium">+{d.clients.newThisMonth} new this month</div>
        </div>

        {/* Access points — with status bar */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 group hover:border-white/[0.15] transition-all duration-300">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <Router className="w-5 h-5 text-sky-400" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-onyx-400">Access points</div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">{d.devices.online}</span>
            <span className="text-lg text-onyx-400">/{d.devices.total}</span>
            <span className="ml-auto text-xs font-semibold text-emerald-400">{onlinePct}%</span>
          </div>
          {/* Status bar */}
          <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${onlinePct}%` }} />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <CircleDot className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-onyx-400">{d.devices.offline} offline</span>
          </div>
        </div>

        {/* Pending withdrawals */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 group hover:border-white/[0.15] transition-all duration-300">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-onyx-400">Pending withdrawals</div>
          </div>
          <div className="text-3xl font-black text-white">{d.pendingWithdrawals.count}</div>
          <div className="text-xs text-gold mt-2 font-semibold">{formatTzs(d.pendingWithdrawals.amount)}</div>
        </div>
      </div>

      {/* ── Wi‑Fi catalog & subscriptions ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-gold" />
              Wi‑Fi packages
            </h2>
            <Link href="/reseller/packages" className="text-xs font-semibold text-gold hover:underline">
              Manage
            </Link>
          </div>
          <div className="flex gap-6 text-sm mb-4">
            <div>
              <div className="text-onyx-500 text-xs uppercase">In catalog</div>
              <div className="text-2xl font-black text-white">{d.packagesSummary?.total ?? 0}</div>
            </div>
            <div>
              <div className="text-onyx-500 text-xs uppercase">Active offers</div>
              <div className="text-2xl font-black text-gold">{d.packagesSummary?.active ?? 0}</div>
            </div>
          </div>
          <p className="text-xs text-onyx-500">
            Plans you sell on your WiFi login page. Manage prices and duration under Packages.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Customer subscriptions
            </h2>
            <Link href="/reseller/clients" className="text-xs font-semibold text-gold hover:underline">
              Clients
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-2">
              <div className="text-emerald-400 font-bold text-lg">{d.subscriptionStats?.activePaid ?? 0}</div>
              <div className="text-onyx-500">Active</div>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 py-2">
              <div className="text-sky-300 font-bold text-lg">{d.subscriptionStats?.suspended ?? 0}</div>
              <div className="text-onyx-500">Suspended</div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-2">
              <div className="text-amber-300 font-bold text-lg">{d.subscriptionStats?.expiredOrCancelled ?? 0}</div>
              <div className="text-onyx-500">Ended</div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            <div className="text-[10px] font-bold uppercase text-onyx-500 mb-2">Recently updated</div>
            <ul className="space-y-2 max-h-40 overflow-y-auto text-sm">
              {(d.recentSubscriptions ?? []).length === 0 ? (
                <li className="text-onyx-500">No subscriptions yet.</li>
              ) : (
                (d.recentSubscriptions ?? []).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 text-onyx-300">
                    <span className="truncate text-white">{s.user.name || s.user.phone || "—"}</span>
                    <span className="shrink-0 text-[10px] uppercase text-gold">{s.status}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Charts section ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue pulse */}
          <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-20 to-transparent" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-gold" />
                </div>
                Revenue pulse
              </h2>
              <span className="text-xs text-onyx-400 bg-white/[0.04] px-3 py-1 rounded-full">Gross volume</span>
            </div>
            <div className="flex items-end justify-between gap-4 h-40 px-2">
              {bars.map((b) => (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end h-32">
                    <div
                      className="w-full max-w-[4rem] rounded-t-lg bg-gradient-to-t from-gold/20 to-gold/80 transition-all hover:from-gold/30 hover:to-gold"
                      style={{ height: `${Math.max(8, (b.value / maxRev) * 100)}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-onyx-400 uppercase">{b.label}</div>
                    <div className="text-sm font-bold text-white mt-0.5">{formatTzsCompact(b.value)}</div>
                    <div className="text-[10px] text-gold font-medium">You · {formatTzsCompact(b.earnings)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-onyx-400 text-xs">All-time gross</span>
                <div className="font-bold text-white mt-0.5">{formatTzs(d.revenue.allTime.total)}</div>
              </div>
              <div>
                <span className="text-onyx-400 text-xs">Your share</span>
                <div className="font-bold text-gold mt-0.5">{formatTzs(d.revenue.allTime.earnings)}</div>
              </div>
              <div>
                <span className="text-onyx-400 text-xs">Platform fee ({Math.round(d.wallet.commissionRate * 100)}%)</span>
                <div className="font-bold text-onyx-300 mt-0.5">{formatTzs(d.revenue.allTime.commission)}</div>
              </div>
            </div>
          </div>

          {revenueTrend.length > 0 && (
            <ChartPanel
              title="Daily gross revenue"
              subtitle="Completed sales over the last 7 days."
            >
              <Histogram items={revenueTrend} barHeightPx={112} />
            </ChartPanel>
          )}

          <ChartPanel
            title="Access point posture"
            subtitle="How many access points are online right now."
          >
            <StackedStrip
              segments={[
                { key: "on", value: d.devices.online, className: "bg-emerald-500", label: "Online" },
                { key: "off", value: d.devices.offline, className: "bg-amber-500", label: "Offline" },
                { key: "pend", value: pendingAp, className: "bg-sky-500", label: "Other / pending" },
              ]}
            />
          </ChartPanel>
        </div>

        <ChartPanel title="Top packages" subtitle="Most popular plans by active subscribers.">
          {d.popularPackages.length === 0 ? (
            <p className="text-sm text-onyx-500">No packages yet.</p>
          ) : (
            <RankedBars
              rows={d.popularPackages.map((p) => ({
                name: p.name,
                value: p._count.subscriptions,
                hint: `${p._count.subscriptions} active subs`,
              }))}
              formatValue={(n) => `${Math.round(n)} subs`}
            />
          )}
        </ChartPanel>
      </div>

      {/* ── Recent payments table ── */}
      <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-gold" />
            Recent payments
          </h2>
          <Link href="/reseller/revenue" className="text-xs text-gold font-semibold hover:underline flex items-center gap-1">
            View revenue <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-onyx-400 border-b border-white/[0.06]">
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold">Method</th>
                <th className="px-6 py-3 font-semibold text-right">Amount</th>
                <th className="px-6 py-3 font-semibold text-right">Your cut</th>
                <th className="px-6 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {d.recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-onyx-400">
                    No payments yet. Share your captive portal link to start selling.
                  </td>
                </tr>
              ) : (
                d.recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gold-5/30 transition-colors">
                    <td className="px-6 py-3 text-white font-medium">
                      {p.user.name || p.user.phone || p.customerPhone || "—"}
                    </td>
                    <td className="px-6 py-3 text-onyx-300">{p.paymentType}</td>
                    <td className="px-6 py-3 text-right font-semibold text-white">{formatTzs(p.amount)}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gold">{formatTzs(p.resellerAmount ?? 0)}</td>
                    <td className="px-6 py-3 text-onyx-400">
                      {p.completedAt ? new Date(p.completedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

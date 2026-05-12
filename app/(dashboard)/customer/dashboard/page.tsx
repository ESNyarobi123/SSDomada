"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Wifi, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-client";
import { formatTzs } from "@/lib/format-currency";

type DashboardData = {
  profile: { name: string | null; email: string };
  subscriptions: { activeCount: number; recent: Array<{
    id: string;
    status: string;
    expiresAt: string;
    package: { name: string; price: number; currency: string; reseller: { companyName: string } };
  }> };
  spend: { thisMonth: number; thisMonthCount: number; lifetime: number; lifetimeCount: number };
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    paymentType: string;
    completedAt: string | null;
    reseller: { companyName: string };
  }>;
};

export default function CustomerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await authFetch("/api/v1/customer/dashboard");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not load dashboard");
        return;
      }
      setData(json.data);
    })();
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24 text-onyx-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        <span>Loading your dashboard…</span>
      </div>
    );
  }

  const { profile, subscriptions, spend, recentPayments } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white">
          Hello{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-onyx-400 mt-1">Track your WiFi packages and spending in one place.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gold-20 bg-gradient-to-br from-onyx-900/80 to-onyx-950 p-5">
          <div className="flex items-center gap-2 text-gold text-xs font-bold uppercase tracking-wider mb-2">
            <Wifi className="w-4 h-4" />
            Active plans
          </div>
          <div className="text-3xl font-black text-white">{subscriptions.activeCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-5">
          <div className="flex items-center gap-2 text-onyx-500 text-xs font-bold uppercase tracking-wider mb-2">
            <TrendingUp className="w-4 h-4" />
            This month
          </div>
          <div className="text-2xl font-black text-gold">{formatTzs(spend.thisMonth)}</div>
          <div className="text-xs text-onyx-500 mt-1">{spend.thisMonthCount} payments</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-5 sm:col-span-2">
          <div className="text-xs font-bold uppercase tracking-wider text-onyx-500 mb-2">Lifetime spend</div>
          <div className="text-2xl font-black text-white">{formatTzs(spend.lifetime)}</div>
          <div className="text-xs text-onyx-500 mt-1">{spend.lifetimeCount} completed payments</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gold" />
              Recent subscriptions
            </h2>
            <Link href="/portal" className="text-xs text-gold hover:underline">Browse portals</Link>
          </div>
          <ul className="divide-y divide-white/5">
            {subscriptions.recent.length === 0 ? (
              <li className="px-5 py-8 text-center text-onyx-500 text-sm">No subscriptions yet. Buy a plan from your venue&apos;s captive portal.</li>
            ) : (
              subscriptions.recent.map((s) => (
                <li key={s.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{s.package.name}</div>
                    <div className="text-xs text-onyx-500 mt-0.5">{s.package.reseller.companyName}</div>
                    <div className="text-xs text-onyx-400 mt-1">
                      Expires {new Date(s.expiresAt).toLocaleDateString()} · <span className="text-gold">{s.status}</span>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gold shrink-0">{formatTzs(s.package.price)}</div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gold" />
              Recent payments
            </h2>
          </div>
          <ul className="divide-y divide-white/5">
            {recentPayments.length === 0 ? (
              <li className="px-5 py-8 text-center text-onyx-500 text-sm">No payments yet.</li>
            ) : (
              recentPayments.map((p) => (
                <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="text-white font-medium">{p.reseller.companyName}</div>
                    <div className="text-xs text-onyx-500">
                      {p.paymentType} · {p.completedAt ? new Date(p.completedAt).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="font-bold text-gold">{formatTzs(p.amount)}</div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, ArrowLeft, Ban, CheckCircle } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";

type Detail = {
  id: string;
  companyName: string;
  brandSlug: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  commissionRate: number;
  walletBalance: number;
  totalEarnings: number;
  user: { id: string; name: string | null; email: string; phone: string | null; isActive: boolean };
  sites: Array<{ id: string; name: string; location: string | null; omadaSiteId: string | null }>;
  revenue: {
    allTime: { totalAmount: number; platformFee: number; resellerEarnings: number; transactionCount: number };
    thisMonth: { totalAmount: number; platformFee: number; resellerEarnings: number; transactionCount: number };
  };
  recentPayments: Array<{
    id: string;
    amount: number;
    paymentType: string;
    completedAt: string | null;
    user: { name: string | null; phone: string | null };
  }>;
};

export default function AdminResellerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const r = await adminJson<Detail>(`/api/v1/admin/resellers/${id}`);
    setLoading(false);
    if (!r.ok) {
      setErr(r.error || "Not found");
      setD(null);
    } else setD(r.data!);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchAction(action: "suspend" | "activate") {
    if (!confirm(action === "suspend" ? "Suspend this reseller and their login?" : "Re-activate this reseller?")) return;
    setBusy(true);
    const res = await authFetch(`/api/v1/admin/resellers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(json.error || "Failed");
      return;
    }
    void load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-rose-300" />
      </div>
    );
  }

  if (err || !d) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/super-admin/resellers" className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to resellers
        </Link>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{err || "Loading…"}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/super-admin/resellers" className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Resellers
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">{d.companyName}</h1>
          <p className="text-onyx-400">
            {d.brandSlug} · {d.user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.isActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void patchAction("suspend")}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              Suspend
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void patchAction("activate")}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Activate
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-4">
          <div className="text-[10px] font-bold uppercase text-onyx-500">Wallet</div>
          <div className="text-xl font-black text-gold">{formatTzsCompact(d.walletBalance)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-4">
          <div className="text-[10px] font-bold uppercase text-onyx-500">Lifetime earnings</div>
          <div className="text-xl font-black text-white">{formatTzsCompact(d.totalEarnings)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-4">
          <div className="text-[10px] font-bold uppercase text-onyx-500">All-time gross</div>
          <div className="text-xl font-black text-white">{formatTzsCompact(d.revenue.allTime.totalAmount)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-4">
          <div className="text-[10px] font-bold uppercase text-onyx-500">Platform commission</div>
          <div className="text-xl font-black text-gold">{formatTzsCompact(d.revenue.allTime.platformFee)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-5">
          <h2 className="mb-3 font-bold text-white">Sites</h2>
          <ul className="space-y-2 text-sm">
            {d.sites.length === 0 ? (
              <li className="text-onyx-500">No sites.</li>
            ) : (
              d.sites.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 rounded-lg border border-white/5 px-3 py-2">
                  <span className="font-medium text-white">{s.name}</span>
                  <span className="text-xs text-onyx-500">{s.omadaSiteId ? "Omada linked" : "Local"}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-5">
          <h2 className="mb-3 font-bold text-white">Recent payments</h2>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {d.recentPayments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 border-b border-white/5 py-2">
                <span className="text-onyx-300">{p.user.name || p.user.phone || "—"}</span>
                <span className="font-semibold text-gold">{formatTzs(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

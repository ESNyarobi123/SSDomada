"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, DollarSign, Wallet, Percent, Receipt } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";

type Row = {
  id: string;
  amount: number;
  status: string;
  paymentType: string;
  createdAt: string;
  reseller: { companyName: string; brandSlug: string } | null;
  user: { name: string | null; phone: string | null } | null;
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Row[]>([]);
  const [summary, setSummary] = useState({ totalAmount: 0, totalPlatformFee: 0, totalResellerAmount: 0, completedCount: 0 });
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0 });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    if (status) q.set("status", status);
    const r = await adminJson<{ payments: Row[]; summary: typeof summary }>(`/api/v1/admin/payments?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setPayments(r.data!.payments);
      setSummary(r.data!.summary);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">Payments</h1>
        <p className="mt-1 text-onyx-400">All gateway transactions — filters apply to list and summary.</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-60" />
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Completed volume</span>
          </div>
          <div className="text-xl font-black text-white">{formatTzsCompact(summary.totalAmount)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Platform fees</span>
          </div>
          <div className="text-xl font-black text-gold">{formatTzsCompact(summary.totalPlatformFee)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Reseller share</span>
          </div>
          <div className="text-xl font-black text-white">{formatTzsCompact(summary.totalResellerAmount)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Completed count</span>
          </div>
          <div className="text-xl font-black text-white">{summary.completedCount}</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
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
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                  <th className="px-5 py-3 font-semibold">When</th>
                  <th className="px-5 py-3 font-semibold">Reseller</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gold-5/20 transition-colors">
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-onyx-400">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-onyx-200">{p.reseller?.companyName || "—"}</td>
                    <td className="px-5 py-2.5 text-white">{p.user?.name || p.user?.phone || "—"}</td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center text-xs bg-white/[0.04] px-2.5 py-1 rounded-lg text-onyx-300">{p.paymentType}</span>
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
                    <td className="px-5 py-2.5 text-right font-bold text-gold">{formatTzs(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta.total > meta.limit && (
            <div className="flex justify-between items-center border-t border-white/[0.06] px-5 py-3 text-xs text-onyx-400">
              <span>{meta.total} rows · page {meta.page}</span>
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

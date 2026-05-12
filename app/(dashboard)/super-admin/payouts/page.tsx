"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Banknote, DollarSign, Wallet, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";

type Withdrawal = {
  id: string;
  amount: number;
  status: string;
  channel: string;
  createdAt: string;
  reseller: { companyName: string; brandSlug: string };
  payout: { id: string; status: string; snippeReference: string | null } | null;
};

type PayoutRow = {
  id: string;
  amount: number;
  status: string;
  fee: number;
  total: number;
  createdAt: string;
  reseller: { companyName: string };
  withdrawal: { id: string; status: string } | null;
};

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<"withdrawals" | "payouts">("withdrawals");
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [pendingSummary, setPendingSummary] = useState({ count: 0, totalAmount: 0 });
  const [payoutSummary, setPayoutSummary] = useState({ totalPaid: 0, totalFees: 0, totalDebited: 0, completedCount: 0 });
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    q.set("view", tab === "payouts" ? "payouts" : "withdrawals");

    if (tab === "withdrawals") {
      const r = await adminJson<{ withdrawals: Withdrawal[]; pendingSummary: typeof pendingSummary }>(`/api/v1/admin/payouts?${q}`);
      if (!r.ok) setErr(r.error || "Failed");
      else {
        setWithdrawals(r.data!.withdrawals);
        setPendingSummary(r.data!.pendingSummary);
        if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
      }
    } else {
      const r = await adminJson<{ payouts: PayoutRow[]; summary: typeof payoutSummary }>(`/api/v1/admin/payouts?${q}`);
      if (!r.ok) setErr(r.error || "Failed");
      else {
        setPayouts(r.data!.payouts);
        setPayoutSummary({
          totalPaid: r.data!.summary.totalPaid,
          totalFees: r.data!.summary.totalFees,
          totalDebited: r.data!.summary.totalDebited,
          completedCount: r.data!.summary.completedCount,
        });
        if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
      }
    }
    setLoading(false);
  }, [meta.page, meta.limit, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject" | "process") {
    const res = await authFetch(`/api/v1/admin/payouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNote: note || undefined }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Failed");
      return;
    }
    setNote("");
    void load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">Withdrawals & payouts</h1>
        <p className="mt-1 text-onyx-400">Approve, reject, or process — SUPER_ADMIN only; actions are audit-logged.</p>
      </div>

      {/* ── Tab toggle ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-gold-10 overflow-hidden">
          {(["withdrawals", "payouts"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setMeta((m) => ({ ...m, page: 1 }));
              }}
              className={`px-4 py-2.5 text-sm font-bold capitalize transition-colors ${
                tab === t ? "bg-gold-10 text-gold" : "text-onyx-400 hover:text-onyx-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Withdrawals summary ── */}
      {tab === "withdrawals" ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
                <Clock className="w-3 h-3 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Pending</span>
            </div>
            <div className="text-2xl font-black text-white">{pendingSummary.count}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-3 h-3 text-amber-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Pending amount</span>
            </div>
            <div className="text-lg font-black text-gold">{formatTzs(pendingSummary.totalAmount)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
                <Banknote className="w-3 h-3 text-sky-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Page</span>
            </div>
            <div className="text-2xl font-black text-white">{meta.page}<span className="text-sm text-onyx-400">/{Math.ceil(meta.total / meta.limit) || 1}</span></div>
          </div>
        </div>
      ) : (
        /* ── Payouts summary ── */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
                <DollarSign className="w-3 h-3 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Paid out</span>
            </div>
            <div className="text-lg font-black text-white">{formatTzsCompact(payoutSummary.totalPaid)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Fees</span>
            </div>
            <div className="text-lg font-black text-gold">{formatTzsCompact(payoutSummary.totalFees)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Banknote className="w-3 h-3 text-amber-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Total debited</span>
            </div>
            <div className="text-lg font-black text-white">{formatTzsCompact(payoutSummary.totalDebited)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-sky-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Completed</span>
            </div>
            <div className="text-lg font-black text-white">{payoutSummary.completedCount}</div>
          </div>
        </div>
      )}

      {/* ── Admin note ── */}
      <div className="flex flex-wrap gap-3">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Admin note (optional)"
          className="min-w-[200px] flex-1 rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
        />
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Withdrawals list ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : tab === "withdrawals" ? (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <div
              key={w.id}
              className="flex flex-col gap-3 rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-bold text-gold">{formatTzs(w.amount)}</div>
                <div className="text-sm text-onyx-300">{w.reseller.companyName}</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                    w.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/15" : w.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : w.status === "REJECTED" ? "bg-red-500/10 text-red-400 border-red-500/15" : "bg-white/[0.04] text-onyx-300 border-white/[0.08]"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${w.status === "PENDING" ? "bg-amber-400" : w.status === "APPROVED" ? "bg-emerald-400" : w.status === "REJECTED" ? "bg-red-400" : "bg-onyx-400"}`} />
                    {w.status}
                  </span>
                  <span className="inline-flex items-center text-xs bg-white/[0.04] px-2 py-0.5 rounded-lg text-onyx-300">{w.channel}</span>
                  <span className="text-xs text-onyx-500">{new Date(w.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {w.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void act(w.id, "approve")}
                      className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void act(w.id, "reject")}
                      className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {w.status === "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => void act(w.id, "process")}
                    className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 transition-all"
                  >
                    Process payout
                  </button>
                )}
              </div>
            </div>
          ))}
          {withdrawals.length === 0 && <p className="text-onyx-500">No withdrawal requests.</p>}
        </div>
      ) : (
        /* ── Payouts table ── */
        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                <th className="px-5 py-3 font-semibold">Reseller</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Amount</th>
                <th className="px-5 py-3 text-right font-semibold">Fee</th>
                <th className="px-5 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-gold-5/20 transition-colors">
                  <td className="px-5 py-2.5 font-medium text-white">{p.reseller.companyName}</td>
                  <td className="px-5 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                      p.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : p.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/15" : "bg-red-500/10 text-red-400 border-red-500/15"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.status === "COMPLETED" ? "bg-emerald-400" : p.status === "PENDING" ? "bg-amber-400" : "bg-red-400"}`} />
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold text-gold">{formatTzs(p.amount)}</td>
                  <td className="px-5 py-2.5 text-right text-onyx-400">{formatTzs(p.fee)}</td>
                  <td className="px-5 py-2.5 text-xs text-onyx-400">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payouts.length === 0 && <p className="px-5 py-8 text-center text-onyx-500">No payouts in this page range.</p>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Wallet, Clock, CheckCircle2, XCircle, AlertCircle, ArrowUpRight, Banknote, TrendingUp, Smartphone } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";
import { ChartPanel, Histogram } from "@/components/reseller/ResellerCharts";

type Withdrawal = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  channel: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientAccount: string | null;
  recipientBank: string | null;
  createdAt: string;
  payout: { status: string; snippeReference: string | null; completedAt: string | null } | null;
};

type Payload = {
  withdrawals: Withdrawal[];
  wallet: {
    availableBalance: number;
    totalEarnings: number;
    totalWithdrawn: number;
    totalWithdrawals: number;
    currency: string;
  };
};

const MIN_WITHDRAWAL = 1000;

export default function ResellerWithdrawalsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: 5000,
    channel: "MOBILE" as "MOBILE" | "BANK",
    recipientName: "",
    recipientPhone: "",
    recipientAccount: "",
    recipientBank: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    const r = await resellerJson<Payload>(`/api/v1/reseller/withdrawals?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setData(r.data!);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const withdrawalStatusHist = useMemo(() => {
    const rows = data?.withdrawals;
    if (!rows?.length) return [];
    const m = new Map<string, number>();
    for (const w of rows) m.set(w.status, (m.get(w.status) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  }, [data?.withdrawals]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    const body: Record<string, unknown> = {
      amount: Math.round(Number(form.amount)),
      channel: form.channel,
      recipientName: form.recipientName.trim(),
    };
    if (form.channel === "MOBILE") body.recipientPhone = form.recipientPhone.trim();
    else {
      body.recipientAccount = form.recipientAccount.trim();
      body.recipientBank = form.recipientBank.trim();
    }
    const res = await fetch("/api/v1/reseller/withdrawals", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) setErr(json.error || "Request failed");
    else {
      alert(json.data?.message || "Submitted");
      void load();
    }
  }

  function statusIcon(s: string) {
    if (s === "COMPLETED") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (s === "REJECTED" || s === "FAILED") return <XCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-amber-300" />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Withdrawals</h1>
        <p className="text-onyx-400 mt-1">
          Minimum request {formatTzs(MIN_WITHDRAWAL)}. One pending request at a time — balance is reserved when you
          submit.
        </p>
      </div>

      {/* ── Wallet cards ── */}
      {data && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gold-20 bg-gradient-to-br from-gold-5/50 via-gold-10/20 to-transparent p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-60" />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Available</span>
            </div>
            <div className="text-2xl font-black text-white">{formatTzs(data.wallet.availableBalance)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-sky-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Total withdrawn</span>
            </div>
            <div className="text-xl font-black text-white">{formatTzsCompact(data.wallet.totalWithdrawn)}</div>
            <div className="text-xs text-onyx-400 mt-1">{data.wallet.totalWithdrawals} payouts</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Lifetime earnings</span>
            </div>
            <div className="text-xl font-black text-gold">{formatTzsCompact(data.wallet.totalEarnings)}</div>
          </div>
        </div>
      )}

      {data && withdrawalStatusHist.length > 0 && (
        <ChartPanel
          title="Status mix · this page"
          subtitle="Counts are from the withdrawal rows loaded below (current page size)."
        >
          <Histogram
            items={withdrawalStatusHist}
            variant="violet"
            barHeightPx={96}
            formatValue={(n) => `${Math.round(n)} req`}
          />
        </ChartPanel>
      )}

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex gap-2 items-start">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          {err}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Request form ── */}
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-gold" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Request payout</h2>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Channel</label>
              <div className="flex gap-2 mt-1.5">
                {(["MOBILE", "BANK"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, channel: ch }))}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-bold border transition-all inline-flex items-center justify-center gap-2 ${
                      form.channel === ch
                        ? "border-gold-30 bg-gold-10 text-gold shadow-sm shadow-gold/5"
                        : "border-gold-10 text-onyx-400 hover:border-gold-20 hover:text-onyx-200"
                    }`}
                  >
                    {ch === "MOBILE" ? <><Smartphone className="w-3.5 h-3.5" /> Mobile money</> : <><Banknote className="w-3.5 h-3.5" /> Bank</>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Amount ({data?.wallet.currency || "TZS"})</label>
              <input
                type="number"
                min={MIN_WITHDRAWAL}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Account name</label>
              <input
                required
                value={form.recipientName}
                onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            {form.channel === "MOBILE" ? (
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Phone (M-Pesa / Airtel)</label>
                <input
                  required
                  value={form.recipientPhone}
                  onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                  placeholder="2557…"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Account number</label>
                  <input
                    required
                    value={form.recipientAccount}
                    onChange={(e) => setForm((f) => ({ ...f, recipientAccount: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Bank name</label>
                  <input
                    required
                    value={form.recipientBank}
                    onChange={(e) => setForm((f) => ({ ...f, recipientBank: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gold py-3 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all"
            >
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </form>
        </div>

        {/* ── History timeline ── */}
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent overflow-hidden min-h-[280px]">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
            <Clock className="w-4 h-4 text-gold" />
            <span className="text-xs font-bold uppercase tracking-wider text-gold-600-op">History</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gold" />
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04] max-h-[480px] overflow-y-auto">
              {(data?.withdrawals || []).map((w) => (
                <li key={w.id} className="px-5 py-3 flex gap-3 items-start hover:bg-gold-5/20 transition-colors">
                  <div className="mt-0.5">{statusIcon(w.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-white">{formatTzs(w.amount)}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[10px] font-bold border ${
                        w.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : w.status === "REJECTED" || w.status === "FAILED"
                          ? "bg-red-500/10 text-red-400 border-red-500/15"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          w.status === "COMPLETED" ? "bg-emerald-400" : w.status === "REJECTED" || w.status === "FAILED" ? "bg-red-400" : "bg-amber-400"
                        }`} />
                        {w.status}
                      </span>
                    </div>
                    <div className="text-xs text-onyx-400 mt-0.5">
                      {w.channel === "MOBILE" ? w.recipientPhone : `${w.recipientBank} · ${w.recipientAccount}`}
                    </div>
                    <div className="text-[10px] text-onyx-500 mt-1">{new Date(w.createdAt).toLocaleString()}</div>
                    {w.payout && (
                      <div className="text-[10px] text-onyx-400 mt-1">Payout: {w.payout.status}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

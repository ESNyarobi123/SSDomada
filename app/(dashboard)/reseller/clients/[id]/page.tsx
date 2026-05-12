"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, ArrowLeft, Ban, ShieldOff } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { formatTzs } from "@/lib/format-currency";

type Detail = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  totalSpent: number;
  blockedMacs: string[];
  subscriptions: Array<{
    id: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    package: { name: string; price: number; duration: string };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    paymentType: string;
    createdAt: string;
    completedAt: string | null;
  }>;
  wifiSessions: Array<{
    id: string;
    clientMac: string;
    clientIp: string | null;
    startedAt: string;
    endedAt: string | null;
    site: { name: string };
  }>;
};

export default function ResellerClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [u, setU] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mac, setMac] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const r = await resellerJson<Detail>(`/api/v1/reseller/clients/${id}`);
    if (!r.ok) {
      setErr(r.error || "Not found");
      setU(null);
    } else setU(r.data!);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(action: "block" | "unblock", macAddr: string) {
    setMsg(null);
    const res = await fetch(`/api/v1/reseller/clients/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({ action, mac: macAddr }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error || "Failed");
    else {
      setErr(null);
      setMsg(json.data?.message || "OK");
      void load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-onyx-400 py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        Loading…
      </div>
    );
  }
  if (err || !u) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{err}</div>
        <Link href="/reseller/clients" className="text-gold text-sm font-semibold inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <Link href="/reseller/clients" className="text-xs font-semibold text-gold hover:underline inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Clients
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-white">{u.name || "Client"}</h1>
        <p className="text-onyx-400 text-sm mt-1">
          {u.phone || "—"} · {u.email || "—"}
        </p>
        <p className="text-gold font-bold mt-2">Lifetime spend · {formatTzs(u.totalSpent)}</p>
      </div>

      {(msg || err) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${err ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          {err || msg}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-onyx-500 mb-3">Block MAC</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            placeholder="AA:BB:CC:DD:EE:FF"
            className="flex-1 rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => mac && void patch("block", mac.trim())}
            className="rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-2 text-sm font-bold text-red-200"
          >
            <Ban className="w-4 h-4 inline mr-1" />
            Block
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 font-bold text-white">Subscriptions</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-white/5">
            {u.subscriptions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">{s.package.name}</td>
                <td className="px-4 py-2 text-onyx-400">{s.status}</td>
                <td className="px-4 py-2 text-xs text-onyx-500">until {new Date(s.expiresAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 font-bold text-white">Recent sessions</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-onyx-500 border-b border-white/5">
                <th className="px-4 py-2">MAC</th>
                <th className="px-4 py-2">Site</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {u.wifiSessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono text-xs">
                    {s.clientMac}
                    {u.blockedMacs.includes(s.clientMac.toUpperCase()) && (
                      <span className="ml-2 text-[10px] text-red-400">blocked</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-onyx-400">{s.site.name}</td>
                  <td className="px-4 py-2 text-onyx-500 text-xs">{new Date(s.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    {u.blockedMacs.includes(s.clientMac.toUpperCase()) ? (
                      <button
                        type="button"
                        onClick={() => void patch("unblock", s.clientMac)}
                        className="text-xs font-semibold text-emerald-300 hover:underline inline-flex items-center gap-1"
                      >
                        <ShieldOff className="w-3 h-3" />
                        Unblock
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void patch("block", s.clientMac)}
                        className="text-xs font-semibold text-red-300 hover:underline"
                      >
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 font-bold text-white">Payments</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-onyx-500 border-b border-white/5">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {u.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-xs text-onyx-400">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">{p.paymentType}</td>
                  <td className="px-4 py-2">{p.status}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gold">{formatTzs(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

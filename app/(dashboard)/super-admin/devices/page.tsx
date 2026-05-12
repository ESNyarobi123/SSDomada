"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Router, Wifi, WifiOff, Clock } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { ChartPanel, Histogram } from "@/components/reseller/ResellerCharts";

type Device = {
  id: string;
  name: string;
  mac: string;
  status: string;
  model: string | null;
  lastSeen: string | null;
  reseller: { companyName: string };
  site: { name: string };
};

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [summary, setSummary] = useState({ online: 0, offline: 0, pending: 0 });
  const [meta, setMeta] = useState({ page: 1, limit: 30, total: 0 });
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
    const r = await adminJson<{ devices: Device[]; summary: typeof summary }>(`/api/v1/admin/devices?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setDevices(r.data!.devices);
      setSummary(r.data!.summary);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const hist = [
    { label: "On", value: summary.online, title: `Online ${summary.online}` },
    { label: "Off", value: summary.offline, title: `Offline ${summary.offline}` },
    { label: "Pend", value: summary.pending, title: `Pending ${summary.pending}` },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">All devices</h1>
        <p className="mt-1 text-onyx-400">APs across every reseller — same data as `/api/v1/admin/devices`.</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <Router className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total</span>
          </div>
          <div className="text-2xl font-black text-white">{meta.total}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Wifi className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Online</span>
          </div>
          <div className="text-2xl font-black text-white">{summary.online}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <WifiOff className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Offline</span>
          </div>
          <div className="text-2xl font-black text-white">{summary.offline}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
              <Clock className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Pending</span>
          </div>
          <div className="text-2xl font-black text-white">{summary.pending}</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setMeta((m) => ({ ...m, page: 1 }));
          }}
          className="rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-gold-30 outline-none transition-colors"
        >
          <option value="">All statuses</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="PENDING">Pending</option>
        </select>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        <Link href="/super-admin/sites" className="rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all">
          Omada sites
        </Link>
      </div>

      <ChartPanel title="Status histogram" subtitle="Fleet-wide counts for the current filter.">
        <Histogram items={hist} variant="emerald" barHeightPx={100} formatValue={(n) => String(Math.round(n))} />
      </ChartPanel>

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
                  <th className="px-5 py-3 font-semibold">Device</th>
                  <th className="px-5 py-3 font-semibold">MAC</th>
                  <th className="px-5 py-3 font-semibold">Reseller</th>
                  <th className="px-5 py-3 font-semibold">Site</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-gold-5/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-white">{d.name}</div>
                      <div className="text-xs text-onyx-400">{d.model || "—"}</div>
                    </td>
                    <td className="px-5 py-3"><span className="font-mono text-xs text-onyx-400 bg-white/[0.04] px-2 py-0.5 rounded">{d.mac}</span></td>
                    <td className="px-5 py-3 text-onyx-300">{d.reseller.companyName}</td>
                    <td className="px-5 py-3 text-onyx-400">{d.site?.name || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                        d.status === "ONLINE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : d.status === "OFFLINE" ? "bg-amber-500/10 text-amber-400 border-amber-500/15" : "bg-sky-500/10 text-sky-400 border-sky-500/15"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === "ONLINE" ? "bg-emerald-400" : d.status === "OFFLINE" ? "bg-amber-400" : "bg-sky-400"}`} />
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

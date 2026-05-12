"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Radio, ArrowLeft } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";

type SiteOpt = { id: string; name: string };

type OmadaPayload = {
  site: { id: string; name: string; omadaSiteId: string | null; reseller: { companyName: string } };
  devices: Array<{
    id: string;
    name: string;
    mac: string;
    status: string;
    model: string | null;
    liveStatus: string | null;
    liveClients: number;
    synced: boolean;
  }>;
  unregisteredDevices: Array<{ name?: string; mac?: string }>;
  controllerStatus: string;
};

function OmadaDevicesInner() {
  const searchParams = useSearchParams();
  const initialSite = searchParams.get("siteId") || "";

  const [sites, setSites] = useState<SiteOpt[]>([]);
  const [siteId, setSiteId] = useState(initialSite);
  const [payload, setPayload] = useState<OmadaPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await adminJson<{ sites: Array<{ id: string; name: string }> }>("/api/v1/admin/omada/sites?source=db");
      if (r.ok && r.data?.sites) {
        setSites(r.data.sites.map((s) => ({ id: s.id, name: s.name })));
        if (!siteId && r.data.sites[0]) setSiteId(r.data.sites[0].id);
      }
    })();
  }, []);

  const loadDevices = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setErr(null);
    const r = await adminJson<OmadaPayload>(`/api/v1/admin/omada/devices?siteId=${encodeURIComponent(siteId)}`);
    if (!r.ok) {
      setErr(r.error || "Failed");
      setPayload(null);
    } else setPayload(r.data!);
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">Live site devices</h1>
        <p className="mt-1 text-onyx-400">Per-site Omada merge — controller: {payload?.controllerStatus ?? "select a site"}</p>
      </div>

      {/* ── Site selector ── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="min-w-[12rem] rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-gold-30 outline-none transition-colors"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void loadDevices()} className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        <Link href="/super-admin/sites" className="inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline">
          <ArrowLeft className="w-4 h-4" /> All sites
        </Link>
      </div>

      {/* ── Summary cards ── */}
      {payload && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
                <Radio className="w-3 h-3 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Devices</span>
            </div>
            <div className="text-2xl font-black text-white">{payload.devices.length}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Online</span>
            </div>
            <div className="text-2xl font-black text-white">{payload.devices.filter((d) => d.liveStatus === "connected").length}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Synced</span>
            </div>
            <div className="text-2xl font-black text-white">{payload.devices.filter((d) => d.synced).length}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
                <span className="w-3 h-3 text-sky-400 text-xs font-bold">C</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Clients</span>
            </div>
            <div className="text-2xl font-black text-white">{payload.devices.reduce((s, d) => s + d.liveClients, 0)}</div>
          </div>
        </div>
      )}

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : payload ? (
        <>
          {payload.unregisteredDevices?.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
              {payload.unregisteredDevices.length} device(s) on Omada not in DB for this site.
            </div>
          )}
          <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                  <th className="px-5 py-3 font-semibold">Device</th>
                  <th className="px-5 py-3 font-semibold">MAC</th>
                  <th className="px-5 py-3 font-semibold">DB status</th>
                  <th className="px-5 py-3 font-semibold">Live</th>
                  <th className="px-5 py-3 text-right font-semibold">Clients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {payload.devices.map((d) => (
                  <tr key={d.id} className="hover:bg-gold-5/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">{d.name}</td>
                    <td className="px-5 py-3"><span className="font-mono text-xs text-onyx-400 bg-white/[0.04] px-2 py-0.5 rounded">{d.mac}</span></td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                        d.status === "ONLINE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : d.status === "OFFLINE" ? "bg-amber-500/10 text-amber-400 border-amber-500/15" : "bg-sky-500/10 text-sky-400 border-sky-500/15"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === "ONLINE" ? "bg-emerald-400" : d.status === "OFFLINE" ? "bg-amber-400" : "bg-sky-400"}`} />
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {d.liveStatus ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                          d.liveStatus === "connected" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.liveStatus === "connected" ? "bg-emerald-400" : "bg-amber-400"}`} />
                          {d.liveStatus}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-onyx-300">{d.liveClients}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function AdminOmadaDevicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      }
    >
      <OmadaDevicesInner />
    </Suspense>
  );
}

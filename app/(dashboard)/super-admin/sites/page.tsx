"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, MapPin, Router, Wifi, AlertTriangle } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";

type MergedSite = {
  id: string;
  name: string;
  location: string | null;
  omadaSiteId: string | null;
  reseller: { id: string; companyName: string; brandSlug: string };
  _count: { devices: number; wifiSessions: number };
  synced: boolean;
};

type Payload = {
  sites: MergedSite[];
  unlinkedOmadaSites: Array<{ name?: string; siteId?: string; id?: string }>;
  controllerStatus: string;
};

export default function AdminSitesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    const r = await adminJson<Payload>("/api/v1/admin/omada/sites?source=both");
    if (!r.ok) setErr(r.error || "Failed");
    else setData(r.data!);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white md:text-4xl">Omada sites</h1>
          <p className="mt-1 text-onyx-400">Database sites merged with controller discovery — {data?.controllerStatus ?? "…"}</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <MapPin className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Sites</span>
          </div>
          <div className="text-2xl font-black text-white">{data?.sites.length ?? 0}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Wifi className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Synced</span>
          </div>
          <div className="text-2xl font-black text-white">{data?.sites.filter((s) => s.synced).length ?? 0}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Unlinked</span>
          </div>
          <div className="text-2xl font-black text-white">{data?.unlinkedOmadaSites?.length ?? 0}</div>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {loading || !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <>
          {data.unlinkedOmadaSites?.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
              <strong>{data.unlinkedOmadaSites.length}</strong> Omada site(s) not linked in SSDomada DB yet.
            </div>
          )}
          <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                  <th className="px-5 py-3 font-semibold">Site</th>
                  <th className="px-5 py-3 font-semibold">Reseller</th>
                  <th className="px-5 py-3 font-semibold">Omada ID</th>
                  <th className="px-5 py-3 text-right font-semibold">Devices</th>
                  <th className="px-5 py-3 font-semibold">Sync</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.sites.map((s) => (
                  <tr key={s.id} className="hover:bg-gold-5/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">{s.name}</td>
                    <td className="px-5 py-3 text-onyx-300">{s.reseller.companyName}</td>
                    <td className="px-5 py-3"><span className="font-mono text-xs text-onyx-400 bg-white/[0.04] px-2 py-0.5 rounded">{s.omadaSiteId || "—"}</span></td>
                    <td className="px-5 py-3 text-right text-onyx-300">{s._count.devices}</td>
                    <td className="px-5 py-3">
                      {s.synced ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live
                        </span>
                      ) : (
                        <span className="text-xs text-onyx-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/super-admin/omada-devices?siteId=${s.id}`} className="text-xs font-bold text-gold hover:underline">
                        Live devices
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

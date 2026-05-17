"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, MapPin, Router, Building2, Wifi, Radio, X, ArrowRight } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { ChartPanel, Histogram } from "@/components/reseller/ResellerCharts";

type Site = {
  id: string;
  name: string;
  location: string | null;
  omadaSiteId: string | null;
  _count: { devices: number; wifiSessions: number; ssidConfigs: number };
};

export default function ResellerSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    const r = await resellerJson<Site[]>("/api/v1/reseller/sites");
    if (!r.ok) setErr(r.error || "Failed");
    else setSites(r.data || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const deviceHistogram = useMemo(
    () =>
      sites.map((s) => ({
        label: s.name.length > 8 ? `${s.name.slice(0, 8)}…` : s.name,
        value: s._count.devices,
        title: `${s.name}: ${s._count.devices} devices · ${s._count.ssidConfigs} SSIDs`,
      })),
    [sites]
  );

  const totalDevices = sites.reduce((a, s) => a + s._count.devices, 0);
  const totalSsids = sites.reduce((a, s) => a + s._count.ssidConfigs, 0);
  const linkedCount = sites.filter((s) => s.omadaSiteId).length;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/v1/reseller/sites", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({ name: name.trim(), location: location.trim() || undefined }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErr(json.error || "Failed");
      return;
    }
    setShow(false);
    setName("");
    setLocation("");
    void load();
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Sites</h1>
          <p className="text-onyx-400 mt-1">
            Group your access points by venue or area (shop, hotel, branch). Add a site before registering devices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          New site
        </button>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Summary strip ── */}
      {!loading && sites.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total sites</span>
            </div>
            <div className="text-xl font-black text-white">{sites.length}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Router className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Devices</span>
            </div>
            <div className="text-xl font-black text-white">{totalDevices}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Omada linked</span>
            </div>
            <div className="text-xl font-black text-white">{linkedCount}<span className="text-sm text-onyx-400 font-medium">/{sites.length}</span></div>
          </div>
        </div>
      )}

      {/* ── Site cards ── */}
      {loading ? (
        <div className="flex items-center gap-3 py-20 text-onyx-400">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
          Loading…
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {sites.length === 0 ? (
            <div className="sm:col-span-2 rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gold-10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No sites yet</h3>
              <p className="text-sm text-onyx-400 mb-4">Create your first site, then add devices to it.</p>
              <button
                type="button"
                onClick={() => setShow(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create first site
              </button>
            </div>
          ) : (
            sites.map((s) => (
              <div
                key={s.id}
                className="group rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-5 flex flex-col gap-3 hover:border-gold-30 hover:shadow-lg hover:shadow-gold/5 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-20 to-transparent opacity-50" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold-10 flex items-center justify-center shrink-0 group-hover:bg-gold-20 transition-colors">
                      <Building2 className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{s.name}</h2>
                      {s.location && (
                        <p className="text-sm text-onyx-300 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-gold-600-op" />
                          {s.location}
                        </p>
                      )}
                    </div>
                  </div>
                  {s.omadaSiteId ? (
                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      Omada linked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/15">
                      Local only
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-onyx-300 bg-white/[0.04] px-2.5 py-1 rounded-lg">
                    <Router className="w-3 h-3 text-sky-400" />
                    {s._count.devices} devices
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-onyx-300 bg-white/[0.04] px-2.5 py-1 rounded-lg">
                    <Wifi className="w-3 h-3 text-gold" />
                    {s._count.ssidConfigs} SSIDs
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-onyx-300 bg-white/[0.04] px-2.5 py-1 rounded-lg">
                    <Radio className="w-3 h-3 text-emerald-400" />
                    {s._count.wifiSessions} sessions
                  </span>
                </div>
                <div className="pt-3 border-t border-white/[0.06] flex gap-3">
                  <Link href="/reseller/ssids" className="text-xs font-semibold text-gold hover:underline flex items-center gap-1">
                    Manage SSIDs <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link href="/reseller/devices" className="text-xs font-semibold text-onyx-400 hover:text-white flex items-center gap-1">
                    Devices <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && sites.length > 0 && (
        <ChartPanel
          title="Devices per site"
          subtitle="Number of access points at each location."
        >
          <Histogram items={deviceHistogram} variant="sky" barHeightPx={120} formatValue={(n) => `${Math.round(n)} APs`} />
        </ChartPanel>
      )}

      {/* ── Create site modal ── */}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShow(false)}>
          <form
            onSubmit={create}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gold-20 bg-gradient-to-b from-onyx-900 to-onyx-950 p-6 space-y-5 shadow-2xl relative"
          >
            <button type="button" onClick={() => setShow(false)} className="absolute top-4 right-4 text-onyx-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-bold text-white">Create site</h2>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                placeholder="Main office"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Location (optional)</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                placeholder="City / address"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShow(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-onyx-300 hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all">
                {saving ? "Creating…" : "Create site"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Wifi, Eye, EyeOff, Power, X, Radio, Signal, Shield } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { ChartPanel, RankedBars } from "@/components/reseller/ResellerCharts";

type Site = { id: string; name: string };
type Ssid = {
  id: string;
  ssidName: string;
  isHidden: boolean;
  isEnabled: boolean;
  band: string;
  site: { id: string; name: string };
};

export default function ResellerSsidsPage() {
  const [ssids, setSsids] = useState<Ssid[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    siteId: "",
    ssidName: "",
    password: "",
    isHidden: false,
    band: "2.4GHz",
  });

  async function load() {
    setLoading(true);
    const r = await resellerJson<Ssid[]>("/api/v1/reseller/ssids");
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setErr(null);
      setSsids(r.data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await resellerJson<Site[]>("/api/v1/reseller/sites");
      if (r.ok && r.data?.length) {
        setSites(r.data);
        setForm((f) => ({ ...f, siteId: f.siteId || r.data![0].id }));
      }
    })();
  }, []);

  const ssidsBySite = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of ssids) {
      const k = x.site?.name || "Unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [ssids]);

  const enabledCount = ssids.filter((s) => s.isEnabled).length;
  const visibleCount = ssids.filter((s) => !s.isHidden).length;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const body: Record<string, unknown> = {
      siteId: form.siteId,
      ssidName: form.ssidName.trim(),
      isHidden: form.isHidden,
      band: form.band,
    };
    if (form.password.trim().length >= 8) body.password = form.password.trim();

    const res = await fetch("/api/v1/reseller/ssids", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErr(json.error || "Failed");
      return;
    }
    setShow(false);
    setForm((f) => ({ ...f, ssidName: "", password: "" }));
    void load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setErr(null);
    const res = await fetch(`/api/v1/reseller/ssids/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error || "Failed");
    else void load();
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">SSID manager</h1>
          <p className="text-onyx-400 mt-1">
            Create and edit SSID records per site. Open network: leave password empty. Push to physical Omada WLANs may
            require controller sync outside this UI.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow(true)}
          disabled={!sites.length}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          <Plus className="w-4 h-4" />
          New SSID
        </button>
      </div>

      {!sites.length && !loading && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Create a <strong>site</strong> first under Sites, then add SSIDs here.
        </div>
      )}

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Summary strip ── */}
      {!loading && ssids.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
                <Wifi className="w-3.5 h-3.5 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total SSIDs</span>
            </div>
            <div className="text-xl font-black text-white">{ssids.length}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Signal className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Enabled</span>
            </div>
            <div className="text-xl font-black text-white">{enabledCount}<span className="text-sm text-onyx-400 font-medium">/{ssids.length}</span></div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Eye className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Visible</span>
            </div>
            <div className="text-xl font-black text-white">{visibleCount}</div>
          </div>
        </div>
      )}

      {/* ── Chart ── */}
      {!loading && ssidsBySite.length > 0 && (
        <ChartPanel
          title="SSIDs by site"
          subtitle="Aggregated from your SSID list (same data as the table below)."
        >
          <RankedBars rows={ssidsBySite} formatValue={(n) => `${Math.round(n)} SSIDs`} maxRows={12} />
        </ChartPanel>
      )}

      {/* ── SSID table ── */}
      {loading ? (
        <div className="flex items-center gap-3 py-20 text-onyx-400">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent overflow-hidden">
          {ssids.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gold-10 flex items-center justify-center mx-auto mb-4">
                <Wifi className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No SSID configs yet</h3>
              <p className="text-sm text-onyx-400 mb-4">Create your first SSID to start broadcasting WiFi.</p>
              <button
                type="button"
                onClick={() => sites.length && setShow(true)}
                disabled={!sites.length}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-40 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create first SSID
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-onyx-400 border-b border-white/[0.06]">
                  <th className="px-5 py-3 font-semibold">SSID</th>
                  <th className="px-5 py-3 font-semibold">Site</th>
                  <th className="px-5 py-3 font-semibold">Band</th>
                  <th className="px-5 py-3 font-semibold">Visibility</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {ssids.map((s) => (
                  <tr key={s.id} className="hover:bg-gold-5/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.isEnabled ? "bg-gold-10" : "bg-white/[0.04]"}`}>
                          <Wifi className={`w-4 h-4 ${s.isEnabled ? "text-gold" : "text-onyx-400"}`} />
                        </div>
                        <span className="font-semibold text-white">{s.ssidName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-onyx-300">{s.site.name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-onyx-300 bg-white/[0.04] px-2.5 py-1 rounded-lg">
                        <Radio className="w-3 h-3 text-sky-400" />
                        {s.band}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {s.isHidden ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold bg-onyx-500/10 text-onyx-400 border border-white/[0.08]">
                          <EyeOff className="w-3 h-3" /> Hidden
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                          <Eye className="w-3 h-3" /> Visible
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                        s.isEnabled
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.isEnabled ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {s.isEnabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void patch(s.id, { action: "toggle" })}
                        className={`text-xs font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                          s.isEnabled
                            ? "border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                            : "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {s.isEnabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── New SSID modal ── */}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShow(false)}>
          <form
            onSubmit={create}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gold-20 bg-gradient-to-b from-onyx-900 to-onyx-950 p-6 space-y-4 shadow-2xl relative"
          >
            <button type="button" onClick={() => setShow(false)} className="absolute top-4 right-4 text-onyx-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-10 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-bold text-white">New SSID</h2>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Site</label>
              <select
                required
                value={form.siteId}
                onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Network name</label>
              <input
                required
                value={form.ssidName}
                onChange={(e) => setForm((f) => ({ ...f, ssidName: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                maxLength={32}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Password (optional, min 8)
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                placeholder="Open Wi‑Fi if empty"
              />
            </div>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2.5 text-sm text-onyx-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isHidden}
                  onChange={(e) => setForm((f) => ({ ...f, isHidden: e.target.checked }))}
                  className="w-4 h-4 rounded border-gold-30 bg-white/[0.04] text-gold focus:ring-gold/20"
                />
                Hidden SSID
              </label>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Band</label>
              <select
                value={form.band}
                onChange={(e) => setForm((f) => ({ ...f, band: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              >
                <option value="2.4GHz">2.4 GHz</option>
                <option value="5GHz">5 GHz</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShow(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-onyx-300 hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all">
                {saving ? "Creating…" : "Create SSID"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

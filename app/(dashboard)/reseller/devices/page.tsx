"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, Router, Wifi, WifiOff, RefreshCw, X, ArrowRight, CircleDot } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { ChartPanel, Histogram, StackedStrip } from "@/components/reseller/ResellerCharts";

type Site = { id: string; name: string; location: string | null };
type DeviceRow = {
  id: string;
  name: string;
  mac: string;
  type: string;
  status: string;
  model: string | null;
  ip: string | null;
  lastSeen: string | null;
  site: { id: string; name: string; location: string | null };
};

export default function ResellerDevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [summary, setSummary] = useState({ online: 0, offline: 0, pending: 0, total: 0 });
  const [sites, setSites] = useState<Site[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("");
  const [siteId, setSiteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", mac: "", siteId: "", type: "AP" });

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    if (searchQuery.trim()) q.set("search", searchQuery.trim());
    if (status) q.set("status", status);
    if (siteId) q.set("siteId", siteId);
    const r = await resellerJson<{ devices: DeviceRow[]; summary: typeof summary }>(`/api/v1/reseller/devices?${q}`);
    if (!r.ok) {
      setErr(r.error || "Failed to load");
      setLoading(false);
      return;
    }
    setDevices(r.data!.devices);
    setSummary(r.data!.summary);
    if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    setLoading(false);
  }, [meta.page, meta.limit, searchQuery, status, siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const r = await resellerJson<Site[]>("/api/v1/reseller/sites");
      if (r.ok && r.data) setSites(r.data);
    })();
  }, []);

  async function addDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!form.siteId) {
      setErr("Select a site first. Create one under Sites if you have none.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/v1/reseller/devices", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({
        name: form.name.trim(),
        mac: form.mac.trim(),
        siteId: form.siteId,
        type: form.type,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || "Could not add device");
      setSaving(false);
      return;
    }
    setShowAdd(false);
    setForm({ name: "", mac: "", siteId: sites[0]?.id || "", type: "AP" });
    setSaving(false);
    void load();
  }

  const onlinePct = summary.total > 0 ? Math.round((summary.online / summary.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Devices & APs</h1>
          <p className="text-onyx-400 mt-1 max-w-xl">
            Register access points by MAC, assign them to a site, then open a device for live Omada stats, reboot, and
            connected clients.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm((f) => ({ ...f, siteId: f.siteId || sites[0]?.id || "" }));
            setShowAdd(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add device
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Online — hero card */}
        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-gold-15 bg-gradient-to-br from-gold-5/60 via-transparent to-transparent p-5 relative overflow-hidden group hover:border-gold-30 hover:shadow-lg hover:shadow-gold/5 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-60" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Wifi className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Online</span>
          </div>
          <div className="text-3xl font-black text-white">{summary.online}</div>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${onlinePct}%` }} />
          </div>
          <div className="text-xs text-emerald-400 mt-1.5 font-medium">{onlinePct}% uptime</div>
        </div>

        {/* Offline */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4 group hover:border-white/[0.15] transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <WifiOff className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Offline</span>
          </div>
          <div className="text-2xl font-black text-white">{summary.offline}</div>
        </div>

        {/* Pending */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4 group hover:border-white/[0.15] transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <CircleDot className="w-4 h-4 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Pending</span>
          </div>
          <div className="text-2xl font-black text-white">{summary.pending}</div>
        </div>

        {/* Total */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4 group hover:border-white/[0.15] transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center">
              <Router className="w-4 h-4 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Total</span>
          </div>
          <div className="text-2xl font-black text-white">{summary.total}</div>
        </div>
      </div>

      {/* ── Chart ── */}
      <ChartPanel
        title="Fleet snapshot"
        subtitle="Summary counts from your devices API (matches the cards above)."
      >
        <StackedStrip
          segments={[
            { key: "on", value: summary.online, className: "bg-emerald-500", label: "Online" },
            { key: "off", value: summary.offline, className: "bg-amber-500", label: "Offline" },
            { key: "pend", value: summary.pending, className: "bg-sky-500", label: "Pending" },
          ]}
        />
        <div className="mt-8 pt-6 border-t border-white/[0.06]">
          <p className="text-xs font-bold uppercase tracking-wider text-onyx-400 mb-3">Histogram · same totals</p>
          <Histogram
            variant="emerald"
            barHeightPx={100}
            formatValue={(n) => `${Math.round(n)}`}
            items={[
              { label: "On", value: summary.online, title: `Online: ${summary.online}` },
              { label: "Off", value: summary.offline, title: `Offline: ${summary.offline}` },
              { label: "Pend", value: summary.pending, title: `Pending: ${summary.pending}` },
            ]}
          />
        </div>
      </ChartPanel>

      {/* ── Filters ── */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-600-op" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearchQuery(searchInput.trim());
                setMeta((m) => ({ ...m, page: 1 }));
              }
            }}
            placeholder="Search MAC, name, model, IP…"
            className="w-full rounded-xl border border-gold-10 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-gold-30 outline-none transition-colors"
          >
            <option value="">All statuses</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="PENDING">Pending</option>
          </select>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="rounded-xl border border-gold-10 bg-white/[0.04] px-3 py-2 text-sm text-white min-w-[10rem] focus:border-gold-30 outline-none transition-colors"
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearchQuery(searchInput.trim());
              setMeta((m) => ({ ...m, page: 1 }));
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Apply
          </button>
        </div>
      </div>

      {/* ── Device table ── */}
      <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-onyx-400">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
            Loading devices…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-onyx-400 border-b border-white/[0.06]">
                  <th className="px-5 py-3 font-semibold">Device</th>
                  <th className="px-5 py-3 font-semibold">MAC</th>
                  <th className="px-5 py-3 font-semibold">Site</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-onyx-400">
                      No devices yet. Add an AP by MAC and assign it to a site.
                    </td>
                  </tr>
                ) : (
                  devices.map((d) => (
                    <tr key={d.id} className="hover:bg-gold-5/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-white">{d.name}</div>
                        <div className="text-xs text-onyx-400">{d.model || d.type}</div>
                      </td>
                      <td className="px-5 py-3 font-mono text-onyx-300 text-xs">{d.mac}</td>
                      <td className="px-5 py-3 text-onyx-300">{d.site?.name || "—"}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                            d.status === "ONLINE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : d.status === "OFFLINE"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/15"
                                : "bg-sky-500/10 text-sky-400 border-sky-500/15"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            d.status === "ONLINE"
                              ? "bg-emerald-400"
                              : d.status === "OFFLINE"
                                ? "bg-amber-400"
                                : "bg-sky-400"
                          }`} />
                          {d.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/reseller/devices/${d.id}`}
                          className="text-gold font-semibold hover:underline text-xs inline-flex items-center gap-1"
                        >
                          Manage <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {meta.total > meta.limit && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] text-xs text-onyx-400">
            <span>
              Page {meta.page} · {meta.total} devices
            </span>
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

      {/* ── Add device modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gold-20 bg-gradient-to-b from-onyx-900 to-onyx-950 p-6 shadow-2xl relative"
          >
            <button type="button" onClick={() => setShowAdd(false)} className="absolute top-4 right-4 text-onyx-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gold-10 flex items-center justify-center">
                <Router className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-bold text-white">Add device</h2>
            </div>
            <p className="text-xs text-onyx-400 mb-5">MAC format: AA:BB:CC:DD:EE:FF</p>
            <form onSubmit={addDevice} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Site</label>
                <select
                  required
                  value={form.siteId}
                  onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                >
                  <option value="">Select site…</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                  placeholder="e.g. Lobby AP"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">MAC address</label>
                <input
                  required
                  value={form.mac}
                  onChange={(e) => setForm((f) => ({ ...f, mac: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white font-mono placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                  placeholder="00:11:22:33:44:55"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                >
                  <option value="AP">AP</option>
                  <option value="SWITCH">Switch</option>
                  <option value="GATEWAY">Gateway</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-onyx-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all"
                >
                  {saving ? "Saving…" : "Add device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

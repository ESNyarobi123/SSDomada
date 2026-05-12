"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Star, Pencil, Trash2, ToggleLeft, ToggleRight, X, Package, DollarSign, Users, Zap } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { formatTzs, formatTzsCompact } from "@/lib/format-currency";
import { ChartPanel, RankedBars } from "@/components/reseller/ResellerCharts";

type DurationKey =
  | "MINUTES_30"
  | "HOUR_1"
  | "HOURS_3"
  | "HOURS_6"
  | "HOURS_12"
  | "HOURS_24"
  | "DAYS_3"
  | "DAYS_7"
  | "DAYS_14"
  | "DAYS_30"
  | "DAYS_90"
  | "DAYS_365"
  | "LIFETIME"
  | "UNLIMITED";

const PRESETS: { label: string; duration: DurationKey; minutes: number }[] = [
  { label: "30 min", duration: "MINUTES_30", minutes: 30 },
  { label: "1 hour", duration: "HOUR_1", minutes: 60 },
  { label: "3 hours", duration: "HOURS_3", minutes: 180 },
  { label: "6 hours", duration: "HOURS_6", minutes: 360 },
  { label: "12 hours", duration: "HOURS_12", minutes: 720 },
  { label: "1 day", duration: "HOURS_24", minutes: 1440 },
  { label: "3 days", duration: "DAYS_3", minutes: 4320 },
  { label: "7 days", duration: "DAYS_7", minutes: 10080 },
  { label: "14 days", duration: "DAYS_14", minutes: 20160 },
  { label: "30 days", duration: "DAYS_30", minutes: 43200 },
  { label: "90 days", duration: "DAYS_90", minutes: 129600 },
  { label: "365 days", duration: "DAYS_365", minutes: 525600 },
  { label: "Lifetime", duration: "LIFETIME", minutes: 5256000 },
  { label: "Unlimited", duration: "UNLIMITED", minutes: 999999 },
];

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: string;
  durationMinutes: number;
  dataLimitMb: number | null;
  speedLimitDown: number | null;
  maxDevices: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  _count: { subscriptions: number; vouchers: number };
  sales: { totalRevenue: number; resellerEarnings: number; totalSold: number; activeSubs: number };
};

export default function ResellerPackagesPage() {
  const [list, setList] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 1000,
    duration: "HOURS_24" as DurationKey,
    durationMinutes: 1440,
    dataLimitMb: "" as string | number,
    maxDevices: 1,
    isFeatured: false,
    sortOrder: 0,
  });

  async function load() {
    setLoading(true);
    const q = filter === "all" ? "" : `?status=${filter === "active" ? "active" : "inactive"}`;
    const r = await resellerJson<Pkg[]>(`/api/v1/reseller/packages${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setErr(null);
      setList(r.data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  function openEdit(p: Pkg) {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      price: Math.round(p.price),
      duration: p.duration as DurationKey,
      durationMinutes: p.durationMinutes,
      dataLimitMb: p.dataLimitMb ?? "",
      maxDevices: p.maxDevices,
      isFeatured: p.isFeatured,
      sortOrder: p.sortOrder,
    });
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: Number(form.price),
      currency: "TZS",
      duration: form.duration,
      durationMinutes: form.durationMinutes,
      dataLimitMb: form.dataLimitMb === "" ? undefined : Number(form.dataLimitMb),
      maxDevices: form.maxDevices,
      isFeatured: form.isFeatured,
      sortOrder: form.sortOrder,
    };
    const res = await fetch("/api/v1/reseller/packages", {
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
    if (!res.ok) setErr(json.error || "Failed");
    else {
      setShowCreate(false);
      resetForm();
      void load();
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    setErr(null);
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: Number(form.price),
      duration: form.duration,
      durationMinutes: form.durationMinutes,
      dataLimitMb: form.dataLimitMb === "" ? undefined : Number(form.dataLimitMb),
      maxDevices: form.maxDevices,
      isFeatured: form.isFeatured,
      sortOrder: form.sortOrder,
    };
    const res = await fetch(`/api/v1/reseller/packages/${editId}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) setErr(json.error || "Failed");
    else {
      setEditId(null);
      resetForm();
      void load();
    }
  }

  function resetForm() {
    setForm({
      name: "",
      description: "",
      price: 1000,
      duration: "HOURS_24",
      durationMinutes: 1440,
      dataLimitMb: "",
      maxDevices: 1,
      isFeatured: false,
      sortOrder: 0,
    });
  }

  async function quickAction(id: string, action: "toggle" | "feature") {
    setErr(null);
    const res = await fetch(`/api/v1/reseller/packages/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error || "Failed");
    else void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this package? Active subscriptions will block delete.")) return;
    setErr(null);
    const res = await fetch(`/api/v1/reseller/packages/${id}`, { method: "DELETE", credentials: "include", headers: { Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}` } });
    const json = await res.json();
    if (!res.ok) setErr(json.error || "Failed");
    else void load();
  }

  const totalRevenue = list.reduce((a, p) => a + p.sales.totalRevenue, 0);
  const totalActive = list.filter((p) => p.isActive).length;
  const totalSubs = list.reduce((a, p) => a + p.sales.activeSubs, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Packages & pricing</h1>
          <p className="text-onyx-400 mt-1">Create vifurushi, set price and limits, feature top sellers on your portal.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          New package
        </button>
      </div>

      {/* ── Summary strip ── */}
      {!loading && list.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/50 via-transparent to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total</span>
            </div>
            <div className="text-xl font-black text-white">{list.length}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Active</span>
            </div>
            <div className="text-xl font-black text-white">{totalActive}<span className="text-sm text-onyx-400 font-medium">/{list.length}</span></div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Subscribers</span>
            </div>
            <div className="text-xl font-black text-white">{totalSubs}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gold-10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-gold" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Revenue</span>
            </div>
            <div className="text-xl font-black text-white">{formatTzsCompact(totalRevenue)}</div>
          </div>
        </div>
      )}

      {/* ── Filter pills ── */}
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "inactive"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              filter === f
                ? "bg-gold-10 text-gold border border-gold-30 shadow-sm shadow-gold/5"
                : "border border-gold-10 text-onyx-400 hover:border-gold-20 hover:text-onyx-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Chart ── */}
      {!loading && list.length > 0 && (
        <ChartPanel
          title="Revenue leaders"
          subtitle="All-time gross revenue per package from your packages API (sales.totalRevenue)."
        >
          <RankedBars
            rows={list.map((p) => ({
              name: p.name,
              value: p.sales.totalRevenue,
              hint: `${p.sales.totalSold} sales · ${formatTzs(p.sales.totalRevenue)}`,
            }))}
            formatValue={(n) => formatTzs(Math.round(n))}
          />
        </ChartPanel>
      )}

      {/* ── Package table ── */}
      {loading ? (
        <div className="flex items-center gap-3 py-20 text-onyx-400">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent overflow-x-auto">
          {list.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gold-10 flex items-center justify-center mx-auto mb-4">
                <Package className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No packages yet</h3>
              <p className="text-sm text-onyx-400 mb-4">Create your first WiFi package to start selling.</p>
              <button
                type="button"
                onClick={() => { resetForm(); setShowCreate(true); }}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create first package
              </button>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-left text-onyx-400 border-b border-white/[0.06]">
                  <th className="px-5 py-3 font-semibold">Package</th>
                  <th className="px-5 py-3 font-semibold">Price</th>
                  <th className="px-5 py-3 font-semibold">Sales</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-gold-5/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.isActive ? "bg-gold-10" : "bg-white/[0.04]"}`}>
                          <Package className={`w-4 h-4 ${p.isActive ? "text-gold" : "text-onyx-400"}`} />
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {p.name}
                            {p.isFeatured && <Star className="w-3 h-3 text-gold fill-gold/30" />}
                          </div>
                          <div className="text-xs text-onyx-400">
                            {p.duration.replace(/_/g, " ")}
                            {p.dataLimitMb ? ` · ${p.dataLimitMb} MB` : ""}
                            {p.maxDevices > 1 ? ` · ${p.maxDevices} devices` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono font-bold text-gold">{formatTzs(Math.round(p.price))}</td>
                    <td className="px-5 py-3">
                      <div className="text-onyx-300">{p.sales.totalSold} tx</div>
                      <div className="text-xs text-gold">{formatTzsCompact(p.sales.totalRevenue)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                        p.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void quickAction(p.id, "toggle")}
                          className="p-1.5 rounded-lg inline-flex transition-colors"
                          title={p.isActive ? "Deactivate" : "Activate"}
                        >
                          {p.isActive ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-onyx-400" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void quickAction(p.id, "feature")}
                          className={`p-1.5 rounded-lg inline-flex transition-colors ${p.isFeatured ? "text-gold bg-gold-10" : "text-onyx-400 hover:text-gold hover:bg-gold-10"}`}
                          title="Toggle featured"
                        >
                          <Star className={`w-4 h-4 ${p.isFeatured ? "fill-gold/30" : ""}`} />
                        </button>
                        <button type="button" onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-onyx-400 hover:text-white hover:bg-white/5 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => void remove(p.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Create/Edit modal ── */}
      {(showCreate || editId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={() => { setShowCreate(false); setEditId(null); resetForm(); }}>
          <form
            onSubmit={editId ? submitEdit : submitCreate}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-gold-20 bg-gradient-to-b from-onyx-900 to-onyx-950 p-6 space-y-4 my-8 shadow-2xl relative"
          >
            <button type="button" onClick={() => { setShowCreate(false); setEditId(null); resetForm(); }} className="absolute top-4 right-4 text-onyx-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-10 flex items-center justify-center">
                <Package className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-bold text-white">{editId ? "Edit package" : "New package"}</h2>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Duration preset</label>
              <select
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                value={
                  PRESETS.find((x) => x.duration === form.duration && x.minutes === form.durationMinutes)?.label ??
                  "__custom__"
                }
                onChange={(e) => {
                  if (e.target.value === "__custom__") return;
                  const pr = PRESETS.find((x) => x.label === e.target.value);
                  if (pr) setForm((f) => ({ ...f, duration: pr.duration, durationMinutes: pr.minutes }));
                }}
              >
                {PRESETS.map((pr) => (
                  <option key={pr.label} value={pr.label}>
                    {pr.label}
                  </option>
                ))}
                <option value="__custom__">Custom (edit enum + minutes)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Duration enum</label>
                <select
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value as DurationKey }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white focus:border-gold-30 outline-none transition-colors"
                >
                  {PRESETS.map((pr) => (
                    <option key={pr.duration} value={pr.duration}>
                      {pr.duration}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Minutes</label>
                <input
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Price (TZS)</label>
                <input
                  type="number"
                  min={100}
                  required
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Data cap (MB)</label>
                <input
                  type="number"
                  min={0}
                  value={form.dataLimitMb}
                  onChange={(e) => setForm((f) => ({ ...f, dataLimitMb: e.target.value === "" ? "" : Number(e.target.value) }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Max devices</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxDevices}
                  onChange={(e) => setForm((f) => ({ ...f, maxDevices: Number(e.target.value) }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Sort order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                />
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-onyx-300 cursor-pointer">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} className="w-4 h-4 rounded border-gold-30 bg-white/[0.04] text-gold focus:ring-gold/20" />
              Featured on captive portal
            </label>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setEditId(null);
                  resetForm();
                }}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-onyx-300 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all">
                {saving ? "Saving…" : "Save package"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Save, ExternalLink, Copy, Router, MapPin, Globe, Building2, User, Phone, FileText } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";

type Profile = {
  companyName: string;
  brandSlug: string;
  logo: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  portalUrl: string;
  user: { name: string | null; email: string | null; phone: string | null };
  stats: { devices: number; packages: number; sites: number; payments: number };
};

export default function ResellerProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    phone: "",
    address: "",
    logo: "",
    description: "",
    name: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function load() {
    setLoading(true);
    const r = await resellerJson<Profile>("/api/v1/reseller/profile");
    if (!r.ok) {
      setErr(r.error || "Failed");
      setP(null);
    } else if (r.data) {
      setErr(null);
      setP(r.data);
      setForm({
        companyName: r.data.companyName,
        phone: r.data.phone || "",
        address: r.data.address || "",
        logo: r.data.logo || "",
        description: r.data.description || "",
        name: r.data.user.name || "",
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setOk(false);
    const res = await fetch("/api/v1/reseller/profile", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({
        companyName: form.companyName.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        logo: form.logo.trim() || null,
        description: form.description.trim() || undefined,
        name: form.name.trim() || undefined,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) setErr(json.error || "Failed");
    else {
      setOk(true);
      void load();
    }
  }

  if (loading && !p && !err) {
    return (
      <div className="flex items-center gap-3 py-20 text-onyx-400">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }
  if (err && !p) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>;
  }
  if (!p) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const portal = `${origin}${p.portalUrl}`;

  function initials(name: string | null) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Profile & branding</h1>
        <p className="text-onyx-400 mt-1">
          Business identity on SSDomada. Subdomain / slug is set at registration — contact support to change it.
        </p>
      </div>

      {/* ── Avatar + identity ── */}
      <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-20 to-transparent opacity-50" />
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gold-10 flex items-center justify-center shrink-0">
            {p.logo ? (
              <img src={p.logo} alt="Logo" className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <span className="text-xl font-black text-gold">{initials(p.companyName)}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{p.companyName}</h2>
            <div className="text-xs text-gold-600-op font-mono">@{p.brandSlug}</div>
            <div className="text-xs text-onyx-400 mt-0.5">{p.user.email}</div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <Router className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Devices</span>
          </div>
          <div className="text-2xl font-black text-white">{p.stats.devices}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
              <Globe className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Sites</span>
          </div>
          <div className="text-2xl font-black text-white">{p.stats.sites}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Building2 className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Packages</span>
          </div>
          <div className="text-2xl font-black text-white">{p.stats.packages}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <FileText className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Payments</span>
          </div>
          <div className="text-2xl font-black text-white">{p.stats.payments}</div>
        </div>
      </div>

      {/* ── Portal URL ── */}
      <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Captive portal URL</div>
          <div className="font-mono text-sm text-gold break-all mt-0.5">{portal}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={portal} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 transition-all">
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(portal);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gold-20 bg-gold-10 px-3.5 py-2 text-xs font-bold text-gold hover:bg-gold-20 transition-all"
          >
            <Copy className="w-3 h-3" />
            Copy
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}
      {ok && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Saved.</div>}

      {/* ── Form sections ── */}
      <form onSubmit={save} className="space-y-5">
        {/* Identity section */}
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-5 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-20 to-transparent opacity-50" />
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center">
              <User className="w-4 h-4 text-gold" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Identity</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Brand slug (read only)</label>
              <input readOnly value={p.brandSlug} className="mt-1.5 w-full rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm text-onyx-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Your name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Company name</label>
            <input
              required
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Logo URL</label>
            <input
              value={form.logo}
              onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              placeholder="https://…"
            />
          </div>
        </div>

        {/* Contact section */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Phone className="w-4 h-4 text-sky-400" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Contact</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors resize-y"
            />
          </div>
          <div className="text-xs text-onyx-500">
            Login email: <span className="text-onyx-300">{p.user.email}</span> — change in account settings if we add email
            change later.
          </div>
        </div>

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>

      <p className="text-xs text-onyx-500">
        Custom domains point DNS to SSDomada —{" "}
        <Link href="/docs" className="text-gold hover:underline">
          read docs
        </Link>{" "}
        or contact support.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Save,
  ExternalLink,
  Copy,
  Router,
  Globe,
  Building2,
  User,
  Phone,
  FileText,
  Settings,
  Palette,
  Sparkles,
  Check,
} from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import {
  AccountAlert,
  AccountInput,
  AccountPageHeader,
  AccountPageShell,
  AccountPrimaryButton,
  AccountSecondaryButton,
  AccountSection,
  AccountTextarea,
  FieldLabel,
  StatPill,
} from "@/components/reseller/ResellerAccountUi";

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
  planFeatures?: { customBranding: boolean };
};

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

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
  const [copied, setCopied] = useState(false);

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
    const body: Record<string, unknown> = {
      companyName: form.companyName.trim(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      name: form.name.trim() || undefined,
    };
    if (p?.planFeatures?.customBranding) {
      body.logo = form.logo.trim() || null;
      body.description = form.description.trim() || null;
    }

    const res = await fetch("/api/v1/reseller/profile", {
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
      setOk(true);
      void load();
      window.setTimeout(() => setOk(false), 4000);
    }
  }

  async function copyPortal(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading && !p && !err) {
    return (
      <div className="flex items-center gap-3 py-20 text-onyx-400">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        Loading profile…
      </div>
    );
  }
  if (err && !p) {
    return <AccountAlert variant="error">{err}</AccountAlert>;
  }
  if (!p) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const portal = `${origin}${p.portalUrl}`;
  const canUseCustomBranding = Boolean(p.planFeatures?.customBranding);

  return (
    <AccountPageShell>
      <AccountPageHeader
        title="Profile & brand"
        description="How guests see your business — company details, portal link, and optional branding on higher plans."
        actions={
          <>
            <AccountSecondaryButton href="/reseller/settings">
              <Settings className="w-4 h-4" />
              Account settings
            </AccountSecondaryButton>
            <AccountSecondaryButton href="/reseller/captive-portal">
              <Palette className="w-4 h-4" />
              Captive portal
            </AccountSecondaryButton>
          </>
        }
      />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-gold-20 bg-gradient-to-br from-gold-5/50 via-onyx-900/80 to-onyx-950 p-6 md:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-gold-25 bg-gold-10 shadow-lg shadow-gold/10 overflow-hidden">
            {p.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-gold">{initials(p.companyName)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-gold-30 bg-gold-10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold mb-2">
              <Sparkles className="w-3 h-3" />
              {p.currency} · Reseller
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white truncate">{p.companyName}</h2>
            <p className="text-sm text-onyx-400 mt-1">
              <span className="font-mono text-gold">@{p.brandSlug}</span>
              <span className="mx-2 text-onyx-600">·</span>
              {p.user.email}
            </p>
            {p.user.name && <p className="text-sm text-onyx-300 mt-0.5">{p.user.name}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatPill label="Devices" value={p.stats.devices} icon={<Router className="w-3.5 h-3.5" />} variant="gold" />
        <StatPill label="Sites" value={p.stats.sites} icon={<Globe className="w-3.5 h-3.5" />} />
        <StatPill label="Packages" value={p.stats.packages} icon={<Building2 className="w-3.5 h-3.5" />} />
        <StatPill label="Payments" value={p.stats.payments} icon={<FileText className="w-3.5 h-3.5" />} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <form onSubmit={save} className="space-y-5 min-w-0">
          {err && <AccountAlert variant="error">{err}</AccountAlert>}
          {ok && <AccountAlert variant="success">Profile saved successfully.</AccountAlert>}

          <AccountSection
            title="Business identity"
            description="Shown on invoices and your public WiFi login."
            icon={<User className="w-5 h-5" />}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel hint="Cannot be changed here">Brand slug</FieldLabel>
                <AccountInput readOnly value={p.brandSlug} className="text-onyx-400 bg-white/[0.02]" />
              </div>
              <div>
                <FieldLabel>Your name</FieldLabel>
                <AccountInput
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Contact person"
                />
              </div>
            </div>
            <div className="mt-4">
              <FieldLabel>Company name</FieldLabel>
              <AccountInput
                required
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              />
            </div>
            <div className="mt-4">
              <FieldLabel>
                Logo URL
                {!canUseCustomBranding && (
                  <span className="text-onyx-500 normal-case font-normal"> — upgrade plan for custom branding</span>
                )}
              </FieldLabel>
              <AccountInput
                value={form.logo}
                onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))}
                disabled={!canUseCustomBranding}
                placeholder="https://…"
              />
            </div>
          </AccountSection>

          <AccountSection
            title="Contact & about"
            description="Optional details for support and guest-facing copy."
            icon={<Phone className="w-5 h-5" />}
            accent="sky"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Phone</FieldLabel>
                <AccountInput
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+255…"
                />
              </div>
              <div>
                <FieldLabel>Address</FieldLabel>
                <AccountInput
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="City / area"
                />
              </div>
            </div>
            <div className="mt-4">
              <FieldLabel>Short description</FieldLabel>
              <AccountTextarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                disabled={!canUseCustomBranding}
                rows={3}
                placeholder="What guests should know about your WiFi…"
              />
            </div>
            <p className="mt-4 text-xs text-onyx-500 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              Login email: <span className="text-onyx-300">{p.user.email}</span>. Contact support to change it.
            </p>
          </AccountSection>

          <AccountPrimaryButton type="submit" loading={saving}>
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save profile"}
          </AccountPrimaryButton>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <AccountSection
            title="Guest WiFi link"
            description="Share this URL or QR so customers open your captive portal."
            icon={<Globe className="w-5 h-5" />}
            accent="emerald"
          >
            <p className="font-mono text-xs text-gold break-all leading-relaxed bg-onyx-950/60 rounded-xl border border-white/[0.06] p-3">
              {portal}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <a
                href={portal}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-xl bg-gold px-3 py-2.5 text-xs font-bold text-onyx-950 hover:bg-gold-400 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open portal
              </a>
              <button
                type="button"
                onClick={() => void copyPortal(portal)}
                className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-xl border border-gold-25 bg-gold-10 px-3 py-2.5 text-xs font-bold text-gold hover:bg-gold-20 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </AccountSection>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-onyx-500 leading-relaxed">
            Custom domains need DNS pointed to SSDomada — see{" "}
            <Link href="/docs" className="text-gold hover:underline font-semibold">
              documentation
            </Link>{" "}
            or contact support.
          </div>
        </aside>
      </div>
    </AccountPageShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2, ExternalLink, Save, Globe, Palette, FileText, Layout, Eye, Upload } from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { authFetch } from "@/lib/auth-client";
import { resolveCaptiveAssetUrl } from "@/lib/portal-assets";

type Config = {
  id: string;
  logo: string | null;
  bgImage: string | null;
  bgColor: string;
  primaryColor: string;
  accentColor: string;
  companyName: string | null;
  welcomeText: string | null;
  termsUrl: string | null;
  termsText: string | null;
  template: string;
  redirectUrl: string | null;
  showLogo: boolean;
  showSocial: boolean;
  socialLinks: Record<string, string> | null;
};

type CaptivePayload = {
  config: Config;
  packages: unknown[];
  portalUrl: string;
  previewUrl: string;
  availableTemplates: string[];
};

const MAX_CAPTIVE_IMAGE_BYTES = 2 * 1024 * 1024;
const CAPTIVE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export default function ResellerCaptivePortalPage() {
  const [payload, setPayload] = useState<CaptivePayload | null>(null);
  const [form, setForm] = useState<Partial<Config> & Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<null | "logo" | "bgImage">(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    const r = await resellerJson<CaptivePayload>("/api/v1/reseller/captive-portal");
    if (!r.ok) {
      setErr(r.error || "Failed");
      setLoading(false);
      return;
    }
    setPayload(r.data!);
    setForm({ ...r.data!.config });
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function uploadCaptiveAsset(kind: "logo" | "bgImage", file: File) {
    if (file.size > MAX_CAPTIVE_IMAGE_BYTES) {
      setErr("Image must be 2 MB or smaller (PNG, JPEG, WebP, GIF).");
      return;
    }
    setUploading(kind);
    setErr(null);
    setOk(null);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);
      const res = await authFetch("/api/v1/reseller/captive-portal/asset", { method: "POST", body: fd });
      const json = (await res.json()) as { success?: boolean; data?: { url: string }; error?: string };
      if (!res.ok || json.success === false) {
        setErr(json.error || "Upload failed");
        return;
      }
      const url = json.data?.url;
      if (!url) {
        setErr("Upload failed");
        return;
      }
      setForm((f) => ({ ...f, [kind]: url }));
      setOk(kind === "logo" ? "Logo uploaded — click Save to apply." : "Background uploaded — click Save to apply.");
    } finally {
      setUploading(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setOk(null);
    const body = {
      logo: form.logo || null,
      bgImage: form.bgImage || null,
      bgColor: form.bgColor,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      companyName: form.companyName || undefined,
      welcomeText: form.welcomeText || undefined,
      termsUrl: form.termsUrl || null,
      termsText: form.termsText || null,
      template: form.template,
      redirectUrl: form.redirectUrl || null,
      showLogo: form.showLogo,
      showSocial: form.showSocial,
      socialLinks: form.socialLinks || undefined,
    };
    const res = await fetch("/api/v1/reseller/captive-portal", {
      method: "PUT",
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
      setOk("Saved");
      void load();
    }
  }

  if (loading || !payload) {
    return (
      <div className="flex items-center gap-3 text-onyx-400 py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        Loading portal…
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewFull = `${origin}${payload.previewUrl}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Captive portal</h1>
          <p className="text-onyx-400 mt-1">Branding, legal copy, templates, and post-payment redirect.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={previewFull}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
          >
            <Eye className="w-4 h-4" />
            Preview
          </a>
          <a
            href={`${origin}${payload.portalUrl}`}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Live portal
          </a>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}
      {ok && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{ok}</div>}

      {/* ── Preview iframe ── */}
      <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
          <Globe className="w-4 h-4 text-gold" />
          <span className="text-xs font-bold uppercase tracking-wider text-gold-600-op">Live preview</span>
        </div>
        <div className="bg-white/5">
          <iframe
            src={previewFull}
            className="w-full h-96 border-0"
            title="Captive portal preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      </div>

      <form onSubmit={save} className="space-y-5">
        {/* ── Branding section ── */}
        <div className="rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-5 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-20 to-transparent opacity-50" />
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gold-10 flex items-center justify-center">
              <Layout className="w-4 h-4 text-gold" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Branding</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Business name</label>
              <input
                value={(form.companyName as string) || ""}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Welcome message</label>
              <input
                value={(form.welcomeText as string) || ""}
                onChange={(e) => setForm((f) => ({ ...f, welcomeText: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Logo (upload)
              </label>
              <p className="mt-0.5 text-[11px] text-onyx-500">PNG, JPEG, WebP, or GIF · max 2 MB</p>
              <div className="mt-1.5 space-y-2">
                {(form.logo as string) ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveCaptiveAssetUrl(form.logo as string) || ""}
                      alt="Logo preview"
                      className="h-14 w-14 rounded-xl object-cover border border-white/10 bg-onyx-900"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, logo: null }))}
                      className="text-xs font-semibold text-red-300 hover:text-red-200 underline-offset-2 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept={CAPTIVE_IMAGE_ACCEPT}
                  disabled={uploading === "logo"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadCaptiveAsset("logo", f);
                  }}
                  className="block w-full text-xs text-onyx-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-gold hover:file:bg-gold/25"
                />
                {uploading === "logo" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-onyx-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Background image (upload)
              </label>
              <p className="mt-0.5 text-[11px] text-onyx-500">PNG, JPEG, WebP, or GIF · max 2 MB</p>
              <div className="mt-1.5 space-y-2">
                {(form.bgImage as string) ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveCaptiveAssetUrl(form.bgImage as string) || ""}
                      alt="Background preview"
                      className="h-14 w-24 rounded-xl object-cover border border-white/10 bg-onyx-900"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, bgImage: null }))}
                      className="text-xs font-semibold text-red-300 hover:text-red-200 underline-offset-2 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept={CAPTIVE_IMAGE_ACCEPT}
                  disabled={uploading === "bgImage"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadCaptiveAsset("bgImage", f);
                  }}
                  className="block w-full text-xs text-onyx-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-gold hover:file:bg-gold/25"
                />
                {uploading === "bgImage" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-onyx-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Template section ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Palette className="w-4 h-4 text-sky-400" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Template & Colors</h3>
          </div>
          <div>
            <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Template</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {payload.availableTemplates.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, template: t }))}
                  className={`rounded-xl px-4 py-2 text-xs font-bold capitalize border transition-all ${
                    form.template === t
                      ? "border-gold-30 text-gold bg-gold-10 shadow-sm shadow-gold/5"
                      : "border-gold-10 text-onyx-400 hover:border-gold-20 hover:text-onyx-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(["bgColor", "primaryColor", "accentColor"] as const).map((key) => (
              <div key={key}>
                <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">
                  {key === "bgColor" ? "Background" : key === "primaryColor" ? "Primary" : "Accent"}
                </label>
                <div className="mt-1.5 flex gap-2 items-center">
                  <input
                    type="color"
                    value={(form[key] as string)?.startsWith("#") ? (form[key] as string) : "#ffffff"}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="h-10 w-14 rounded-lg border border-gold-10 bg-transparent cursor-pointer"
                  />
                  <input
                    value={(form[key] as string) || "#ffffff"}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-mono text-white focus:border-gold-30 outline-none transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Legal & redirect section ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Legal & Redirect</h3>
          </div>
          <div>
            <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Terms & conditions (text)</label>
            <textarea
              value={(form.termsText as string) || ""}
              onChange={(e) => setForm((f) => ({ ...f, termsText: e.target.value || null }))}
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors resize-y"
              placeholder="Shown on portal if set…"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Terms URL (optional)</label>
              <input
                value={(form.termsUrl as string) || ""}
                onChange={(e) => setForm((f) => ({ ...f, termsUrl: e.target.value || null }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gold-600-op uppercase tracking-wider">Redirect after payment</label>
              <input
                value={(form.redirectUrl as string) || ""}
                onChange={(e) => setForm((f) => ({ ...f, redirectUrl: e.target.value || null }))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
                placeholder="https://your-site.com/thank-you"
              />
            </div>
          </div>
        </div>

        {/* ── Toggles & save ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 space-y-4">
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2.5 text-sm text-onyx-300 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.showLogo}
                onChange={(e) => setForm((f) => ({ ...f, showLogo: e.target.checked }))}
                className="w-4 h-4 rounded border-gold-30 bg-white/[0.04] text-gold focus:ring-gold/20"
              />
              Show logo
            </label>
            <label className="flex items-center gap-2.5 text-sm text-onyx-300 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.showSocial}
                onChange={(e) => setForm((f) => ({ ...f, showSocial: e.target.checked }))}
                className="w-4 h-4 rounded border-gold-30 bg-white/[0.04] text-gold focus:ring-gold/20"
              />
              Show social links
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe,
  Loader2,
  RefreshCw,
  Save,
  ExternalLink,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import {
  defaultLandingPageConfig,
  type LandingFooterLink,
  type LandingPageConfig,
  type LandingSocialLink,
  type LocalizedString,
} from "@/lib/landing-page-settings";

type TabId = "brand" | "hero" | "cta" | "footer" | "social" | "links" | "seo";

const TABS: { id: TabId; label: string }[] = [
  { id: "brand", label: "Brand" },
  { id: "hero", label: "Hero" },
  { id: "cta", label: "CTA" },
  { id: "footer", label: "Footer & contact" },
  { id: "social", label: "Social" },
  { id: "links", label: "Links" },
  { id: "seo", label: "SEO" },
];

function uid() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function LocalizedInput({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: LocalizedString;
  onChange: (v: LocalizedString) => void;
  multiline?: boolean;
}) {
  const field = (lang: "en" | "sw", placeholder: string) =>
    multiline ? (
      <textarea
        value={value[lang]}
        onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
      />
    ) : (
      <input
        value={value[lang]}
        onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
      />
    );

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-onyx-400">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="text-[10px] text-onyx-500 mb-1 block">English</span>
          {field("en", "English…")}
        </div>
        <div>
          <span className="text-[10px] text-onyx-500 mb-1 block">Kiswahili</span>
          {field("sw", "Kiswahili…")}
        </div>
      </div>
    </div>
  );
}

function SocialEditor({
  links,
  onChange,
}: {
  links: LandingSocialLink[];
  onChange: (links: LandingSocialLink[]) => void;
}) {
  return (
    <div className="space-y-3">
      {links.map((link, i) => (
        <div
          key={link.id}
          className="rounded-xl border border-white/10 bg-onyx-900/50 p-4 grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto]"
        >
          <label className="flex items-center gap-2 text-sm text-onyx-300">
            <input
              type="checkbox"
              checked={link.enabled}
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...link, enabled: e.target.checked };
                onChange(next);
              }}
              className="rounded border-white/20"
            />
            On
          </label>
          <select
            value={link.platform}
            onChange={(e) => {
              const next = [...links];
              next[i] = { ...link, platform: e.target.value as LandingSocialLink["platform"] };
              onChange(next);
            }}
            className="rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
          >
            <option value="x">X (Twitter)</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="custom">Custom</option>
          </select>
          <input
            value={link.url}
            onChange={(e) => {
              const next = [...links];
              next[i] = { ...link, url: e.target.value };
              onChange(next);
            }}
            placeholder="https://…"
            className="rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white sm:col-span-2"
          />
          <input
            value={link.label}
            onChange={(e) => {
              const next = [...links];
              next[i] = { ...link, label: e.target.value };
              onChange(next);
            }}
            placeholder="Button label (optional)"
            className="rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...links,
            { id: uid(), platform: "custom", label: "", url: "", enabled: true },
          ])
        }
        className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
      >
        <Plus className="h-4 w-4" />
        Add social link
      </button>
    </div>
  );
}

function FooterLinksEditor({
  title,
  links,
  onChange,
}: {
  title: string;
  links: LandingFooterLink[];
  onChange: (links: LandingFooterLink[]) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {links.map((link, i) => (
        <div key={link.id} className="rounded-xl border border-white/10 bg-onyx-900/50 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-onyx-300">
            <input
              type="checkbox"
              checked={link.enabled}
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...link, enabled: e.target.checked };
                onChange(next);
              }}
            />
            Visible on site
          </label>
          <LocalizedInput
            label="Label"
            value={link.label}
            onChange={(label) => {
              const next = [...links];
              next[i] = { ...link, label };
              onChange(next);
            }}
          />
          <input
            value={link.href}
            onChange={(e) => {
              const next = [...links];
              next[i] = { ...link, href: e.target.value };
              onChange(next);
            }}
            placeholder="URL or #section"
            className="w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => onChange(links.filter((_, j) => j !== i))}
            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...links,
            { id: uid(), label: { en: "New link", sw: "Kiungo kipya" }, href: "#", enabled: true },
          ])
        }
        className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
      >
        <Plus className="h-4 w-4" />
        Add link
      </button>
    </div>
  );
}

export default function AdminLandingPageSettings() {
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [tab, setTab] = useState<TabId>("footer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const r = await adminJson<{ config: LandingPageConfig }>("/api/v1/admin/landing-page");
    if (!r.ok) setErr(r.error || "Failed to load");
    else setConfig(r.data!.config);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setErr(null);
    setSaved(false);
    const r = await adminJson<{ config: LandingPageConfig }>("/api/v1/admin/landing-page", {
      method: "PUT",
      body: JSON.stringify(config),
    });
    setSaving(false);
    if (!r.ok) {
      setErr(r.error || "Save failed");
      return;
    }
    setConfig(r.data!.config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function resetDefaults() {
    if (!confirm("Reset all landing page fields to defaults? This cannot be undone until you save.")) return;
    setConfig(defaultLandingPageConfig());
  }

  if (loading || !config) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-onyx-400">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white md:text-4xl flex items-center gap-3">
            <Globe className="h-8 w-8 text-gold" />
            Landing page
          </h1>
          <p className="mt-1 text-onyx-400 max-w-2xl">
            Control public homepage copy, footer contact, social links, and legal URLs. Changes appear on{" "}
            <Link href="/" target="_blank" className="text-gold hover:underline inline-flex items-center gap-1">
              ssdomada.com <ExternalLink className="w-3 h-3" />
            </Link>{" "}
            after save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-onyx-300 hover:bg-white/5"
          >
            <RotateCcw className="h-4 w-4" />
            Reset defaults
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 hover:bg-gold-400 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-gold text-onyx-950" : "text-onyx-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-onyx-900/40 p-6 space-y-6">
        {tab === "brand" && (
          <>
            <input
              value={config.brand.name}
              onChange={(e) => setConfig({ ...config, brand: { ...config.brand, name: e.target.value } })}
              placeholder="Brand name"
              className="w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
            />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-onyx-400">Logo URL</span>
              <input
                value={config.brand.logoUrl}
                onChange={(e) => setConfig({ ...config, brand: { ...config.brand, logoUrl: e.target.value } })}
                placeholder="/images/SSDomada.png or https://…"
                className="mt-1 w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
              />
            </div>
          </>
        )}

        {tab === "hero" && (
          <>
            <LocalizedInput
              label="Badge line"
              value={config.hero.poweredBy}
              onChange={(poweredBy) => setConfig({ ...config, hero: { ...config.hero, poweredBy } })}
            />
            {(["en", "sw"] as const).map((lang) => (
              <div key={lang} className="space-y-2">
                <span className="text-xs font-bold uppercase text-onyx-400">
                  Headline ({lang === "en" ? "English" : "Kiswahili"}) — 3 lines
                </span>
                {config.hero.h1[lang].map((line, i) => (
                  <input
                    key={`${lang}-${i}`}
                    value={line}
                    onChange={(e) => {
                      const h1 = { ...config.hero.h1 };
                      const lines = [...h1[lang]] as [string, string, string];
                      lines[i] = e.target.value;
                      h1[lang] = lines;
                      setConfig({ ...config, hero: { ...config.hero, h1 } });
                    }}
                    className="w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
                  />
                ))}
              </div>
            ))}
            <LocalizedInput
              label="Subheadline"
              value={config.hero.sub}
              multiline
              onChange={(sub) => setConfig({ ...config, hero: { ...config.hero, sub } })}
            />
            <LocalizedInput
              label="Highlight line (gold)"
              value={config.hero.subHighlight}
              onChange={(subHighlight) => setConfig({ ...config, hero: { ...config.hero, subHighlight } })}
            />
            <LocalizedInput
              label="Primary button"
              value={config.hero.ctaPrimary}
              onChange={(ctaPrimary) => setConfig({ ...config, hero: { ...config.hero, ctaPrimary } })}
            />
            <LocalizedInput
              label="Secondary button"
              value={config.hero.ctaSecondary}
              onChange={(ctaSecondary) => setConfig({ ...config, hero: { ...config.hero, ctaSecondary } })}
            />
          </>
        )}

        {tab === "cta" && (
          <>
            <LocalizedInput
              label="Title"
              value={config.cta.title}
              onChange={(title) => setConfig({ ...config, cta: { ...config.cta, title } })}
            />
            <LocalizedInput
              label="Title highlight"
              value={config.cta.titleLine2}
              onChange={(titleLine2) => setConfig({ ...config, cta: { ...config.cta, titleLine2 } })}
            />
            <LocalizedInput
              label="Description"
              value={config.cta.sub}
              multiline
              onChange={(sub) => setConfig({ ...config, cta: { ...config.cta, sub } })}
            />
            <LocalizedInput
              label="Primary button"
              value={config.cta.primary}
              onChange={(primary) => setConfig({ ...config, cta: { ...config.cta, primary } })}
            />
            <LocalizedInput
              label="Contact button label"
              value={config.cta.secondary}
              onChange={(secondary) => setConfig({ ...config, cta: { ...config.cta, secondary } })}
            />
            <div>
              <span className="text-xs font-bold uppercase text-onyx-400">Contact email (mailto)</span>
              <input
                type="email"
                value={config.cta.contactEmail}
                onChange={(e) => setConfig({ ...config, cta: { ...config.cta, contactEmail: e.target.value } })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
              />
            </div>
          </>
        )}

        {tab === "footer" && (
          <>
            <LocalizedInput
              label="Brand blurb (under logo)"
              value={config.footer.blurb}
              multiline
              onChange={(blurb) => setConfig({ ...config, footer: { ...config.footer, blurb } })}
            />
            <LocalizedInput
              label="Product column title"
              value={config.footer.productTitle}
              onChange={(productTitle) => setConfig({ ...config, footer: { ...config.footer, productTitle } })}
            />
            <LocalizedInput
              label="Company column title"
              value={config.footer.companyTitle}
              onChange={(companyTitle) => setConfig({ ...config, footer: { ...config.footer, companyTitle } })}
            />
            <LocalizedInput
              label="Contact column title"
              value={config.footer.contactTitle}
              onChange={(contactTitle) => setConfig({ ...config, footer: { ...config.footer, contactTitle } })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs font-bold uppercase text-onyx-400">Email</span>
                <input
                  type="email"
                  value={config.footer.contact.email}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: {
                        ...config.footer,
                        contact: { ...config.footer.contact, email: e.target.value },
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-onyx-400">Phone</span>
                <input
                  value={config.footer.contact.phone}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: {
                        ...config.footer,
                        contact: { ...config.footer.contact, phone: e.target.value },
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <LocalizedInput
              label="Location"
              value={config.footer.contact.location}
              onChange={(location) =>
                setConfig({
                  ...config,
                  footer: { ...config.footer, contact: { ...config.footer.contact, location } },
                })
              }
            />
            <LocalizedInput
              label="Support line"
              value={config.footer.contact.supportNote}
              onChange={(supportNote) =>
                setConfig({
                  ...config,
                  footer: { ...config.footer, contact: { ...config.footer.contact, supportNote } },
                })
              }
            />
            <div>
              <span className="text-xs font-bold uppercase text-onyx-400">Copyright year</span>
              <input
                type="number"
                value={config.footer.copyrightYear}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    footer: { ...config.footer, copyrightYear: Number(e.target.value) || new Date().getFullYear() },
                  })
                }
                className="mt-1 w-32 rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
              />
            </div>
            <LocalizedInput
              label="Rights text"
              value={config.footer.rightsText}
              onChange={(rightsText) => setConfig({ ...config, footer: { ...config.footer, rightsText } })}
            />
          </>
        )}

        {tab === "social" && (
          <SocialEditor
            links={config.footer.social}
            onChange={(social) => setConfig({ ...config, footer: { ...config.footer, social } })}
          />
        )}

        {tab === "links" && (
          <div className="space-y-10">
            <FooterLinksEditor
              title="Product links"
              links={config.footer.productLinks}
              onChange={(productLinks) => setConfig({ ...config, footer: { ...config.footer, productLinks } })}
            />
            <FooterLinksEditor
              title="Company links"
              links={config.footer.companyLinks}
              onChange={(companyLinks) => setConfig({ ...config, footer: { ...config.footer, companyLinks } })}
            />
            <FooterLinksEditor
              title="Legal links (footer bottom)"
              links={config.footer.legalLinks}
              onChange={(legalLinks) => setConfig({ ...config, footer: { ...config.footer, legalLinks } })}
            />
          </div>
        )}

        {tab === "seo" && (
          <>
            <div>
              <span className="text-xs font-bold uppercase text-onyx-400">Browser tab title</span>
              <input
                value={config.seo.pageTitle}
                onChange={(e) => setConfig({ ...config, seo: { ...config.seo, pageTitle: e.target.value } })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-onyx-900 px-3 py-2 text-sm text-white"
              />
            </div>
            <LocalizedInput
              label="Meta description"
              value={config.seo.description}
              multiline
              onChange={(description) => setConfig({ ...config, seo: { ...config.seo, description } })}
            />
            <p className="text-xs text-onyx-500">
              SEO fields are stored for future use; the live site title may still use layout defaults until wired.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

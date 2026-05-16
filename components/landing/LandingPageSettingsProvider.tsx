"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLandingLocale } from "@/components/landing-locale";
import { landingCopy, type LandingCopy, type Locale } from "@/lib/landing-i18n";
import {
  enabledFooterLinks,
  pickLocalized,
  type LandingPageConfig,
} from "@/lib/landing-page-settings";

type LandingPageContextValue = {
  config: LandingPageConfig | null;
  loading: boolean;
  /** i18n copy merged with CMS overrides (hero, cta, footer blurb & link labels). */
  t: LandingCopy;
};

const LandingPageContext = createContext<LandingPageContextValue | null>(null);

function mergeCopy(locale: Locale, config: LandingPageConfig | null): LandingCopy {
  const base = landingCopy(locale);
  if (!config) return base;

  return {
    ...base,
    hero: {
      ...base.hero,
      poweredBy: pickLocalized(config.hero.poweredBy, locale),
      h1: config.hero.h1[locale],
      sub: pickLocalized(config.hero.sub, locale),
      subHighlight: pickLocalized(config.hero.subHighlight, locale),
      ctaPrimary: pickLocalized(config.hero.ctaPrimary, locale),
      ctaSecondary: pickLocalized(config.hero.ctaSecondary, locale),
    },
    cta: {
      ...base.cta,
      title: pickLocalized(config.cta.title, locale),
      titleLine2: pickLocalized(config.cta.titleLine2, locale),
      sub: pickLocalized(config.cta.sub, locale),
      primary: pickLocalized(config.cta.primary, locale),
      secondary: pickLocalized(config.cta.secondary, locale),
    },
    footer: {
      ...base.footer,
      blurb: pickLocalized(config.footer.blurb, locale),
      product: pickLocalized(config.footer.productTitle, locale),
      company: pickLocalized(config.footer.companyTitle, locale),
      contact: pickLocalized(config.footer.contactTitle, locale),
      productLinks: enabledFooterLinks(config.footer.productLinks, locale),
    },
  };
}

export function LandingPageSettingsProvider({ children }: { children: ReactNode }) {
  const { locale } = useLandingLocale();
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/public/landing-page")
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: LandingPageConfig }) => {
        if (!cancelled && j?.success && j.data) setConfig(j.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const t = useMemo(() => mergeCopy(locale, config), [locale, config]);

  const value = useMemo(() => ({ config, loading, t }), [config, loading, t]);

  return <LandingPageContext.Provider value={value}>{children}</LandingPageContext.Provider>;
}

export function useLandingPageConfig() {
  const ctx = useContext(LandingPageContext);
  if (!ctx) {
    throw new Error("useLandingPageConfig must be used within LandingPageSettingsProvider");
  }
  return ctx;
}

import { landingCopy, type Locale } from "@/lib/landing-i18n";

export const LANDING_PAGE_SETTING_KEY = "landing_page_config";

export type LocalizedString = { en: string; sw: string };

export type LandingSocialPlatform =
  | "x"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "whatsapp"
  | "custom";

export type LandingSocialLink = {
  id: string;
  platform: LandingSocialPlatform;
  label: string;
  url: string;
  enabled: boolean;
};

export type LandingFooterLink = {
  id: string;
  label: LocalizedString;
  href: string;
  enabled: boolean;
};

export type LandingPageConfig = {
  brand: {
    name: string;
    logoUrl: string;
  };
  hero: {
    poweredBy: LocalizedString;
    h1: { en: [string, string, string]; sw: [string, string, string] };
    sub: LocalizedString;
    subHighlight: LocalizedString;
    ctaPrimary: LocalizedString;
    ctaSecondary: LocalizedString;
  };
  cta: {
    title: LocalizedString;
    titleLine2: LocalizedString;
    sub: LocalizedString;
    primary: LocalizedString;
    secondary: LocalizedString;
    contactEmail: string;
  };
  footer: {
    blurb: LocalizedString;
    productTitle: LocalizedString;
    companyTitle: LocalizedString;
    contactTitle: LocalizedString;
    contact: {
      email: string;
      phone: string;
      location: LocalizedString;
      supportNote: LocalizedString;
    };
    social: LandingSocialLink[];
    productLinks: LandingFooterLink[];
    companyLinks: LandingFooterLink[];
    legalLinks: LandingFooterLink[];
    copyrightYear: number;
    rightsText: LocalizedString;
  };
  seo: {
    pageTitle: string;
    description: LocalizedString;
  };
};

function L(en: string, sw: string): LocalizedString {
  return { en, sw };
}

function defaultSocial(): LandingSocialLink[] {
  return [
    { id: "x", platform: "x", label: "X", url: "", enabled: false },
    { id: "instagram", platform: "instagram", label: "Instagram", url: "", enabled: false },
    { id: "facebook", platform: "facebook", label: "Facebook", url: "", enabled: false },
    { id: "linkedin", platform: "linkedin", label: "LinkedIn", url: "", enabled: false },
    { id: "youtube", platform: "youtube", label: "YouTube", url: "", enabled: false },
    { id: "whatsapp", platform: "whatsapp", label: "WhatsApp", url: "", enabled: false },
  ];
}

function linkFromProduct(
  enLabel: string,
  swLabel: string,
  href: string,
  id: string
): LandingFooterLink {
  return { id, label: L(enLabel, swLabel), href, enabled: true };
}

export function defaultLandingPageConfig(): LandingPageConfig {
  const en = landingCopy("en");
  const sw = landingCopy("sw");

  return {
    brand: {
      name: "SSDomada",
      logoUrl: "/images/SSDomada.png",
    },
    hero: {
      poweredBy: L(en.hero.poweredBy, sw.hero.poweredBy),
      h1: {
        en: [...en.hero.h1] as [string, string, string],
        sw: [...sw.hero.h1] as [string, string, string],
      },
      sub: L(en.hero.sub, sw.hero.sub),
      subHighlight: L(en.hero.subHighlight, sw.hero.subHighlight),
      ctaPrimary: L(en.hero.ctaPrimary, sw.hero.ctaPrimary),
      ctaSecondary: L(en.hero.ctaSecondary, sw.hero.ctaSecondary),
    },
    cta: {
      title: L(en.cta.title, sw.cta.title),
      titleLine2: L(en.cta.titleLine2, sw.cta.titleLine2),
      sub: L(en.cta.sub, sw.cta.sub),
      primary: L(en.cta.primary, sw.cta.primary),
      secondary: L(en.cta.secondary, sw.cta.secondary),
      contactEmail: "support@ssdomada.com",
    },
    footer: {
      blurb: L(en.footer.blurb, sw.footer.blurb),
      productTitle: L(en.footer.product, sw.footer.product),
      companyTitle: L(en.footer.company, sw.footer.company),
      contactTitle: L(en.footer.contact, sw.footer.contact),
      contact: {
        email: "support@ssdomada.com",
        phone: "+255 700 000 000",
        location: L("Dar es Salaam, Tanzania", "Dar es Salaam, Tanzania"),
        supportNote: L("24/7 Support", "Msaada 24/7"),
      },
      social: defaultSocial(),
      productLinks: en.footer.productLinks.map((l, i) =>
        linkFromProduct(l.label, sw.footer.productLinks[i]?.label ?? l.label, l.href, `product-${i}`)
      ),
      companyLinks: [
        linkFromProduct("About Us", "Kuhusu sisi", "#", "about"),
        linkFromProduct("Blog", "Blogu", "#", "blog"),
        linkFromProduct("Careers", "Ajira", "#", "careers"),
        linkFromProduct("Partners", "Washirika", "#", "partners"),
      ],
      legalLinks: [
        linkFromProduct("Privacy Policy", "Sera ya faragha", "#", "privacy"),
        linkFromProduct("Terms of Service", "Masharti ya huduma", "#", "terms"),
        linkFromProduct("Cookie Policy", "Sera ya vidakuzi", "#", "cookies"),
      ],
      copyrightYear: new Date().getFullYear(),
      rightsText: L("All rights reserved.", "Haki zote zimehifadhiwa."),
    },
    seo: {
      pageTitle: "SSDomada — Omada WiFi Billing System",
      description: L(
        "Sell guest Wi‑Fi easily. Captive portal, mobile payments, and Omada management in one place.",
        "Uza WiFi kwa urahisi. Captive portal, malipo ya simu, na usimamizi wa Omada — mahali pamoja."
      ),
    },
  };
}

export function pickLocalized(ls: LocalizedString, locale: Locale): string {
  return locale === "sw" ? ls.sw : ls.en;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge stored partial config onto defaults. */
export function mergeLandingPageConfig(partial: unknown): LandingPageConfig {
  const base = defaultLandingPageConfig();
  if (!isPlainObject(partial)) return base;

  function merge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      const sv = source[key];
      const tv = out[key as keyof T];
      if (Array.isArray(sv)) {
        (out as Record<string, unknown>)[key] = sv;
      } else if (isPlainObject(sv) && isPlainObject(tv)) {
        (out as Record<string, unknown>)[key] = merge({ ...tv }, sv);
      } else if (sv !== undefined) {
        (out as Record<string, unknown>)[key] = sv;
      }
    }
    return out;
  }

  return merge(base as unknown as Record<string, unknown>, partial) as unknown as LandingPageConfig;
}

export function enabledFooterLinks(links: LandingFooterLink[], locale: Locale) {
  return links
    .filter((l) => l.enabled && l.href.trim())
    .map((l) => ({ label: pickLocalized(l.label, locale), href: l.href }));
}

export function enabledSocialLinks(links: LandingSocialLink[]) {
  return links.filter((l) => l.enabled && l.url.trim());
}

export const SOCIAL_PLATFORM_LABELS: Record<LandingSocialPlatform, string> = {
  x: "X",
  instagram: "IG",
  facebook: "FB",
  linkedin: "LI",
  youtube: "YT",
  tiktok: "TT",
  whatsapp: "WA",
  custom: "•",
};

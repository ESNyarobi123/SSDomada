import { z } from "zod";

const localizedStringSchema = z.object({
  en: z.string().max(2000),
  sw: z.string().max(2000),
});

const socialPlatformSchema = z.enum([
  "x",
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "tiktok",
  "whatsapp",
  "custom",
]);

const socialLinkSchema = z.object({
  id: z.string().min(1).max(64),
  platform: socialPlatformSchema,
  label: z.string().max(80),
  url: z.string().max(500),
  enabled: z.boolean(),
});

const footerLinkSchema = z.object({
  id: z.string().min(1).max(64),
  label: localizedStringSchema,
  href: z.string().max(500),
  enabled: z.boolean(),
});

const heroH1Schema = z.object({
  en: z.tuple([z.string().max(120), z.string().max(120), z.string().max(120)]),
  sw: z.tuple([z.string().max(120), z.string().max(120), z.string().max(120)]),
});

export const landingPageConfigSchema = z.object({
  brand: z.object({
    name: z.string().min(1).max(80),
    logoUrl: z.string().max(500),
  }),
  hero: z.object({
    poweredBy: localizedStringSchema,
    h1: heroH1Schema,
    sub: localizedStringSchema,
    subHighlight: localizedStringSchema,
    ctaPrimary: localizedStringSchema,
    ctaSecondary: localizedStringSchema,
  }),
  cta: z.object({
    title: localizedStringSchema,
    titleLine2: localizedStringSchema,
    sub: localizedStringSchema,
    primary: localizedStringSchema,
    secondary: localizedStringSchema,
    contactEmail: z.string().email().max(200),
  }),
  footer: z.object({
    blurb: localizedStringSchema,
    productTitle: localizedStringSchema,
    companyTitle: localizedStringSchema,
    contactTitle: localizedStringSchema,
    contact: z.object({
      email: z.string().email().max(200),
      phone: z.string().max(40),
      location: localizedStringSchema,
      supportNote: localizedStringSchema,
    }),
    social: z.array(socialLinkSchema).max(12),
    productLinks: z.array(footerLinkSchema).max(20),
    companyLinks: z.array(footerLinkSchema).max(20),
    legalLinks: z.array(footerLinkSchema).max(20),
    copyrightYear: z.number().int().min(2000).max(2100),
    rightsText: localizedStringSchema,
  }),
  seo: z.object({
    pageTitle: z.string().min(1).max(120),
    description: localizedStringSchema,
  }),
});

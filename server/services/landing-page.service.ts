import { prisma } from "@/server/lib/prisma";
import {
  LANDING_PAGE_SETTING_KEY,
  defaultLandingPageConfig,
  mergeLandingPageConfig,
  type LandingPageConfig,
} from "@/lib/landing-page-settings";
import { landingPageConfigSchema } from "@/lib/validations/landing-page";

export async function getLandingPageConfig(): Promise<LandingPageConfig> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: LANDING_PAGE_SETTING_KEY },
  });
  if (!row?.value) return defaultLandingPageConfig();
  try {
    const parsed = JSON.parse(row.value) as unknown;
    return mergeLandingPageConfig(parsed);
  } catch {
    return defaultLandingPageConfig();
  }
}

export async function saveLandingPageConfig(raw: unknown): Promise<LandingPageConfig> {
  const merged = mergeLandingPageConfig(raw);
  const validated = landingPageConfigSchema.parse(merged);
  await prisma.systemSetting.upsert({
    where: { key: LANDING_PAGE_SETTING_KEY },
    update: { value: JSON.stringify(validated), type: "json" },
    create: { key: LANDING_PAGE_SETTING_KEY, value: JSON.stringify(validated), type: "json" },
  });
  return validated;
}

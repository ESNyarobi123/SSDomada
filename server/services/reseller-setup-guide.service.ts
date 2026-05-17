import { prisma } from "@/server/lib/prisma";
import { SETUP_GUIDE_STEPS, type SetupGuideStepId } from "@/lib/reseller-setup-guide";

export type SetupGuideStepStatus = {
  id: SetupGuideStepId;
  number: number;
  completed: boolean;
};

export type ResellerSetupGuidePayload = {
  steps: SetupGuideStepStatus[];
  completedCount: number;
  totalSteps: number;
  currentStepId: SetupGuideStepId | null;
  /** All operational steps done (1–5); step 6 may still be pending admin. */
  prepComplete: boolean;
  portalRequest: {
    id: string;
    status: "PENDING" | "DONE" | "DISMISSED";
    createdAt: string;
  } | null;
  adminApproved: boolean;
  dismissed: boolean;
  /** Show checklist + dashboard modal. */
  wizardActive: boolean;
  /** Reseller submitted setup request; waiting on admin. */
  awaitingAdmin: boolean;
};

function isPortalCustomized(config: {
  logo: string | null;
  bgImage: string | null;
  welcomeText: string | null;
  primaryColor: string;
  accentColor: string;
  customCss: string | null;
  createdAt: Date;
  updatedAt: Date;
}): boolean {
  if (config.logo || config.bgImage) return true;
  if (config.customCss?.trim()) return true;
  if (config.welcomeText && config.welcomeText !== "Welcome! Connect to WiFi") return true;
  if (config.primaryColor !== "#0070f3" || config.accentColor !== "#00c853") return true;
  return config.updatedAt.getTime() - config.createdAt.getTime() > 120_000;
}

export async function getResellerSetupGuide(resellerId: string): Promise<ResellerSetupGuidePayload> {
  const [reseller, siteCount, deviceCount, ssidCount, packageCount, portalConfig, latestRequest] =
    await Promise.all([
      prisma.reseller.findUnique({
        where: { id: resellerId },
        select: { setupGuideDismissedAt: true },
      }),
      prisma.site.count({ where: { resellerId } }),
      prisma.device.count({ where: { resellerId } }),
      prisma.ssidConfig.count({ where: { resellerId } }),
      prisma.package.count({ where: { resellerId, isActive: true } }),
      prisma.captivePortalConfig.findUnique({ where: { resellerId } }),
      prisma.portalSetupRequest.findFirst({
        where: { resellerId },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      }),
    ]);

  const completion: Record<SetupGuideStepId, boolean> = {
    site: siteCount >= 1,
    device: deviceCount >= 1,
    ssid: ssidCount >= 1,
    package: packageCount >= 1,
    portal: portalConfig ? isPortalCustomized(portalConfig) : false,
    admin_push: latestRequest != null && ["PENDING", "DONE"].includes(latestRequest.status),
  };

  const steps: SetupGuideStepStatus[] = SETUP_GUIDE_STEPS.map((s) => ({
    id: s.id,
    number: s.number,
    completed: completion[s.id],
  }));

  const completedCount = steps.filter((s) => s.completed).length;
  const currentStepId = steps.find((s) => !s.completed)?.id ?? null;
  const prepComplete = completion.site && completion.device && completion.ssid && completion.package && completion.portal;
  const adminApproved = latestRequest?.status === "DONE";
  const awaitingAdmin = latestRequest?.status === "PENDING";
  const dismissed = reseller?.setupGuideDismissedAt != null;

  const wizardActive =
    !dismissed && !adminApproved && (currentStepId != null || awaitingAdmin);

  return {
    steps,
    completedCount,
    totalSteps: SETUP_GUIDE_STEPS.length,
    currentStepId,
    prepComplete,
    portalRequest: latestRequest
      ? {
          id: latestRequest.id,
          status: latestRequest.status,
          createdAt: latestRequest.createdAt.toISOString(),
        }
      : null,
    adminApproved,
    dismissed,
    wizardActive,
    awaitingAdmin,
  };
}

export async function dismissResellerSetupGuide(resellerId: string) {
  await prisma.reseller.update({
    where: { id: resellerId },
    data: { setupGuideDismissedAt: new Date() },
  });
}

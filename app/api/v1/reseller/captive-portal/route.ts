import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { updateCaptivePortalSchema } from "@/lib/validations/reseller";
import { checkFeatureAccess, getPlanAccessSnapshot } from "@/server/services/reseller-plan-access.service";

const BRANDING_FIELDS = new Set([
  "logo",
  "bgImage",
  "bgColor",
  "primaryColor",
  "accentColor",
  "companyName",
  "welcomeText",
  "customCss",
  "customHtml",
  "template",
  "showLogo",
  "showSocial",
  "socialLinks",
]);

/**
 * GET /api/v1/reseller/captive-portal
 * Get this reseller's captive portal configuration for customization preview.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    let config = await prisma.captivePortalConfig.findUnique({
      where: { resellerId: ctx.resellerId },
    });

    // Auto-create if missing
    if (!config) {
      config = await prisma.captivePortalConfig.create({
        data: {
          resellerId: ctx.resellerId,
          companyName: ctx.companyName,
        },
      });
    }

    // Get packages for portal preview
    const packages = await prisma.package.findMany({
      where: { resellerId: ctx.resellerId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        duration: true,
        durationMinutes: true,
        dataLimitMb: true,
        speedLimitDown: true,
        isFeatured: true,
      },
    });

    const portalUrl = `/portal/${ctx.brandSlug}`;
    const planAccess = await getPlanAccessSnapshot(ctx.resellerId);

    return apiSuccess({
      config,
      packages,
      portalUrl,
      previewUrl: `${portalUrl}?preview=true`,
      availableTemplates: ["default", "modern", "minimal", "dark"],
      planFeatures: planAccess.features,
    });
  } catch (error) {
    console.error("[Reseller Captive Portal GET] Error:", error);
    return apiError("Failed to load captive portal config", 500);
  }
}

/**
 * PUT /api/v1/reseller/captive-portal
 * Update captive portal branding and settings.
 */
export async function PUT(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const validated = updateCaptivePortalSchema.parse(body);
    const touchesBranding = Object.keys(validated).some((key) => BRANDING_FIELDS.has(key));
    if (touchesBranding) {
      const featureGate = await checkFeatureAccess(ctx.resellerId, "customBranding");
      if (!featureGate.ok) {
        return apiError(featureGate.message, featureGate.statusCode, featureGate.code);
      }
    }

    const config = await prisma.captivePortalConfig.upsert({
      where: { resellerId: ctx.resellerId },
      update: {
        ...validated,
        socialLinks: validated.socialLinks ? JSON.parse(JSON.stringify(validated.socialLinks)) : undefined,
      } as any,
      create: {
        resellerId: ctx.resellerId,
        companyName: ctx.companyName,
        ...validated,
        socialLinks: validated.socialLinks ? JSON.parse(JSON.stringify(validated.socialLinks)) : undefined,
      } as any,
    });

    await logResellerAction(ctx.userId, "captive_portal.updated", "CaptivePortalConfig", config.id, {
      template: validated.template,
    }, getClientIp(req));

    return apiSuccess(config);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "), 422);
    }
    console.error("[Reseller Captive Portal PUT] Error:", error);
    return apiError("Failed to update captive portal", 500);
  }
}

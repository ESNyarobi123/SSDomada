import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { createSiteSchema } from "@/lib/validations/reseller";
import { OmadaService } from "@/server/services/omada.service";
import { ensureActiveResellerPlan, ensureCapacity } from "@/server/middleware/paywall";
import { getPortalPublicBaseUrl } from "@/server/lib/public-app-base-url";
import { getResellerOmadaPortalName } from "@/server/lib/reseller-portal-display-name";

/**
 * GET /api/v1/reseller/sites
 * List all sites belonging to this reseller.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const sites = await prisma.site.findMany({
      where: { resellerId: ctx.resellerId },
      include: {
        _count: { select: { devices: true, wifiSessions: true, ssidConfigs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(sites);
  } catch (error) {
    console.error("[Reseller Sites GET] Error:", error);
    return apiError("Failed to fetch sites", 500);
  }
}

/**
 * POST /api/v1/reseller/sites
 * Create a new site (location) for this reseller.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  // Paywall: must have active plan and capacity
  const planGate = await ensureActiveResellerPlan(ctx.resellerId);
  if (planGate) return planGate;
  const capGate = await ensureCapacity(ctx.resellerId, "sites");
  if (capGate) return capGate;

  try {
    const body = await req.json();
    const validated = createSiteSchema.parse(body);

    // 1. Create site on Omada Controller first (best-effort)
    const omadaSiteId = await OmadaService.createOmadaSiteOnly(validated.name);

    // 2. Persist site in DB
    const site = await prisma.site.create({
      data: {
        resellerId: ctx.resellerId,
        name: validated.name,
        location: validated.location,
        omadaSiteId: omadaSiteId || undefined,
      },
    });

    // 3. If we have an Omada site link, also configure External Portal pointing to our captive page
    if (omadaSiteId) {
      const reseller = await prisma.reseller.findUnique({
        where: { id: ctx.resellerId },
        select: { brandSlug: true, companyName: true },
      });
      if (reseller) {
        const base = getPortalPublicBaseUrl();
        const portalUrl = base ? `${base}/portal/${reseller.brandSlug}` : "";
        if (portalUrl.startsWith("http")) {
          const portalName = await getResellerOmadaPortalName(ctx.resellerId, reseller.companyName);

          await OmadaService.setExternalPortal(omadaSiteId, {
            name: portalName,
            portalUrl,
          });
        }
      }
    }

    await logResellerAction(ctx.userId, "site.created", "Site", site.id, {
      name: validated.name,
      omadaSiteId: omadaSiteId || null,
    }, getClientIp(req));

    return apiSuccess(site);
  } catch (error: any) {
    if (error.name === "ZodError") return apiError("Validation failed", 422);
    console.error("[Reseller Sites POST] Error:", error);
    return apiError("Failed to create site", 500);
  }
}

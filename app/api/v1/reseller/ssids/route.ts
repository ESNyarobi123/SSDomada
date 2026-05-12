import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { createSsidSchema } from "@/lib/validations/reseller";
import { OmadaService } from "@/server/services/omada.service";

/**
 * GET /api/v1/reseller/ssids
 * List all SSIDs managed by this reseller across sites.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId") || undefined;

    const where: Record<string, unknown> = { resellerId: ctx.resellerId };
    if (siteId) (where as any).siteId = siteId;

    const ssids = await prisma.ssidConfig.findMany({
      where: where as any,
      include: {
        site: { select: { id: true, name: true, location: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(ssids);
  } catch (error) {
    console.error("[Reseller SSIDs GET] Error:", error);
    return apiError("Failed to fetch SSIDs", 500);
  }
}

/**
 * POST /api/v1/reseller/ssids
 * Create a new SSID for a site.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const validated = createSsidSchema.parse(body);

    // Verify site ownership
    const site = await prisma.site.findFirst({
      where: { id: validated.siteId, resellerId: ctx.resellerId },
    });
    if (!site) return apiError("Site not found", 404, "SITE_NOT_FOUND");

    // Best-effort push SSID to Omada Controller if site is linked
    let omadaSsidId: string | null = null;
    if (site.omadaSiteId) {
      omadaSsidId = await OmadaService.createSsid(site.omadaSiteId, {
        ssidName: validated.ssidName,
        password: validated.password,
        isHidden: validated.isHidden,
        band: validated.band,
        vlanId: validated.vlanId,
        portalEnabled: !validated.password, // open SSIDs use captive portal
      });
    }

    const ssid = await prisma.ssidConfig.create({
      data: {
        resellerId: ctx.resellerId,
        siteId: validated.siteId,
        ssidName: validated.ssidName,
        password: validated.password,
        isHidden: validated.isHidden,
        band: validated.band,
        vlanId: validated.vlanId,
        omadaSsidId: omadaSsidId || undefined,
      },
      include: { site: { select: { name: true } } },
    });

    await logResellerAction(ctx.userId, "ssid.created", "SsidConfig", ssid.id, {
      ssidName: validated.ssidName,
      siteId: validated.siteId,
      omadaSsidId,
    }, getClientIp(req));

    return apiSuccess({ ...ssid, pushedToOmada: !!omadaSsidId });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "), 422);
    }
    console.error("[Reseller SSIDs POST] Error:", error);
    return apiError("Failed to create SSID", 500);
  }
}

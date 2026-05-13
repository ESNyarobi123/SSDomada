import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { OmadaService } from "@/server/services/omada.service";
import { getPortalPublicBaseUrl } from "@/server/lib/public-app-base-url";
import { getResellerOmadaPortalName } from "@/server/lib/reseller-portal-display-name";

const bodySchema = z.object({
  siteId: z.string().cuid().optional(),
});

/**
 * POST /api/v1/reseller/omada/sync-portal
 *
 * Re-push external portal URL + attach all **open** SSIDs (with `omadaSsidId`) on linked Omada site(s).
 * Pre-authentication allowlist is **not** set here (Omada Open API is unreliable); use Controller UI — see docs/captive-preauth-allowlist.md
 *
 * Body (optional): `{ "siteId": "<cuid>" }` to limit to one site; omit to sync every site with `omadaSiteId`.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return apiError("Invalid body: " + parsed.error.errors.map((e) => e.message).join(", "), 422);
    }

    const base = getPortalPublicBaseUrl();
    const portalUrl = base ? `${base}/portal/${ctx.brandSlug}` : "";
    if (!portalUrl.startsWith("http")) {
      return apiError("Set NEXT_PUBLIC_APP_URL or OMADA_PORTAL_PUBLIC_BASE_URL to an https origin.", 400, "NO_PUBLIC_BASE");
    }

    const portalName = await getResellerOmadaPortalName(ctx.resellerId, ctx.companyName);
    const { siteId } = parsed.data;

    const sites = await prisma.site.findMany({
      where: {
        resellerId: ctx.resellerId,
        omadaSiteId: { not: null },
        ...(siteId ? { id: siteId } : {}),
      },
      select: { id: true, name: true, omadaSiteId: true },
    });

    if (siteId && sites.length === 0) {
      return apiError("Site not found or not linked to Omada", 404, "SITE_NOT_FOUND");
    }

    type SyncRow = {
      siteId: string;
      siteName: string;
      omadaSiteId: string;
      openSsidNames: string[];
      sync: Awaited<ReturnType<typeof OmadaService.syncExternalPortalWithOpenSsids>>;
    };

    const results: SyncRow[] = [];

    for (const site of sites) {
      if (!site.omadaSiteId) continue;
      const openSsids = await prisma.ssidConfig.findMany({
        where: {
          siteId: site.id,
          resellerId: ctx.resellerId,
          omadaSsidId: { not: null },
          OR: [{ password: null }, { password: "" }],
        },
        select: { omadaSsidId: true, ssidName: true },
      });
      const omadaSsidIds = openSsids.map((s) => s.omadaSsidId!).filter(Boolean);
      const sync = await OmadaService.syncExternalPortalWithOpenSsids(site.omadaSiteId, {
        portalUrl,
        portalName,
        omadaSsidIds,
      });
      results.push({
        siteId: site.id,
        siteName: site.name,
        omadaSiteId: site.omadaSiteId,
        openSsidNames: openSsids.map((s) => s.ssidName),
        sync,
      });
    }

    await logResellerAction(ctx.userId, "omada.sync_portal", "Reseller", ctx.resellerId, { portalUrl, siteCount: results.length }, getClientIp(req));

    return apiSuccess({
      portalUrl,
      portalName,
      preAuthentication: {
        configuredViaApi: false,
        doc: "docs/captive-preauth-allowlist.md",
        note: "Add hosts (Apple/Google/Microsoft + your app + Snippe) under Omada → Portal → Pre-Authentication Access manually.",
      },
      sites: results,
    });
  } catch (e) {
    console.error("[Reseller omada/sync-portal POST]", e);
    return apiError("Sync failed", 500);
  }
}

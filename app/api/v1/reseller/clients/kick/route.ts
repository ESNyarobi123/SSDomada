import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import {
  verifyReseller,
  apiSuccess,
  apiError,
  logResellerAction,
  getClientIp,
} from "@/server/middleware/reseller-auth";
import { RadiusService } from "@/server/services/radius.service";

/**
 * POST /api/v1/reseller/clients/kick
 *
 * Body: { mac: string, siteId?: string }
 *
 * Force-disconnects a client from WiFi RIGHT NOW (without waiting for the
 * cron job to run). Used by the dashboard to test disconnects and to handle
 * "kick this person off" support requests.
 *
 * Steps:
 *   1. Revoke their RADIUS rows so they can't auto-reauth.
 *   2. Run the same force-kick sequence the cron uses:
 *      OpenAPI unauthorize → extPortal/auth deauth (if portal info known) →
 *      reconnect.
 *
 * Returns full Omada response so the operator can see what failed if any.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json().catch(() => ({}));
    const rawMac = typeof body?.mac === "string" ? body.mac.trim() : "";
    if (!rawMac) return apiError("mac is required", 400, "VALIDATION");

    const mac = rawMac.toUpperCase();

    // Resolve the Omada site (+ portal-session details if we have them) for
    // this MAC: explicit override → portal session → reseller's first
    // Omada-linked site.
    let omadaSiteId: string | null = typeof body?.siteId === "string" ? body.siteId : null;
    let resolvedVia: "explicit" | "portal_session" | "default_site" = "explicit";
    let portalSession:
      | { apMac: string; ssidName: string; radioId: number }
      | null = null;

    const sessionMatch = await prisma.portalSession.findFirst({
      where: {
        resellerId: ctx.resellerId,
        clientMac: mac,
        omadaSiteId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        omadaSiteId: true,
        apMac: true,
        ssidName: true,
        radioId: true,
      },
    });
    if (sessionMatch) {
      if (!omadaSiteId && sessionMatch.omadaSiteId) {
        omadaSiteId = sessionMatch.omadaSiteId;
        resolvedVia = "portal_session";
      }
      if (
        sessionMatch.apMac &&
        sessionMatch.ssidName &&
        sessionMatch.radioId !== null
      ) {
        portalSession = {
          apMac: sessionMatch.apMac,
          ssidName: sessionMatch.ssidName,
          radioId: sessionMatch.radioId,
        };
      }
    }
    if (!omadaSiteId) {
      const site = await prisma.site.findFirst({
        where: { resellerId: ctx.resellerId, omadaSiteId: { not: null }, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { omadaSiteId: true },
      });
      if (site?.omadaSiteId) {
        omadaSiteId = site.omadaSiteId;
        resolvedVia = "default_site";
      }
    }

    if (!omadaSiteId) {
      return apiError(
        "No Omada-linked site found for this MAC. Add a site under /reseller/sites first.",
        422,
        "NO_OMADA_SITE",
      );
    }

    // 1. Revoke RADIUS so future auth requests are rejected.
    let radiusRevoked = 0;
    try {
      radiusRevoked = await RadiusService.revokeByMac(ctx.resellerId, mac);
    } catch (err) {
      console.warn(`[Reseller Kick] revokeByMac failed mac=${mac}:`, err);
    }

    // 2. Run the same force-kick sequence the cron uses (unauthorize +
    //    extPortal deauth + block + reconnect + scheduled unblock).
    const kickResult = await RadiusService.forceKickFromOmada({
      omadaSiteId,
      clientMac: mac,
      portalSession,
      label: `manual reseller=${ctx.resellerId}`,
    });

    await logResellerAction(
      ctx.userId,
      "client.kicked",
      "PortalSession",
      mac,
      {
        mac,
        omadaSiteId,
        resolvedVia,
        ok: kickResult.kicked,
        radiusRevoked,
        portalSessionUsed: Boolean(portalSession),
      },
      getClientIp(req),
    );

    return apiSuccess({
      ok: kickResult.kicked,
      mac,
      omadaSiteId,
      resolvedVia,
      radiusRevoked,
      portalSessionUsed: Boolean(portalSession),
      errors: kickResult.errors,
    });
  } catch (err: any) {
    console.error("[Reseller Kick POST] Error:", err);
    return apiError(err?.message || "Failed to kick client", 500);
  }
}

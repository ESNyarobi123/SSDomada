import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import {
  verifyReseller,
  apiSuccess,
  apiError,
  logResellerAction,
  getClientIp,
} from "@/server/middleware/reseller-auth";
import { OmadaService } from "@/server/services/omada.service";
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
 *   2. Call Omada `clients/{mac}/reconnect` — drops association on the AP.
 *   3. Fall back to `clients/{mac}/block` then unblock after 10s if the
 *      reconnect endpoint isn't available on this controller version.
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

    // Resolve the Omada site for this MAC: explicit override → portal session
    // → reseller's first Omada-linked site.
    let omadaSiteId: string | null = typeof body?.siteId === "string" ? body.siteId : null;
    let resolvedVia: "explicit" | "portal_session" | "default_site" = "explicit";

    if (!omadaSiteId) {
      const session = await prisma.portalSession.findFirst({
        where: {
          resellerId: ctx.resellerId,
          clientMac: mac,
          omadaSiteId: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        select: { omadaSiteId: true },
      });
      if (session?.omadaSiteId) {
        omadaSiteId = session.omadaSiteId;
        resolvedVia = "portal_session";
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

    // Revoke RADIUS so future auth requests are rejected.
    let radiusRevoked = 0;
    try {
      radiusRevoked = await RadiusService.revokeByMac(ctx.resellerId, mac);
    } catch (err) {
      console.warn(`[Reseller Kick] revokeByMac failed mac=${mac}:`, err);
    }

    const deauth = await OmadaService.deauthorizeClient(omadaSiteId, mac).catch((err: any) => ({
      errorCode: -1 as const,
      msg: err?.message || String(err),
    }));

    const kick = await OmadaService.disconnectClient(omadaSiteId, mac).catch((err: any) => ({
      ok: false as const,
      path: "(threw)",
      msg: err?.message || String(err),
    }));

    let blockUsed = false;
    let block: Awaited<ReturnType<typeof OmadaService.blockClient>> | null = null;
    if (!kick.ok) {
      blockUsed = true;
      block = await OmadaService.blockClient(omadaSiteId, mac).catch((err: any) => ({
        ok: false as const,
        path: "(threw)",
        msg: err?.message || String(err),
      }));
      if (block.ok) {
        setTimeout(() => {
          OmadaService.unblockClient(omadaSiteId!, mac).catch((err) => {
            console.warn(`[Reseller Kick] Delayed unblock failed mac=${mac}: ${err?.message || err}`);
          });
        }, 10_000);
      }
    }

    const ok = kick.ok || Boolean(block?.ok);

    await logResellerAction(
      ctx.userId,
      "client.kicked",
      "PortalSession",
      mac,
      { mac, omadaSiteId, resolvedVia, ok, radiusRevoked },
      getClientIp(req),
    );

    return apiSuccess({
      ok,
      mac,
      omadaSiteId,
      resolvedVia,
      radiusRevoked,
      deauthorize: { errorCode: (deauth as any).errorCode, msg: (deauth as any).msg },
      reconnect: kick,
      block: blockUsed ? block : null,
    });
  } catch (err: any) {
    console.error("[Reseller Kick POST] Error:", err);
    return apiError(err?.message || "Failed to kick client", 500);
  }
}

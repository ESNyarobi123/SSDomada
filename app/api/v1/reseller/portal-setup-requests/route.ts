import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { buildPortalSetupSnapshot } from "@/server/lib/portal-setup-snapshot";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { ensureActiveResellerPlan } from "@/server/middleware/paywall";

const postSchema = z.object({
  siteId: z.string().cuid().optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
});

/**
 * POST /api/v1/reseller/portal-setup-requests
 * Queue a request for a super-admin to configure the reseller's external portal on Omada (manual).
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const planGate = await ensureActiveResellerPlan(ctx.resellerId);
  if (planGate) return planGate;

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) {
      return apiError("Invalid request", 422, "VALIDATION");
    }
    const { siteId, note } = parsed.data;

    if (siteId) {
      const site = await prisma.site.findFirst({
        where: { id: siteId, resellerId: ctx.resellerId },
        select: { id: true },
      });
      if (!site) return apiError("Location not found", 404, "SITE_NOT_FOUND");
    }

    const details = await buildPortalSetupSnapshot(ctx.resellerId, {
      brandSlug: ctx.brandSlug,
      companyName: ctx.companyName,
      resellerEmail: ctx.email,
      siteId: siteId ?? undefined,
    });

    const row = await prisma.portalSetupRequest.create({
      data: {
        resellerId: ctx.resellerId,
        status: "PENDING",
        note: note?.trim() || null,
        details: details as object,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        note: true,
      },
    });

    await logResellerAction(ctx.userId, "portal_setup.requested", "PortalSetupRequest", row.id, { siteId: siteId ?? null }, getClientIp(req));

    return apiSuccess({ ...row, message: "Request sent. Our team will configure your controller." });
  } catch (e) {
    console.error("[Reseller portal-setup-requests POST]", e);
    return apiError("Failed to submit request", 500);
  }
}

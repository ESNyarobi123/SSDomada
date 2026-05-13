import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/reseller/notices/[id]
 * Dismiss a notice (body: { action: "dismiss" }).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const body = await req.json();
    if (body.action !== "dismiss") {
      return apiError("Invalid action", 400, "INVALID_ACTION");
    }

    const row = await prisma.resellerDashboardNotice.findFirst({
      where: { id, resellerId: ctx.resellerId, dismissedAt: null },
    });
    if (!row) return apiError("Notice not found", 404, "NOT_FOUND");

    await prisma.resellerDashboardNotice.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });

    await logResellerAction(ctx.userId, "notice.dismissed", "ResellerDashboardNotice", id, {}, getClientIp(req));

    return apiSuccess({ id, dismissed: true });
  } catch (error) {
    console.error("[Reseller notices PATCH] Error:", error);
    return apiError("Failed to update notice", 500);
  }
}

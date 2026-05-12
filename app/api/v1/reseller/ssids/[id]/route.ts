import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { updateSsidSchema } from "@/lib/validations/reseller";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/reseller/ssids/[id]
 * Edit SSID name, password, visibility, band.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const ssid = await prisma.ssidConfig.findFirst({ where: { id, resellerId: ctx.resellerId } });
    if (!ssid) return apiError("SSID not found", 404, "NOT_FOUND");

    const body = await req.json();

    // Toggle enable/disable
    if (body.action === "toggle") {
      const updated = await prisma.ssidConfig.update({
        where: { id },
        data: { isEnabled: !ssid.isEnabled },
      });
      await logResellerAction(ctx.userId, `ssid.${updated.isEnabled ? "enabled" : "disabled"}`, "SsidConfig", id, {}, getClientIp(req));
      return apiSuccess(updated);
    }

    const validated = updateSsidSchema.parse(body);
    const updated = await prisma.ssidConfig.update({
      where: { id },
      data: validated,
    });

    await logResellerAction(ctx.userId, "ssid.updated", "SsidConfig", id, validated, getClientIp(req));
    return apiSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") return apiError("Validation failed", 422);
    console.error("[Reseller SSID PATCH] Error:", error);
    return apiError("Failed to update SSID", 500);
  }
}

/**
 * DELETE /api/v1/reseller/ssids/[id]
 * Remove an SSID configuration.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const ssid = await prisma.ssidConfig.findFirst({ where: { id, resellerId: ctx.resellerId } });
    if (!ssid) return apiError("SSID not found", 404, "NOT_FOUND");

    await prisma.ssidConfig.delete({ where: { id } });
    await logResellerAction(ctx.userId, "ssid.deleted", "SsidConfig", id, { ssidName: ssid.ssidName }, getClientIp(req));

    return apiSuccess({ id, message: "SSID deleted" });
  } catch (error) {
    console.error("[Reseller SSID DELETE] Error:", error);
    return apiError("Failed to delete SSID", 500);
  }
}

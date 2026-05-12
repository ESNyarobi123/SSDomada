import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { updateDeviceSchema } from "@/lib/validations/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/devices/[id]
 * Get detailed info about a specific device.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        reseller: { select: { id: true, companyName: true, brandSlug: true } },
        site: { select: { id: true, name: true, location: true, omadaSiteId: true } },
      },
    });

    if (!device) return apiError("Device not found", 404, "NOT_FOUND");

    return apiSuccess(device);
  } catch (error) {
    console.error("[Admin Device GET] Error:", error);
    return apiError("Failed to fetch device", 500);
  }
}

/**
 * PATCH /api/v1/admin/devices/[id]
 * Update device name, type, or trigger Omada actions (forget, reboot).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const body = await req.json();
    const action = body.action as string | undefined;

    // Handle special actions
    if (action === "forget") {
      await prisma.device.delete({ where: { id } });
      await logAdminAction(admin.userId, "device.forgotten", "Device", id, {}, getClientIp(req));
      return apiSuccess({ id, message: "Device removed from system" });
    }

    // Regular update
    const validated = updateDeviceSchema.parse(body);
    const updated = await prisma.device.update({
      where: { id },
      data: validated,
    });

    await logAdminAction(admin.userId, "device.updated", "Device", id, validated, getClientIp(req));
    return apiSuccess(updated);
  } catch (error: any) {
    if (error.code === "P2025") return apiError("Device not found", 404, "NOT_FOUND");
    console.error("[Admin Device PATCH] Error:", error);
    return apiError("Failed to update device", 500);
  }
}

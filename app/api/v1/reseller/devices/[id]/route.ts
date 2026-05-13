import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { updateDeviceSchema } from "@/lib/validations/reseller";
import { OmadaService, type OmadaSiteLinkSource } from "@/server/services/omada.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/reseller/devices/[id]
 * Device detail: model, firmware, uptime, connected clients, site info.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const device = await prisma.device.findFirst({
      where: { id, resellerId: ctx.resellerId },
      include: {
        site: { select: { id: true, name: true, location: true, omadaSiteId: true } },
      },
    });

    if (!device) return apiError("Device not found", 404, "NOT_FOUND");

    // Try to get live data from Omada
    let liveData: Record<string, unknown> | null = null;
    if (device.site?.omadaSiteId && device.mac) {
      try {
        const omadaDevices = await OmadaService.listDevices(device.site.omadaSiteId);
        const match = omadaDevices.find(
          (od: any) => od.mac?.toLowerCase() === device.mac.toLowerCase()
        );
        if (match) {
          liveData = {
            liveStatus: match.status === 1 ? "ONLINE" : "OFFLINE",
            clients: match.clients || 0,
            uptime: match.uptimeLong || 0,
            cpuUsage: match.cpuUtil || 0,
            memUsage: match.memUtil || 0,
            txRate: match.txRate || 0,
            rxRate: match.rxRate || 0,
          };
        }
      } catch {
        // Controller unavailable — just return DB data
      }
    }

    return apiSuccess({ ...device, live: liveData });
  } catch (error) {
    console.error("[Reseller Device GET] Error:", error);
    return apiError("Failed to fetch device", 500);
  }
}

/**
 * PATCH /api/v1/reseller/devices/[id]
 * Update device name/type, or perform actions (reboot, forget, adopt).
 * Actions: reboot, forget, adopt (retry Omada adopt after the AP reaches the controller)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const device = await prisma.device.findFirst({
      where: { id, resellerId: ctx.resellerId },
      include: { site: { select: { omadaSiteId: true } } },
    });

    if (!device) return apiError("Device not found", 404, "NOT_FOUND");

    const body = await req.json();
    const action = body.action as string | undefined;

    // === REBOOT ===
    if (action === "reboot") {
      if (!device.site?.omadaSiteId) {
        return apiError("Device site is not linked to Omada Controller", 400, "NO_OMADA_LINK");
      }
      try {
        await OmadaService.rebootDevice(device.site.omadaSiteId, device.mac);
      } catch (err) {
        return apiError("Failed to send reboot command to Omada", 502, "OMADA_ERROR");
      }
      await logResellerAction(ctx.userId, "device.rebooted", "Device", id, { mac: device.mac }, getClientIp(req));
      return apiSuccess({ id, message: "Reboot command sent to device" });
    }

    // === FORGET (delete from system) ===
    if (action === "forget") {
      await prisma.device.delete({ where: { id } });
      await logResellerAction(ctx.userId, "device.forgotten", "Device", id, { mac: device.mac }, getClientIp(req));
      return apiSuccess({ id, message: "Device removed from your account" });
    }

    // === ADOPT (retry Omada adopt; AP must be listed on the site / Pending on controller) ===
    if (action === "adopt") {
      if (!device.site?.omadaSiteId) {
        return apiError("Device site is not linked to Omada Controller", 400, "NO_OMADA_LINK");
      }
      const omadaSiteId = device.site.omadaSiteId;
      const macUpper = device.mac.toUpperCase();

      const preview = await OmadaService.findDeviceByMac(omadaSiteId, macUpper);
      const omada: {
        siteLinked: boolean;
        siteLinkSource: OmadaSiteLinkSource;
        omadaSiteId: string;
        controllerDeviceListed: boolean;
        adoptAttempted: boolean;
        adopted: boolean;
        resolutionNote?: string;
        message?: string;
        errorCode?: number;
      } = {
        siteLinked: true,
        siteLinkSource: "db",
        omadaSiteId,
        controllerDeviceListed: Boolean(preview),
        adoptAttempted: true,
        adopted: false,
      };
      if (!preview) {
        omada.resolutionNote =
          "Omada does not list this MAC on this site yet. Confirm Inform URL on the AP (tplinkeap.net → System → Controller Settings) and wait until the AP appears as Pending on this Omada site.";
      }

      const adoptRes = await OmadaService.adoptDevice(omadaSiteId, macUpper);
      omada.adopted = adoptRes.adopted;
      if (!adoptRes.adopted) {
        omada.message = adoptRes.message;
        omada.errorCode = adoptRes.errorCode;
      }

      const live = await OmadaService.findDeviceByMac(omadaSiteId, device.mac);
      if (live) {
        await prisma.device.update({
          where: { id },
          data: {
            status: adoptRes.adopted ? "ONLINE" : "PENDING",
            ip: live.ip ?? undefined,
            model: live.model ?? undefined,
            firmwareVersion: (live as { firmwareVersion?: string }).firmwareVersion ?? undefined,
            omadaDeviceId: macUpper,
            lastSeen: adoptRes.adopted ? new Date() : undefined,
          },
        });
      } else if (adoptRes.adopted) {
        await prisma.device.update({
          where: { id },
          data: { status: "ONLINE", lastSeen: new Date() },
        });
      }

      await logResellerAction(
        ctx.userId,
        "device.adopt_retry",
        "Device",
        id,
        { mac: device.mac, adopted: adoptRes.adopted, omadaErrorCode: omada.errorCode },
        getClientIp(req)
      );

      const fresh = await prisma.device.findFirst({
        where: { id, resellerId: ctx.resellerId },
        include: { site: { select: { name: true, location: true, omadaSiteId: true } } },
      });

      const message = adoptRes.adopted
        ? "Device adopted on Omada Controller."
        : [omada.message, omada.resolutionNote].filter(Boolean).join(" — ") || "Adopt did not complete. Try again shortly.";

      return apiSuccess({
        message,
        adopted: adoptRes.adopted,
        omada,
        device: fresh,
      });
    }

    // === Regular update ===
    const validated = updateDeviceSchema.parse(body);

    // If changing site, verify ownership
    if (validated.siteId) {
      const site = await prisma.site.findFirst({ where: { id: validated.siteId, resellerId: ctx.resellerId } });
      if (!site) return apiError("Target site not found", 404, "SITE_NOT_FOUND");
    }

    const updated = await prisma.device.update({
      where: { id },
      data: validated,
      include: { site: { select: { name: true } } },
    });

    await logResellerAction(ctx.userId, "device.updated", "Device", id, validated, getClientIp(req));
    return apiSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed", 422, "VALIDATION_ERROR");
    }
    console.error("[Reseller Device PATCH] Error:", error);
    return apiError("Failed to update device", 500);
  }
}

/**
 * DELETE /api/v1/reseller/devices/[id]
 * Remove device from system.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const device = await prisma.device.findFirst({ where: { id, resellerId: ctx.resellerId } });
    if (!device) return apiError("Device not found", 404, "NOT_FOUND");

    await prisma.device.delete({ where: { id } });
    await logResellerAction(ctx.userId, "device.deleted", "Device", id, { mac: device.mac }, getClientIp(req));

    return apiSuccess({ id, message: "Device deleted" });
  } catch (error) {
    console.error("[Reseller Device DELETE] Error:", error);
    return apiError("Failed to delete device", 500);
  }
}

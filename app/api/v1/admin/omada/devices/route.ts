import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { OmadaService } from "@/server/services/omada.service";

/**
 * GET /api/v1/admin/omada/devices
 * List devices from Omada Controller for a specific site.
 * Compares live status with DB records.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");

    if (!siteId) {
      return apiError("siteId query parameter is required", 400, "MISSING_PARAM");
    }

    // Get DB site info
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { reseller: { select: { companyName: true } } },
    });

    if (!site) return apiError("Site not found", 404, "NOT_FOUND");

    // Get devices from DB
    const dbDevices = await prisma.device.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
    });

    // Try to get live data from Omada Controller
    let omadaDevices: any[] = [];
    let controllerStatus = "unknown";

    if (site.omadaSiteId) {
      try {
        omadaDevices = await OmadaService.listDevices(site.omadaSiteId);
        controllerStatus = "connected";
      } catch (error) {
        console.error("[Omada] Failed to fetch devices:", error);
        controllerStatus = "disconnected";
      }
    }

    // Merge DB and Omada data
    const merged = dbDevices.map((dbDevice) => {
      const omadaMatch = omadaDevices.find(
        (od: any) => od.mac?.toLowerCase() === dbDevice.mac?.toLowerCase()
      );

      return {
        ...dbDevice,
        liveStatus: omadaMatch ? (omadaMatch.status === 1 ? "ONLINE" : "OFFLINE") : null,
        liveClients: omadaMatch?.clients || 0,
        liveUptime: omadaMatch?.uptimeLong || 0,
        synced: !!omadaMatch,
      };
    });

    // Find unregistered devices (on Omada but not in DB)
    const registeredMacs = dbDevices.map((d) => d.mac.toLowerCase());
    const unregistered = omadaDevices.filter(
      (od: any) => !registeredMacs.includes(od.mac?.toLowerCase())
    );

    return apiSuccess({
      site: { id: site.id, name: site.name, omadaSiteId: site.omadaSiteId, reseller: site.reseller },
      devices: merged,
      unregisteredDevices: unregistered,
      controllerStatus,
    });
  } catch (error) {
    console.error("[Admin Omada Devices] Error:", error);
    return apiError("Failed to fetch Omada devices", 500);
  }
}

/**
 * POST /api/v1/admin/omada/devices
 * Sync device status from Omada Controller to database.
 * Body: { siteId: string }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const body = await req.json();
    const { siteId } = body;

    if (!siteId) return apiError("siteId is required", 400, "MISSING_PARAM");

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return apiError("Site not found", 404, "NOT_FOUND");
    if (!site.omadaSiteId) return apiError("Site not linked to Omada Controller", 400, "NOT_LINKED");

    await OmadaService.syncDevices(siteId, site.omadaSiteId);

    await logAdminAction(admin.userId, "omada.devices.synced", "Site", siteId, {}, getClientIp(req));

    return apiSuccess({ message: "Device sync completed", siteId });
  } catch (error) {
    console.error("[Admin Omada Sync] Error:", error);
    return apiError("Failed to sync devices", 500);
  }
}

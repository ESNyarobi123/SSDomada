import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { OmadaService } from "@/server/services/omada.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/reseller/devices/[id]/clients
 * List all WiFi clients currently connected to a specific AP.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const device = await prisma.device.findFirst({
      where: { id, resellerId: ctx.resellerId },
      include: { site: { select: { omadaSiteId: true, name: true } } },
    });

    if (!device) return apiError("Device not found", 404, "NOT_FOUND");
    if (!device.site?.omadaSiteId) return apiError("Site not linked to Omada Controller", 400, "NO_OMADA_LINK");

    const allClients = await OmadaService.listClients(device.site.omadaSiteId);

    // Filter clients connected through this specific AP
    const deviceClients = allClients.filter(
      (c: any) => c.apMac?.toLowerCase() === device.mac.toLowerCase() ||
                   c.switchMac?.toLowerCase() === device.mac.toLowerCase()
    );

    return apiSuccess({
      device: { id: device.id, name: device.name, mac: device.mac },
      clients: deviceClients,
      totalConnected: deviceClients.length,
    });
  } catch (error) {
    console.error("[Reseller Device Clients] Error:", error);
    return apiError("Failed to fetch connected clients", 500);
  }
}

/**
 * POST /api/v1/reseller/devices/[id]/clients
 * Block or disconnect a specific client by MAC.
 * Body: { action: "block" | "disconnect", clientMac: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const device = await prisma.device.findFirst({
      where: { id, resellerId: ctx.resellerId },
      include: { site: { select: { omadaSiteId: true } } },
    });

    if (!device) return apiError("Device not found", 404, "NOT_FOUND");
    if (!device.site?.omadaSiteId) return apiError("Site not linked to Omada", 400, "NO_OMADA_LINK");

    const body = await req.json();
    const { action, clientMac, reason } = body;

    if (!clientMac) return apiError("clientMac is required", 400);

    if (action === "disconnect") {
      await OmadaService.deauthorizeClient(device.site.omadaSiteId, clientMac);
      await logResellerAction(ctx.userId, "client.disconnected", "Device", id, { clientMac }, getClientIp(req));
      return apiSuccess({ message: `Client ${clientMac} disconnected` });
    }

    if (action === "block") {
      // Block on Omada
      await OmadaService.deauthorizeClient(device.site.omadaSiteId, clientMac);
      // Save to blocked MACs list
      await prisma.blockedMac.upsert({
        where: { resellerId_mac: { resellerId: ctx.resellerId, mac: clientMac.toUpperCase() } },
        update: { reason },
        create: { resellerId: ctx.resellerId, mac: clientMac.toUpperCase(), reason },
      });
      await logResellerAction(ctx.userId, "client.blocked", "BlockedMac", undefined, { clientMac, reason }, getClientIp(req));
      return apiSuccess({ message: `Client ${clientMac} blocked` });
    }

    return apiError("Invalid action. Use 'disconnect' or 'block'.", 400);
  } catch (error) {
    console.error("[Reseller Device Client Action] Error:", error);
    return apiError("Failed to perform action on client", 500);
  }
}

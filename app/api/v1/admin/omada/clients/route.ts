import { NextRequest } from "next/server";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";
import { OmadaService } from "@/server/services/omada.service";
import { prisma } from "@/server/lib/prisma";

/**
 * GET /api/v1/admin/omada/clients
 * List currently connected WiFi clients from Omada Controller.
 * Requires siteId (Omada site).
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

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { omadaSiteId: true, name: true },
    });

    if (!site) return apiError("Site not found", 404, "NOT_FOUND");
    if (!site.omadaSiteId) return apiError("Site not linked to Omada Controller", 400, "NOT_LINKED");

    const clients = await OmadaService.listClients(site.omadaSiteId);

    return apiSuccess({
      site: { id: siteId, name: site.name },
      clients,
      totalConnected: clients.length,
    });
  } catch (error) {
    console.error("[Admin Omada Clients] Error:", error);
    return apiError("Failed to fetch connected clients", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";
import { OmadaService } from "@/server/services/omada.service";

/**
 * GET /api/v1/admin/omada/sites
 * List all Omada sites — both from DB and live from Omada Controller.
 * ?source=db — sites in our database
 * ?source=omada — sites from Omada Controller API
 * ?source=both — merged view (default)
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || "both";

    const dbSites = await prisma.site.findMany({
      include: {
        reseller: { select: { id: true, companyName: true, brandSlug: true } },
        _count: { select: { devices: true, wifiSessions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (source === "db") {
      return apiSuccess({ sites: dbSites, source: "database" });
    }

    // Fetch live data from Omada Controller
    let omadaSites: any[] = [];
    let controllerStatus = "unknown";

    try {
      omadaSites = await OmadaService.listSites();
      controllerStatus = "connected";
    } catch (error) {
      console.error("[Omada] Failed to fetch sites:", error);
      controllerStatus = "disconnected";
    }

    if (source === "omada") {
      return apiSuccess({ sites: omadaSites, controllerStatus, source: "omada" });
    }

    // Merge: match DB sites with Omada sites by omadaSiteId
    const merged = dbSites.map((dbSite) => {
      const omadaMatch = omadaSites.find(
        (os: any) => os.siteId === dbSite.omadaSiteId || os.id === dbSite.omadaSiteId
      );

      return {
        ...dbSite,
        omadaData: omadaMatch || null,
        synced: !!omadaMatch,
      };
    });

    // Find unlinked Omada sites (exist on controller but not in DB)
    const linkedOmadaIds = dbSites.map((s) => s.omadaSiteId).filter(Boolean);
    const unlinked = omadaSites.filter(
      (os: any) => !linkedOmadaIds.includes(os.siteId) && !linkedOmadaIds.includes(os.id)
    );

    return apiSuccess({
      sites: merged,
      unlinkedOmadaSites: unlinked,
      controllerStatus,
      source: "merged",
    });
  } catch (error) {
    console.error("[Admin Omada Sites] Error:", error);
    return apiError("Failed to fetch Omada sites", 500);
  }
}

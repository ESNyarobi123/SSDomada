import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";

/**
 * GET /api/v1/admin/portal-setup-requests
 * List portal setup requests for manual Omada configuration.
 * Query: ?status=PENDING|DONE|DISMISSED (optional, default all recent)
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as "PENDING" | "DONE" | "DISMISSED" | null;
    const where =
      status && ["PENDING", "DONE", "DISMISSED"].includes(status) ? { status } : {};

    const rows = await prisma.portalSetupRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        reseller: {
          select: {
            id: true,
            companyName: true,
            brandSlug: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    const pending = await prisma.portalSetupRequest.count({ where: { status: "PENDING" } });
    const done = await prisma.portalSetupRequest.count({ where: { status: "DONE" } });

    return apiSuccess({ requests: rows, counts: { pending, done } });
  } catch (e) {
    console.error("[Admin portal-setup-requests GET]", e);
    return apiError("Failed to load requests", 500);
  }
}

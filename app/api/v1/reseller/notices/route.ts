import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError } from "@/server/middleware/reseller-auth";

/**
 * GET /api/v1/reseller/notices
 * Active dashboard notices from super-admins (not dismissed).
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const notices = await prisma.resellerDashboardNotice.findMany({
      where: { resellerId: ctx.resellerId, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
      },
    });

    return apiSuccess(notices);
  } catch (error) {
    console.error("[Reseller notices GET] Error:", error);
    return apiError("Failed to load notices", 500);
  }
}

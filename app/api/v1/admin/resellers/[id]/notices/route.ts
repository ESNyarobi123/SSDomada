import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { adminCreateResellerNoticeSchema } from "@/lib/validations/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/admin/resellers/[id]/notices
 * Push an in-app notice to the reseller dashboard.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id: resellerId } = await params;

  try {
    const reseller = await prisma.reseller.findUnique({ where: { id: resellerId } });
    if (!reseller) return apiError("Reseller not found", 404, "NOT_FOUND");

    const body = await req.json();
    const validated = adminCreateResellerNoticeSchema.parse(body);

    const notice = await prisma.resellerDashboardNotice.create({
      data: {
        resellerId,
        title: validated.title,
        body: validated.body,
        createdById: admin.userId,
      },
    });

    await logAdminAction(
      admin.userId,
      "reseller.notice_created",
      "ResellerDashboardNotice",
      notice.id,
      { resellerId, title: validated.title },
      getClientIp(req)
    );

    return apiSuccess(notice);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError(
        "Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "),
        422,
        "VALIDATION_ERROR"
      );
    }
    console.error("[Admin reseller notices POST] Error:", error);
    return apiError("Failed to create notice", 500);
  }
}

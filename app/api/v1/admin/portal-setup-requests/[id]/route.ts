import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";

const patchSchema = z.object({
  status: z.enum(["DONE", "DISMISSED"]),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/portal-setup-requests/:id
 * Mark a portal setup request as completed or dismissed.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;
  if (!id) return apiError("Missing id", 400);

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return apiError("Invalid body: status must be DONE or DISMISSED", 422);

    const existing = await prisma.portalSetupRequest.findUnique({ where: { id } });
    if (!existing) return apiError("Request not found", 404);

    const updated = await prisma.portalSetupRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        resolvedAt: new Date(),
        resolvedById: admin.userId,
      },
      include: {
        reseller: { select: { companyName: true, brandSlug: true } },
      },
    });

    await logAdminAction(
      admin.userId,
      "portal_setup_request.updated",
      "PortalSetupRequest",
      id,
      { status: parsed.data.status, resellerId: existing.resellerId },
      getClientIp(req)
    );

    return apiSuccess(updated);
  } catch (e) {
    console.error("[Admin portal-setup-requests PATCH]", e);
    return apiError("Failed to update request", 500);
  }
}

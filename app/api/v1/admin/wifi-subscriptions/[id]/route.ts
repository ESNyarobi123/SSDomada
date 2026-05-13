import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { adminUpdateWifiSubscriptionSchema } from "@/lib/validations/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/wifi-subscriptions/[id]
 * Update an end-user WiFi subscription (status / expiry).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        package: { select: { resellerId: true, name: true } },
      },
    });
    if (!sub) return apiError("Subscription not found", 404, "NOT_FOUND");

    const body = await req.json();
    const validated = adminUpdateWifiSubscriptionSchema.parse(body);

    const data: { status?: (typeof validated)["status"]; expiresAt?: Date } = {};
    if (validated.status) data.status = validated.status;
    if (validated.expiresAt) data.expiresAt = new Date(validated.expiresAt);

    if (Object.keys(data).length === 0) {
      return apiError("No changes", 400, "NO_CHANGES");
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        package: { select: { id: true, name: true, resellerId: true } },
      },
    });

    await logAdminAction(admin.userId, "wifi_subscription.updated", "Subscription", id, validated, getClientIp(req));

    return apiSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed", 422, "VALIDATION_ERROR");
    }
    console.error("[Admin wifi-subscription PATCH] Error:", error);
    return apiError("Failed to update subscription", 500);
  }
}

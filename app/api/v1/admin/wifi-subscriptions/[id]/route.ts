import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { adminUpdateWifiSubscriptionSchema } from "@/lib/validations/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/wifi-subscriptions/[id]
 * Single customer subscription with package and payment link (if any).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true } },
        package: {
          include: {
            reseller: { select: { id: true, companyName: true, brandSlug: true } },
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            snippeReference: true,
            completedAt: true,
          },
        },
        wifiSessions: {
          take: 10,
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            clientMac: true,
            startedAt: true,
            endedAt: true,
            site: { select: { name: true } },
          },
        },
      },
    });

    if (!sub) return apiError("Subscription not found", 404, "NOT_FOUND");

    return apiSuccess(sub);
  } catch (error) {
    console.error("[Admin wifi-subscription GET] Error:", error);
    return apiError("Failed to load subscription", 500);
  }
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

/**
 * DELETE /api/v1/admin/wifi-subscriptions/[id]
 * Soft-cancel by default (CANCELLED + immediate expiry). Use ?hard=1 to remove the row
 * after clearing payment.subscriptionId (destructive; audited).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;
  const hard = new URL(req.url).searchParams.get("hard") === "1";

  try {
    const sub = await prisma.subscription.findUnique({
      where: { id },
      select: { id: true, userId: true, packageId: true },
    });
    if (!sub) return apiError("Subscription not found", 404, "NOT_FOUND");

    if (!hard) {
      const now = new Date();
      await prisma.subscription.update({
        where: { id },
        data: { status: "CANCELLED", expiresAt: now },
      });
      await logAdminAction(admin.userId, "wifi_subscription.cancelled", "Subscription", id, { mode: "soft" }, getClientIp(req));
      return apiSuccess({ id, mode: "soft", message: "Subscription cancelled" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.radiusUser.updateMany({
        where: { subscriptionId: id },
        data: { subscriptionId: null },
      });
      await tx.wifiSession.updateMany({
        where: { subscriptionId: id },
        data: { subscriptionId: null },
      });
      await tx.payment.updateMany({
        where: { subscriptionId: id },
        data: { subscriptionId: null },
      });
      await tx.subscription.delete({ where: { id } });
    });

    await logAdminAction(admin.userId, "wifi_subscription.deleted", "Subscription", id, { mode: "hard" }, getClientIp(req));
    return apiSuccess({ id, mode: "hard", message: "Subscription row removed" });
  } catch (error) {
    console.error("[Admin wifi-subscription DELETE] Error:", error);
    return apiError("Failed to delete subscription", 500);
  }
}

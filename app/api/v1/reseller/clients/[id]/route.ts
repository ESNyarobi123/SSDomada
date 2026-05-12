import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/reseller/clients/[id]
 * Full client profile: sessions, subscriptions, payments for this reseller.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    // Verify user has a subscription to this reseller
    const hasRelation = await prisma.subscription.findFirst({
      where: { userId: id, package: { resellerId: ctx.resellerId } },
    });
    if (!hasRelation) return apiError("Client not found or not associated with your portal", 404);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        subscriptions: {
          where: { package: { resellerId: ctx.resellerId } } as any,
          orderBy: { createdAt: "desc" },
          include: { package: { select: { name: true, price: true, duration: true } } },
        },
        payments: {
          where: { resellerId: ctx.resellerId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paymentType: true,
            customerPhone: true,
            createdAt: true,
            completedAt: true,
          } as any,
        },
        wifiSessions: {
          where: { site: { resellerId: ctx.resellerId } } as any,
          orderBy: { startedAt: "desc" },
          take: 50,
          select: {
            id: true,
            clientMac: true,
            clientIp: true,
            startedAt: true,
            endedAt: true,
            dataUpMb: true,
            dataDownMb: true,
            site: { select: { name: true } },
          },
        },
      },
    });

    if (!user) return apiError("Client not found", 404);

    // Check if any MAC is blocked
    const clientMacs = [...new Set(user.wifiSessions.map((s: any) => s.clientMac))];
    const blockedMacs = await prisma.blockedMac.findMany({
      where: { resellerId: ctx.resellerId, mac: { in: clientMacs } },
    });

    const totalSpent = await prisma.payment.aggregate({
      where: { userId: id, resellerId: ctx.resellerId, status: "COMPLETED" as any },
      _sum: { amount: true },
    });

    return apiSuccess({
      ...user,
      blockedMacs: blockedMacs.map((b: any) => b.mac),
      totalSpent: totalSpent._sum?.amount || 0,
    });
  } catch (error) {
    console.error("[Reseller Client Detail] Error:", error);
    return apiError("Failed to fetch client", 500);
  }
}

/**
 * PATCH /api/v1/reseller/clients/[id]
 * Block or unblock a client by their MAC addresses.
 * Body: { action: "block" | "unblock", mac: string, reason?: string }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  try {
    const body = await req.json();
    const { action, mac, reason } = body;

    if (!mac) return apiError("MAC address is required", 400);

    if (action === "block") {
      await prisma.blockedMac.upsert({
        where: { resellerId_mac: { resellerId: ctx.resellerId, mac: mac.toUpperCase() } },
        update: { reason },
        create: { resellerId: ctx.resellerId, mac: mac.toUpperCase(), reason },
      });
      await logResellerAction(ctx.userId, "client.blocked", "User", id, { mac, reason }, getClientIp(req));
      return apiSuccess({ message: `MAC ${mac} blocked` });
    }

    if (action === "unblock") {
      await prisma.blockedMac.deleteMany({
        where: { resellerId: ctx.resellerId, mac: mac.toUpperCase() },
      });
      await logResellerAction(ctx.userId, "client.unblocked", "User", id, { mac }, getClientIp(req));
      return apiSuccess({ message: `MAC ${mac} unblocked` });
    }

    return apiError("Invalid action. Use 'block' or 'unblock'.", 400);
  } catch (error) {
    console.error("[Reseller Client PATCH] Error:", error);
    return apiError("Failed to update client", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { paginationSchema, blockMacSchema } from "@/lib/validations/reseller";

/**
 * GET /api/v1/reseller/clients
 * List all WiFi customers who have paid through this reseller's portal.
 * Search by phone, email, name, MAC. Includes active sessions and payment history.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const search = searchParams.get("search") || undefined;
    const activeOnly = searchParams.get("activeOnly") === "true";
    const format = searchParams.get("format"); // "csv" for export

    // Get user IDs who have subscriptions with this reseller
    const subFilter: Record<string, unknown> = {
      package: { resellerId: ctx.resellerId },
    };
    if (activeOnly) {
      (subFilter as any).status = "ACTIVE";
      (subFilter as any).expiresAt = { gt: new Date() };
    }

    // Find all users with subscriptions to this reseller's packages
    let userWhere: Record<string, unknown> = {
      subscriptions: { some: subFilter as any },
    };

    if (search) {
      (userWhere as any).AND = [
        { subscriptions: { some: subFilter as any } },
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { wifiSessions: { some: { clientMac: { contains: search, mode: "insensitive" } } } },
          ],
        },
      ];
      delete (userWhere as any).subscriptions;
    }

    const [clients, total] = await Promise.all([
      prisma.user.findMany({
        where: userWhere as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          subscriptions: {
            where: { package: { resellerId: ctx.resellerId } } as any,
            orderBy: { expiresAt: "desc" },
            select: {
              id: true,
              status: true,
              startedAt: true,
              expiresAt: true,
              dataUsedMb: true,
              package: { select: { name: true, price: true, duration: true } },
            },
          },
          wifiSessions: {
            where: { site: { resellerId: ctx.resellerId } } as any,
            orderBy: { startedAt: "desc" },
            take: 3,
            select: { clientMac: true, clientIp: true, startedAt: true, endedAt: true },
          },
        },
      }),
      prisma.user.count({ where: userWhere as any }),
    ]);

    const now = new Date();
    const userIds = clients.map((c) => c.id);

    const [radiusUsers, paymentAggs] = await Promise.all([
      userIds.length
        ? prisma.radiusUser.findMany({
            where: { resellerId: ctx.resellerId, userId: { in: userIds } },
            orderBy: { expiresAt: "desc" },
            select: {
              userId: true,
              username: true,
              macAddress: true,
              isActive: true,
              expiresAt: true,
              subscription: {
                select: { dataUsedMb: true, package: { select: { name: true } } },
              },
            },
          })
        : Promise.resolve([]),
      Promise.all(
        clients.map((client) =>
          prisma.payment.aggregate({
            where: { userId: client.id, resellerId: ctx.resellerId, status: "COMPLETED" as any },
            _sum: { amount: true },
            _count: true,
          }),
        ),
      ),
    ]);

    const usernames = radiusUsers.map((r) => r.username);
    const onlineSessions =
      usernames.length > 0
        ? await prisma.radacct.findMany({
            where: { username: { in: usernames }, acctstoptime: null },
            select: { username: true },
            distinct: ["username"],
          })
        : [];
    const onlineUsernames = new Set(onlineSessions.map((s) => s.username));

    const radiusByUser = new Map<string, typeof radiusUsers>();
    for (const ru of radiusUsers) {
      if (!ru.userId) continue;
      const list = radiusByUser.get(ru.userId) || [];
      list.push(ru);
      radiusByUser.set(ru.userId, list);
    }

    const enriched = clients.map((client, idx) => {
      const totalSpent = paymentAggs[idx];
      const subs = client.subscriptions;
      const activeSubscription =
        subs.find((s) => s.status === "ACTIVE" && s.expiresAt > now) ?? subs[0] ?? null;

      const userRadius = radiusByUser.get(client.id) || [];
      const devices = userRadius.map((ru) => {
        const mac = ru.macAddress || ru.username;
        const credsLive = ru.isActive && ru.expiresAt > now;
        return {
          mac,
          isActive: credsLive,
          expiresAt: ru.expiresAt.toISOString(),
          packageName: ru.subscription?.package?.name ?? null,
          isOnline: credsLive && onlineUsernames.has(ru.username),
        };
      });

      const timeRemainingSeconds = activeSubscription
        ? Math.max(0, Math.floor((activeSubscription.expiresAt.getTime() - now.getTime()) / 1000))
        : 0;

      const dataUsedMb = Math.max(
        activeSubscription?.dataUsedMb ?? 0,
        ...subs.map((s) => s.dataUsedMb),
        ...userRadius.map((r) => r.subscription?.dataUsedMb ?? 0),
      );

      const isOnline = devices.some((d) => d.isOnline);

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        isActive: client.isActive,
        createdAt: client.createdAt,
        latestSubscription: subs[0] || null,
        activeSubscription,
        latestSession: client.wifiSessions[0] || null,
        recentSessions: client.wifiSessions,
        devices,
        timeRemainingSeconds,
        dataUsedMb,
        isOnline,
        accessStatus: activeSubscription
          ? activeSubscription.status === "ACTIVE" && activeSubscription.expiresAt > now
            ? "active"
            : "expired"
          : "none",
        totalSpent: totalSpent._sum?.amount || 0,
        totalPayments: totalSpent._count,
        activeDeviceCount: devices.filter((d) => d.isActive).length,
      };
    });

    // CSV Export
    if (format === "csv") {
      const csvHeader =
        "Name,Email,Phone,Total Spent,Payments,Package,Access Status,Time Left (min),Data Used (MB),Devices (MAC)\n";
      const csvRows = enriched
        .map((c) => {
          const mins = Math.ceil(c.timeRemainingSeconds / 60);
          const macs = c.devices.map((d) => d.mac).join("; ");
          return `"${c.name || ""}","${c.email || ""}","${c.phone || ""}",${c.totalSpent},${c.totalPayments},"${c.activeSubscription?.package?.name || ""}","${c.accessStatus}",${mins},${c.dataUsedMb.toFixed(1)},"${macs}"`;
        })
        .join("\n");

      return new Response(csvHeader + csvRows, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="clients-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return apiSuccess(enriched, { page, limit, total });
  } catch (error) {
    console.error("[Reseller Clients GET] Error:", error);
    return apiError("Failed to fetch clients", 500);
  }
}

/**
 * POST /api/v1/reseller/clients
 * Block a client MAC address across all reseller's sites.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const validated = blockMacSchema.parse(body);

    const blocked = await prisma.blockedMac.upsert({
      where: {
        resellerId_mac: { resellerId: ctx.resellerId, mac: validated.mac.toUpperCase() },
      },
      update: { reason: validated.reason },
      create: {
        resellerId: ctx.resellerId,
        mac: validated.mac.toUpperCase(),
        reason: validated.reason,
      },
    });

    await logResellerAction(ctx.userId, "client.mac_blocked", "BlockedMac", blocked.id, {
      mac: validated.mac,
      reason: validated.reason,
    }, getClientIp(req));

    return apiSuccess({ id: blocked.id, mac: blocked.mac, message: "MAC address blocked" });
  } catch (error: any) {
    if (error.name === "ZodError") return apiError("Invalid MAC address format", 422);
    console.error("[Reseller Clients POST] Error:", error);
    return apiError("Failed to block MAC", 500);
  }
}

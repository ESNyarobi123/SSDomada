import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";
import { paginationSchema } from "@/lib/validations/admin";

/**
 * GET /api/v1/admin/customers
 * List all end users (WiFi customers) globally.
 * Supports search by phone, email, name, MAC address.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const search = searchParams.get("search") || undefined;
    const isActive = searchParams.get("isActive");

    const where: any = { role: "END_USER" };

    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        // Search by MAC address through wifi sessions
        { wifiSessions: { some: { clientMac: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          _count: {
            select: { subscriptions: true, payments: true, wifiSessions: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Enrich customers with their latest activity
    const enriched = await Promise.all(
      customers.map(async (customer) => {
        const [latestSession, totalSpent, activeSubscription] = await Promise.all([
          prisma.wifiSession.findFirst({
            where: { userId: customer.id },
            orderBy: { startedAt: "desc" },
            select: { clientMac: true, startedAt: true, endedAt: true, site: { select: { name: true } } },
          }),
          prisma.payment.aggregate({
            where: { userId: customer.id, status: "COMPLETED" },
            _sum: { amount: true },
          }),
          prisma.subscription.findFirst({
            where: { userId: customer.id, status: "ACTIVE" },
            select: { id: true, expiresAt: true, package: { select: { name: true, reseller: { select: { companyName: true } } } } },
          }),
        ]);

        return {
          ...customer,
          latestSession,
          totalSpent: totalSpent._sum.amount || 0,
          activeSubscription,
        };
      })
    );

    return apiSuccess(enriched, { page, limit, total });
  } catch (error) {
    console.error("[Admin Customers GET] Error:", error);
    return apiError("Failed to fetch customers", 500);
  }
}

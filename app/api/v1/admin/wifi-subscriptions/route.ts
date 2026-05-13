import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { paginationSchema, adminCreateWifiSubscriptionSchema } from "@/lib/validations/admin";

/**
 * GET /api/v1/admin/wifi-subscriptions
 * List end-user WiFi subscriptions (customer subscriptions) with filters.
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
    const resellerId = searchParams.get("resellerId") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search")?.trim();

    const clauses: object[] = [];
    if (resellerId) clauses.push({ package: { resellerId } });
    if (status) clauses.push({ status });
    if (search) {
      clauses.push({
        OR: [
          { user: { phone: { contains: search } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
          { user: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    const where = clauses.length > 0 ? { AND: clauses } : {};

    const [subscriptions, total, statusCounts] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
          package: {
            select: {
              id: true,
              name: true,
              price: true,
              duration: true,
              durationMinutes: true,
              reseller: { select: { id: true, companyName: true, brandSlug: true } },
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
      prisma.subscription.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
    ]);

    return apiSuccess(
      {
        subscriptions,
        statusBreakdown: statusCounts.reduce((acc: Record<string, number>, curr) => {
          acc[curr.status] = curr._count;
          return acc;
        }, {}),
      },
      { page, limit, total }
    );
  } catch (error) {
    console.error("[Admin wifi-subscriptions GET] Error:", error);
    return apiError("Failed to list subscriptions", 500);
  }
}

/**
 * POST /api/v1/admin/wifi-subscriptions
 * Create a customer WiFi subscription (comp / manual).
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const body = await req.json();
    const validated = adminCreateWifiSubscriptionSchema.parse(body);

    const [pkg, user] = await Promise.all([
      prisma.package.findUnique({ where: { id: validated.packageId } }),
      prisma.user.findUnique({ where: { id: validated.userId }, select: { id: true, role: true } }),
    ]);
    if (!pkg) return apiError("Package not found", 404, "PACKAGE_NOT_FOUND");
    if (!user) return apiError("User not found", 404, "USER_NOT_FOUND");
    if (user.role !== "END_USER") {
      return apiError("User must be an end-user (WiFi customer) account", 400, "INVALID_ROLE");
    }

    const startedAt = new Date();
    const expiresAt = validated.expiresAt
      ? new Date(validated.expiresAt)
      : new Date(startedAt.getTime() + pkg.durationMinutes * 60 * 1000);

    const sub = await prisma.subscription.create({
      data: {
        userId: validated.userId,
        packageId: validated.packageId,
        status: validated.status,
        startedAt,
        expiresAt,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        package: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
            reseller: { select: { id: true, companyName: true, brandSlug: true } },
          },
        },
      },
    });

    await logAdminAction(
      admin.userId,
      "wifi_subscription.created",
      "Subscription",
      sub.id,
      { packageId: validated.packageId, userId: validated.userId },
      getClientIp(req)
    );

    return apiSuccess(sub);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError(
        "Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "),
        422,
        "VALIDATION_ERROR"
      );
    }
    console.error("[Admin wifi-subscriptions POST] Error:", error);
    return apiError("Failed to create subscription", 500);
  }
}

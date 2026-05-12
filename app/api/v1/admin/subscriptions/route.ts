import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { paginationSchema, createPackageSchema } from "@/lib/validations/admin";

/**
 * GET /api/v1/admin/subscriptions
 * List all packages and subscriptions.
 * ?view=packages — list all WiFi packages across resellers
 * ?view=subscriptions — list all active/expired subscriptions
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

    const view = searchParams.get("view") || "packages";
    const resellerId = searchParams.get("resellerId") || undefined;
    const status = searchParams.get("status") || undefined;

    if (view === "subscriptions") {
      const where: any = {};
      if (status) where.status = status;
      if (resellerId) where.package = { resellerId };

      const [subscriptions, total, statusCounts] = await Promise.all([
        prisma.subscription.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            package: {
              select: {
                id: true,
                name: true,
                price: true,
                duration: true,
                reseller: { select: { companyName: true, brandSlug: true } },
              },
            },
          },
        }),
        prisma.subscription.count({ where }),
        prisma.subscription.groupBy({
          by: ["status"],
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
    }

    // Default: packages view
    const where: any = {};
    if (resellerId) where.resellerId = resellerId;
    if (status === "active") where.isActive = true;
    else if (status === "inactive") where.isActive = false;

    const [packages, total] = await Promise.all([
      prisma.package.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ resellerId: "asc" }, { sortOrder: "asc" }],
        include: {
          reseller: { select: { id: true, companyName: true, brandSlug: true } },
          _count: { select: { subscriptions: true } },
        },
      }),
      prisma.package.count({ where }),
    ]);

    return apiSuccess({ packages }, { page, limit, total });
  } catch (error) {
    console.error("[Admin Subscriptions GET] Error:", error);
    return apiError("Failed to fetch subscriptions", 500);
  }
}

/**
 * POST /api/v1/admin/subscriptions
 * Create a new WiFi package for a reseller (Super Admin can create on behalf).
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const body = await req.json();
    const validated = createPackageSchema.parse(body);

    // Verify reseller exists
    const reseller = await prisma.reseller.findUnique({
      where: { id: validated.resellerId },
    });
    if (!reseller) return apiError("Reseller not found", 404, "RESELLER_NOT_FOUND");

    const pkg = await prisma.package.create({
      data: {
        resellerId: validated.resellerId,
        name: validated.name,
        description: validated.description,
        price: validated.price,
        currency: validated.currency,
        duration: validated.duration,
        durationMinutes: validated.durationMinutes,
        dataLimitMb: validated.dataLimitMb,
        speedLimitUp: validated.speedLimitUp,
        speedLimitDown: validated.speedLimitDown,
        maxDevices: validated.maxDevices,
        sortOrder: validated.sortOrder,
      },
      include: {
        reseller: { select: { companyName: true } },
      },
    });

    await logAdminAction(admin.userId, "package.created", "Package", pkg.id, {
      name: validated.name,
      resellerId: validated.resellerId,
      price: validated.price,
    }, getClientIp(req));

    return apiSuccess(pkg);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "), 422, "VALIDATION_ERROR");
    }
    console.error("[Admin Subscriptions POST] Error:", error);
    return apiError("Failed to create package", 500);
  }
}

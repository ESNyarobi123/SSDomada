import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { paginationSchema, createResellerPlanSchema } from "@/lib/validations/admin";

/**
 * GET /api/v1/admin/platform-plans
 * List SSDomada reseller billing tiers (ResellerPlan).
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
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search")?.trim();

    const where: Record<string, unknown> = {};
    if (isActive === "true") where.isActive = true;
    if (isActive === "false") where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [plans, total] = await Promise.all([
      prisma.resellerPlan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          _count: { select: { subscriptions: true } },
        },
      }),
      prisma.resellerPlan.count({ where }),
    ]);

    return apiSuccess({ plans }, { page, limit, total });
  } catch (error) {
    console.error("[Admin platform-plans GET] Error:", error);
    return apiError("Failed to list platform plans", 500);
  }
}

/**
 * POST /api/v1/admin/platform-plans
 * Create a new reseller billing tier.
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const body = await req.json();
    const validated = createResellerPlanSchema.parse(body);

    const dup = await prisma.resellerPlan.findFirst({
      where: {
        OR: [{ slug: validated.slug }, { name: { equals: validated.name, mode: "insensitive" } }],
      },
    });
    if (dup) {
      return apiError(
        dup.slug === validated.slug ? "Slug already in use" : "A plan with this name already exists",
        409,
        "DUPLICATE"
      );
    }

    const plan = await prisma.resellerPlan.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description ?? null,
        price: validated.price,
        currency: validated.currency,
        interval: validated.interval,
        trialDays: validated.trialDays,
        maxSites: validated.maxSites ?? null,
        maxDevices: validated.maxDevices ?? null,
        maxActiveClients: validated.maxActiveClients ?? null,
        maxStaff: validated.maxStaff ?? null,
        customBranding: validated.customBranding,
        customDomain: validated.customDomain,
        smsNotifications: validated.smsNotifications,
        prioritySupport: validated.prioritySupport,
        apiAccess: validated.apiAccess,
        isActive: validated.isActive,
        isFeatured: validated.isFeatured,
        sortOrder: validated.sortOrder,
      },
    });

    await logAdminAction(admin.userId, "platform_plan.created", "ResellerPlan", plan.id, { slug: plan.slug }, getClientIp(req));

    return apiSuccess(plan);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError(
        "Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "),
        422,
        "VALIDATION_ERROR"
      );
    }
    if (error.code === "P2002") {
      return apiError("Unique constraint violation (name or slug)", 409, "DUPLICATE");
    }
    console.error("[Admin platform-plans POST] Error:", error);
    return apiError("Failed to create platform plan", 500);
  }
}

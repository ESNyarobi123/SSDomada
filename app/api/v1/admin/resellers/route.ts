import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { createResellerSchema, paginationSchema } from "@/lib/validations/admin";
import { OmadaService } from "@/server/services/omada.service";
import bcrypt from "bcryptjs";

/**
 * GET /api/v1/admin/resellers
 * List all resellers with search, filter, and pagination.
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
    const status = searchParams.get("status"); // "active" | "suspended" | "all"
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // Build where clause
    const where: any = {};

    if (status === "active") where.isActive = true;
    else if (status === "suspended") where.isActive = false;

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { brandSlug: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { phone: { contains: search } },
      ];
    }

    const [resellers, total] = await Promise.all([
      prisma.reseller.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
          _count: { select: { devices: true, packages: true, payments: true, sites: true, withdrawals: true } },
        },
      }),
      prisma.reseller.count({ where }),
    ]);

    // Enrich with revenue data
    const enriched = await Promise.all(
      resellers.map(async (reseller) => {
        const revenue = await prisma.payment.aggregate({
          where: { resellerId: reseller.id, status: "COMPLETED" },
          _sum: { amount: true, platformFee: true, resellerAmount: true },
          _count: true,
        });

        return {
          ...reseller,
          revenue: {
            totalAmount: revenue._sum.amount || 0,
            platformFee: revenue._sum.platformFee || 0,
            resellerEarnings: revenue._sum.resellerAmount || 0,
            transactionCount: revenue._count,
          },
        };
      })
    );

    return apiSuccess(enriched, { page, limit, total });
  } catch (error) {
    console.error("[Admin Resellers GET] Error:", error);
    return apiError("Failed to fetch resellers", 500);
  }
}

/**
 * POST /api/v1/admin/resellers
 * Create a new reseller (user + reseller profile + captive portal config).
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const body = await req.json();
    const validated = createResellerSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existingUser) {
      return apiError("Email already registered", 409, "EMAIL_EXISTS");
    }

    // Check if brandSlug already exists
    const existingSlug = await prisma.reseller.findUnique({
      where: { brandSlug: validated.brandSlug },
    });
    if (existingSlug) {
      return apiError("Brand slug already taken", 409, "SLUG_EXISTS");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 12);

    // Create user + reseller + captive portal config in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          name: validated.name,
          email: validated.email,
          password: hashedPassword,
          phone: validated.phone,
          role: "RESELLER",
        },
      });

      // Create reseller profile
      const reseller = await tx.reseller.create({
        data: {
          userId: user.id,
          companyName: validated.companyName,
          brandSlug: validated.brandSlug,
          phone: validated.phone,
          address: validated.address,
          commissionRate: validated.commissionRate,
          currency: validated.currency,
        },
      });

      // Create default captive portal config
      await tx.captivePortalConfig.create({
        data: {
          resellerId: reseller.id,
          companyName: validated.companyName,
        },
      });

      return { user, reseller };
    });

    // Audit log
    await logAdminAction(
      admin.userId,
      "reseller.created",
      "Reseller",
      result.reseller.id,
      { companyName: validated.companyName, email: validated.email },
      getClientIp(req)
    );

    // Best-effort: bootstrap default Omada site for the reseller
    void OmadaService.ensureResellerSite(result.reseller.id, validated.companyName).catch((err) => {
      console.error("[Admin Resellers POST] ensureResellerSite failed:", err);
    });

    return apiSuccess({
      id: result.reseller.id,
      userId: result.user.id,
      companyName: result.reseller.companyName,
      brandSlug: result.reseller.brandSlug,
      email: result.user.email,
      createdAt: result.reseller.createdAt,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "), 422, "VALIDATION_ERROR");
    }
    console.error("[Admin Resellers POST] Error:", error);
    return apiError("Failed to create reseller", 500);
  }
}

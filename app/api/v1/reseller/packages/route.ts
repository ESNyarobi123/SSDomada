import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { paginationSchema, createPackageSchema } from "@/lib/validations/reseller";

/**
 * GET /api/v1/reseller/packages
 * List all WiFi packages belonging to this reseller, with sales stats.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // "active" | "inactive" | "all"

    const where: Record<string, unknown> = { resellerId: ctx.resellerId };
    if (status === "active") (where as any).isActive = true;
    else if (status === "inactive") (where as any).isActive = false;

    const packages = await prisma.package.findMany({
      where: where as any,
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { subscriptions: true, vouchers: true } },
      },
    });

    // Sales stats per package
    const enriched = await Promise.all(
      packages.map(async (pkg) => {
        const [salesTotal, activeSubCount] = await Promise.all([
          prisma.payment.aggregate({
            where: { subscription: { packageId: pkg.id }, resellerId: ctx.resellerId, status: "COMPLETED" as any },
            _sum: { amount: true, resellerAmount: true },
            _count: true,
          }),
          prisma.subscription.count({
            where: { packageId: pkg.id, status: "ACTIVE" },
          }),
        ]);

        return {
          ...pkg,
          sales: {
            totalRevenue: salesTotal._sum?.amount || 0,
            resellerEarnings: salesTotal._sum?.resellerAmount || 0,
            totalSold: salesTotal._count,
            activeSubs: activeSubCount,
          },
        };
      })
    );

    return apiSuccess(enriched);
  } catch (error) {
    console.error("[Reseller Packages GET] Error:", error);
    return apiError("Failed to fetch packages", 500);
  }
}

/**
 * POST /api/v1/reseller/packages
 * Create a new WiFi package.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const validated = createPackageSchema.parse(body);

    const pkg = await prisma.package.create({
      data: {
        resellerId: ctx.resellerId,
        name: validated.name,
        description: validated.description,
        price: validated.price,
        currency: validated.currency,
        duration: validated.duration as any,
        durationMinutes: validated.durationMinutes,
        dataLimitMb: validated.dataLimitMb,
        speedLimitUp: validated.speedLimitUp,
        speedLimitDown: validated.speedLimitDown,
        maxDevices: validated.maxDevices,
        isFeatured: validated.isFeatured,
        sortOrder: validated.sortOrder,
      },
    });

    await logResellerAction(ctx.userId, "package.created", "Package", pkg.id, {
      name: validated.name,
      price: validated.price,
    }, getClientIp(req));

    return apiSuccess(pkg);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "), 422);
    }
    console.error("[Reseller Packages POST] Error:", error);
    return apiError("Failed to create package", 500);
  }
}

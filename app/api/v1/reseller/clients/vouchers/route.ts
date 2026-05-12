import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { createVoucherSchema, paginationSchema } from "@/lib/validations/reseller";
import crypto from "crypto";

/**
 * GET /api/v1/reseller/clients/vouchers
 * List all vouchers created by this reseller.
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

    const status = searchParams.get("status"); // "used" | "unused" | "expired"

    const where: Record<string, unknown> = { resellerId: ctx.resellerId };
    if (status === "used") (where as any).isUsed = true;
    else if (status === "unused") (where as any).isUsed = false;
    else if (status === "expired") {
      (where as any).isUsed = false;
      (where as any).expiresAt = { lt: new Date() };
    }

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          package: { select: { name: true, price: true, duration: true } },
          usedBy: { select: { name: true, phone: true, email: true } },
        },
      }),
      prisma.voucher.count({ where: where as any }),
    ]);

    return apiSuccess(vouchers, { page, limit, total });
  } catch (error) {
    console.error("[Reseller Vouchers GET] Error:", error);
    return apiError("Failed to fetch vouchers", 500);
  }
}

/**
 * POST /api/v1/reseller/clients/vouchers
 * Generate batch of voucher codes for a specific package.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const validated = createVoucherSchema.parse(body);

    // Verify package ownership
    const pkg = await prisma.package.findFirst({
      where: { id: validated.packageId, resellerId: ctx.resellerId },
    });
    if (!pkg) return apiError("Package not found", 404, "PACKAGE_NOT_FOUND");

    // Generate unique codes
    const vouchers = [];
    for (let i = 0; i < validated.quantity; i++) {
      const code = generateVoucherCode();
      vouchers.push({
        resellerId: ctx.resellerId,
        packageId: validated.packageId,
        code,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        note: validated.note,
      });
    }

    const created = await prisma.voucher.createMany({ data: vouchers as any });

    // Fetch created vouchers to return
    const createdVouchers = await prisma.voucher.findMany({
      where: { resellerId: ctx.resellerId, code: { in: vouchers.map((v) => v.code) } },
      include: { package: { select: { name: true, price: true } } },
    });

    await logResellerAction(ctx.userId, "vouchers.generated", "Voucher", undefined, {
      packageId: validated.packageId,
      quantity: validated.quantity,
    }, getClientIp(req));

    return apiSuccess({
      generated: created.count,
      vouchers: createdVouchers,
    });
  } catch (error: any) {
    if (error.name === "ZodError") return apiError("Validation failed", 422);
    console.error("[Reseller Vouchers POST] Error:", error);
    return apiError("Failed to generate vouchers", 500);
  }
}

/**
 * Generate a unique 8-character voucher code (uppercase alphanumeric).
 */
function generateVoucherCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

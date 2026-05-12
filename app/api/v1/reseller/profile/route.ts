import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { updateProfileSchema } from "@/lib/validations/reseller";

/**
 * GET /api/v1/reseller/profile
 * Get reseller's business profile, branding info, subscription status.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const reseller = await prisma.reseller.findUnique({
      where: { id: ctx.resellerId },
      include: {
        user: {
          select: { name: true, email: true, phone: true, image: true, createdAt: true },
        },
        captivePortalConfig: {
          select: { template: true, logo: true, companyName: true },
        },
        _count: {
          select: { devices: true, packages: true, sites: true, payments: true },
        },
      },
    });

    if (!reseller) return apiError("Profile not found", 404);

    return apiSuccess({
      id: reseller.id,
      companyName: reseller.companyName,
      brandSlug: reseller.brandSlug,
      logo: reseller.logo,
      description: reseller.description,
      phone: reseller.phone,
      address: reseller.address,
      currency: reseller.currency,
      commissionRate: reseller.commissionRate,
      walletBalance: reseller.walletBalance,
      totalEarnings: reseller.totalEarnings,
      isActive: reseller.isActive,
      createdAt: reseller.createdAt,
      user: reseller.user,
      captivePortal: reseller.captivePortalConfig,
      stats: reseller._count,
      portalUrl: `/portal/${reseller.brandSlug}`,
    });
  } catch (error) {
    console.error("[Reseller Profile GET] Error:", error);
    return apiError("Failed to load profile", 500);
  }
}

/**
 * PATCH /api/v1/reseller/profile
 * Update reseller business profile (name, phone, logo, description).
 * Note: brandSlug and commissionRate can only be changed by Super Admin.
 */
export async function PATCH(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const validated = updateProfileSchema.parse(body);

    const updated = await prisma.reseller.update({
      where: { id: ctx.resellerId },
      data: validated,
      select: {
        id: true,
        companyName: true,
        brandSlug: true,
        logo: true,
        description: true,
        phone: true,
        address: true,
      },
    });

    // Also update user name if provided
    if (body.name) {
      await prisma.user.update({
        where: { id: ctx.userId },
        data: { name: body.name },
      });
    }

    await logResellerAction(ctx.userId, "profile.updated", "Reseller", ctx.resellerId, validated, getClientIp(req));

    return apiSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") return apiError("Validation failed", 422);
    console.error("[Reseller Profile PATCH] Error:", error);
    return apiError("Failed to update profile", 500);
  }
}

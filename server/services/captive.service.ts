import { prisma } from "@/server/lib/prisma";
import type { UpdateCaptivePortalInput } from "@/types/reseller";

export class CaptiveService {
  /**
   * Get captive portal data for a brand (public-facing)
   */
  static async getPortalByBrand(brandSlug: string) {
    const reseller = await prisma.reseller.findUnique({
      where: { brandSlug },
      include: {
        captivePortalConfig: true,
        packages: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            duration: true,
            durationMinutes: true,
            dataLimitMb: true,
            speedLimitDown: true,
            speedLimitUp: true,
            maxDevices: true,
          },
        },
      },
    });

    if (!reseller || !reseller.isActive) return null;

    return {
      brand: {
        companyName: reseller.companyName,
        slug: reseller.brandSlug,
        logo: reseller.logo,
      },
      portal: reseller.captivePortalConfig,
      packages: reseller.packages,
    };
  }

  /**
   * Update captive portal config for a reseller
   */
  static async updatePortalConfig(resellerId: string, data: UpdateCaptivePortalInput) {
    return prisma.captivePortalConfig.upsert({
      where: { resellerId },
      update: data,
      create: { resellerId, ...data },
    });
  }

  /**
   * Get portal config for reseller dashboard
   */
  static async getPortalConfig(resellerId: string) {
    return prisma.captivePortalConfig.findUnique({
      where: { resellerId },
    });
  }
}

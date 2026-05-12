import { prisma } from "@/server/lib/prisma";
import { OmadaService } from "./omada.service";
import { slugify } from "@/server/utils";
import type { CreateResellerInput, UpdateResellerInput } from "@/types/reseller";

export class ResellerService {
  /**
   * Create a new reseller with Omada site
   */
  static async create(data: CreateResellerInput) {
    const brandSlug = data.brandSlug || slugify(data.companyName);

    // 1. Create reseller in DB
    const reseller = await prisma.reseller.create({
      data: {
        userId: data.userId,
        companyName: data.companyName,
        brandSlug,
        logo: data.logo,
        description: data.description,
        phone: data.phone,
        address: data.address,
        commissionRate: data.commissionRate ?? 0.10,
        currency: data.currency ?? "TZS",
      },
    });

    // 2. Create default captive portal config
    await prisma.captivePortalConfig.create({
      data: {
        resellerId: reseller.id,
        companyName: data.companyName,
      },
    });

    // 3. Create Omada site
    try {
      const site = await OmadaService.createSite(reseller.id, data.companyName);
      await prisma.reseller.update({
        where: { id: reseller.id },
        data: { omadaSiteId: site.omadaSiteId },
      });
    } catch (err) {
      console.error("Failed to create Omada site:", err);
    }

    return reseller;
  }

  /**
   * Get reseller by ID with related data
   */
  static async getById(id: string) {
    return prisma.reseller.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        sites: true,
        captivePortalConfig: true,
        _count: { select: { devices: true, packages: true, payments: true } },
      },
    });
  }

  /**
   * Get reseller by brand slug (for captive portal)
   */
  static async getBySlug(brandSlug: string) {
    return prisma.reseller.findUnique({
      where: { brandSlug },
      include: { captivePortalConfig: true },
    });
  }

  /**
   * List all resellers (Super Admin)
   */
  static async listAll(page = 1, limit = 20) {
    const [resellers, total] = await Promise.all([
      prisma.reseller.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { devices: true, payments: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reseller.count(),
    ]);

    return { resellers, total, page, limit };
  }

  /**
   * Update reseller
   */
  static async update(id: string, data: UpdateResellerInput) {
    return prisma.reseller.update({ where: { id }, data });
  }

  /**
   * Get reseller dashboard stats
   */
  static async getDashboardStats(resellerId: string) {
    const [devices, activeSubscriptions, totalRevenue, pendingWithdrawals] = await Promise.all([
      prisma.device.groupBy({
        by: ["status"],
        where: { resellerId },
        _count: true,
      }),
      prisma.subscription.count({
        where: { package: { resellerId }, status: "ACTIVE" },
      }),
      prisma.payment.aggregate({
        where: { resellerId, status: "COMPLETED" },
        _sum: { resellerAmount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { resellerId, status: "PENDING" },
        _sum: { amount: true },
      }),
    ]);

    return {
      devices,
      activeSubscriptions,
      totalRevenue: totalRevenue._sum?.resellerAmount || 0,
      pendingWithdrawals: pendingWithdrawals._sum.amount || 0,
    };
  }
}

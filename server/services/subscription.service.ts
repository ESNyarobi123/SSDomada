import { prisma } from "@/server/lib/prisma";
import { calculateExpiryDate } from "@/server/utils";

export class SubscriptionService {
  /**
   * Create a subscription after successful payment
   */
  static async create(userId: string, packageId: string) {
    const pkg = await prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new Error("Package not found");

    const expiresAt = calculateExpiryDate(pkg.durationMinutes);

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        packageId,
        status: "ACTIVE",
        expiresAt,
      },
    });

    return subscription;
  }

  /**
   * Check if a user has an active subscription
   */
  static async getActiveSubscription(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      include: { package: true },
    });
  }

  /**
   * Expire subscriptions that have passed their expiry date
   * (Called by cron job)
   */
  static async expireOverdue() {
    const result = await prisma.subscription.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });

    return result.count;
  }

  /**
   * List subscriptions for a user
   */
  static async listByUser(userId: string) {
    return prisma.subscription.findMany({
      where: { userId },
      include: { package: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * List active subscriptions for a reseller's packages
   */
  static async listByReseller(resellerId: string, page = 1, limit = 20) {
    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: { package: { resellerId } },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, email: true } },
          package: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscription.count({ where: { package: { resellerId } } }),
    ]);

    return { subscriptions, total, page, limit };
  }
}

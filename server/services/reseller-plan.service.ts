import { prisma } from "@/server/lib/prisma";
import { SnippeService } from "./snippe.service";
import { computeInitialSubscriptionState, computePlanPeriodEnd } from "./reseller-plan-access.service";

/**
 * RESELLER PLAN SERVICE
 *
 * Handles billing for resellers — i.e. SSDomada charging resellers
 * for use of the platform. This is separate from end-user WiFi packages.
 */
export class ResellerPlanService {
  /**
   * List all active plans (public — used for pricing page).
   */
  static async listPublicPlans() {
    return (prisma as any).resellerPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  /**
   * Get current subscription for a reseller (or null).
   */
  static async getResellerSubscription(resellerId: string) {
    return (prisma as any).resellerPlanSubscription.findUnique({
      where: { resellerId },
      include: { plan: true },
    });
  }

  /**
   * Compute remaining capacity (e.g. how many sites/devices the reseller can still add).
   */
  static async computeUsage(resellerId: string) {
    const [sub, sites, devices, activeClients] = await Promise.all([
      this.getResellerSubscription(resellerId),
      prisma.site.count({ where: { resellerId } }),
      prisma.device.count({ where: { resellerId } }),
      prisma.radiusUser.count({
        where: { resellerId, isActive: true, expiresAt: { gt: new Date() } },
      }),
    ]);

    const plan = sub?.plan;
    return {
      subscription: sub,
      usage: { sites, devices, activeClients },
      limits: plan
        ? {
            maxSites: plan.maxSites,
            maxDevices: plan.maxDevices,
            maxActiveClients: plan.maxActiveClients,
            maxStaff: plan.maxStaff,
          }
        : null,
      features: plan
        ? {
            customBranding: plan.customBranding,
            customDomain: plan.customDomain,
            smsNotifications: plan.smsNotifications,
            prioritySupport: plan.prioritySupport,
            apiAccess: plan.apiAccess,
          }
        : null,
      atCapacity: plan
        ? {
            sites: plan.maxSites != null && sites >= plan.maxSites,
            devices: plan.maxDevices != null && devices >= plan.maxDevices,
            activeClients:
              plan.maxActiveClients != null && activeClients >= plan.maxActiveClients,
          }
        : { sites: false, devices: false, activeClients: false },
    };
  }

  /**
   * Assign the requested public plan during reseller onboarding when it can be
   * activated without collecting money (free or trial). Falls back to the first
   * active free/trial plan so new resellers are not locked out by the paywall.
   */
  static async assignInitialPlan(resellerId: string, requestedSlug?: string | null) {
    const requested = requestedSlug
      ? await (prisma as any).resellerPlan.findFirst({
          where: { slug: requestedSlug, isActive: true },
          orderBy: { sortOrder: "asc" },
        })
      : null;

    const plan =
      requested && (requested.price <= 0 || requested.trialDays > 0)
        ? requested
        : await (prisma as any).resellerPlan.findFirst({
            where: {
              isActive: true,
              OR: [{ price: { lte: 0 } }, { trialDays: { gt: 0 } }],
            },
            orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
          });

    if (!plan) return null;

    const lifecycle = computeInitialSubscriptionState(plan);
    return (prisma as any).resellerPlanSubscription.upsert({
      where: { resellerId },
      update: {
        planId: plan.id,
        status: lifecycle.status,
        startedAt: lifecycle.startedAt,
        currentPeriodEnd: lifecycle.currentPeriodEnd,
        trialEndsAt: lifecycle.trialEndsAt,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
      },
      create: {
        resellerId,
        planId: plan.id,
        status: lifecycle.status,
        startedAt: lifecycle.startedAt,
        currentPeriodEnd: lifecycle.currentPeriodEnd,
        trialEndsAt: lifecycle.trialEndsAt,
      },
      include: { plan: true },
    });
  }

  /**
   * Start (or upgrade) a reseller subscription.
   * If plan price is 0 → activates immediately as TRIAL/ACTIVE.
   * Otherwise creates a Snippe checkout session.
   */
  static async subscribe(opts: {
    resellerId: string;
    planId: string;
    customerPhone?: string;
    callbackUrl: string;
    webhookUrl: string;
  }) {
    const plan = await (prisma as any).resellerPlan.findUnique({
      where: { id: opts.planId },
    });
    if (!plan || !plan.isActive) throw new Error("Plan not available");

    const now = new Date();
    const end = computePlanPeriodEnd(plan, now);
    const lifecycle = computeInitialSubscriptionState(plan, undefined, now);

    // Free or free-trial flow — activate immediately. Paid plans without a
    // trial still go through hosted checkout below.
    if (plan.price <= 0 || plan.trialDays > 0) {
      const sub = await (prisma as any).resellerPlanSubscription.upsert({
        where: { resellerId: opts.resellerId },
        update: {
          planId: plan.id,
          status: lifecycle.status,
          startedAt: lifecycle.startedAt,
          currentPeriodEnd: lifecycle.currentPeriodEnd,
          trialEndsAt: lifecycle.trialEndsAt,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
        },
        create: {
          resellerId: opts.resellerId,
          planId: plan.id,
          status: lifecycle.status,
          startedAt: lifecycle.startedAt,
          currentPeriodEnd: lifecycle.currentPeriodEnd,
          trialEndsAt: lifecycle.trialEndsAt,
        },
      });
      return { subscription: sub, checkoutUrl: null, requiresPayment: false };
    }

    // Paid flow — create Snippe payment session (hosted checkout)
    const idempotencyKey = SnippeService.generateIdempotencyKey("plan");
    const reseller = await prisma.reseller.findUnique({
      where: { id: opts.resellerId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!reseller) throw new Error("Reseller not found");

    const snippe = await SnippeService.createSession(
      {
        amount: plan.price,
        currency: plan.currency,
        description: `SSDomada ${plan.name} (${plan.interval.toLowerCase()})`,
        customer: {
          name: reseller.user.name || reseller.companyName,
          phone: opts.customerPhone || reseller.phone || undefined,
          email: reseller.user.email,
        },
        redirectUrl: opts.callbackUrl,
        webhookUrl: opts.webhookUrl,
        metadata: {
          type: "reseller_plan",
          resellerId: opts.resellerId,
          planId: plan.id,
          idempotencyKey,
        },
      },
      idempotencyKey,
    );

    if (!snippe.success || !snippe.reference) {
      throw new Error(snippe.message || "Payment init failed");
    }

    // Pre-create pending subscription with PAST_DUE → flip to ACTIVE in webhook
    const sub = await (prisma as any).resellerPlanSubscription.upsert({
      where: { resellerId: opts.resellerId },
      update: {
        planId: plan.id,
        status: "PAST_DUE",
        lastPaymentRef: snippe.reference,
      },
      create: {
        resellerId: opts.resellerId,
        planId: plan.id,
        status: "PAST_DUE",
        currentPeriodEnd: end, // will be reset on activation
        lastPaymentRef: snippe.reference,
      },
    });

    return { subscription: sub, checkoutUrl: snippe.checkoutUrl, requiresPayment: true };
  }

  /**
   * Cancel subscription (effective at period end).
   */
  static async cancel(resellerId: string) {
    return (prisma as any).resellerPlanSubscription.update({
      where: { resellerId },
      data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
    });
  }

  /**
   * Process a successful reseller plan payment webhook.
   * Snippe will call this via the regular webhook handler when metadata.type == "reseller_plan".
   */
  static async handlePaymentCompleted(reference: string) {
    const sub = await (prisma as any).resellerPlanSubscription.findFirst({
      where: { lastPaymentRef: reference },
      include: { plan: true },
    });
    if (!sub) return null;

    const now = new Date();
    const end = new Date(now);
    if (sub.plan.interval === "MONTHLY") end.setMonth(end.getMonth() + 1);
    else if (sub.plan.interval === "YEARLY") end.setFullYear(end.getFullYear() + 1);
    else if (sub.plan.interval === "LIFETIME") end.setFullYear(end.getFullYear() + 100);

    return (prisma as any).resellerPlanSubscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        startedAt: now,
        currentPeriodEnd: end,
        lastPaymentAt: now,
      },
    });
  }
}

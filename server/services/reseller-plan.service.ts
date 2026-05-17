import { prisma } from "@/server/lib/prisma";
import { detectTanzaniaMobileProvider, normalizeTanzaniaPhone } from "@/lib/tanzania-mobile";
import { SnippeService } from "./snippe.service";
import {
  computeInitialSubscriptionState,
  computePlanPeriodEnd,
  formatPlanPeriodLabel,
  getPlanAccessSnapshot,
  planDaysRemaining,
} from "./reseller-plan-access.service";

export type ResellerPlanPaymentMethod = "MOBILE" | "CARD" | "WALLET";

const PENDING_PLAN_CHECKOUT_KIND = "pending_plan_checkout" as const;

type PendingPlanCheckoutSnapshot = {
  kind: typeof PENDING_PLAN_CHECKOUT_KIND;
  targetPlanId: string;
  paymentReference: string;
  previous: {
    planId: string;
    status: string;
    startedAt: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    cancelledAt: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

function parsePendingCheckout(snapshotJson: unknown): PendingPlanCheckoutSnapshot | null {
  if (!snapshotJson || typeof snapshotJson !== "object") return null;
  const s = snapshotJson as PendingPlanCheckoutSnapshot;
  if (s.kind !== PENDING_PLAN_CHECKOUT_KIND || !s.targetPlanId || !s.paymentReference) return null;
  return s;
}

function subscriptionStillEntitled(sub: {
  status: string;
  currentPeriodEnd: Date | string | null;
}): boolean {
  if (!["ACTIVE", "TRIAL"].includes(sub.status)) return false;
  if (!sub.currentPeriodEnd) return true;
  return new Date(sub.currentPeriodEnd) >= new Date();
}

function snapshotFromSubscription(sub: {
  planId: string;
  status: string;
  startedAt: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  cancelledAt: Date | null;
  cancelAtPeriodEnd: boolean;
}): PendingPlanCheckoutSnapshot["previous"] {
  return {
    planId: sub.planId,
    status: sub.status,
    startedAt: sub.startedAt.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

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
    paymentMethod?: ResellerPlanPaymentMethod;
    customerPhone?: string;
    callbackUrl: string;
    cancelUrl?: string;
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

    if (!opts.paymentMethod) {
      throw new Error("Choose how to pay: mobile money, card, or wallet balance.");
    }

    const idempotencyKey = SnippeService.generateIdempotencyKey("plan");
    const reseller = await prisma.reseller.findUnique({
      where: { id: opts.resellerId },
      include: { user: { select: { email: true, name: true, phone: true } } },
    });
    if (!reseller) throw new Error("Reseller not found");

    const customer = {
      name: reseller.user.name || reseller.companyName,
      phone: opts.customerPhone || reseller.phone || reseller.user.phone || undefined,
      email: reseller.user.email,
    };

    const metadata = {
      type: "reseller_plan",
      resellerId: opts.resellerId,
      planId: plan.id,
      idempotencyKey,
    };

    // Pay from WiFi earnings wallet (no Snippe).
    if (opts.paymentMethod === "WALLET") {
      const sub = await prisma.$transaction(async (tx) => {
        const row = await tx.reseller.findUnique({
          where: { id: opts.resellerId },
          select: { walletBalance: true, currency: true },
        });
        if (!row) throw new Error("Reseller not found");
        if (row.walletBalance < plan.price) {
          throw new Error(
            `Insufficient wallet balance. Available: ${row.walletBalance.toLocaleString()} ${row.currency}, required: ${plan.price.toLocaleString()} ${plan.currency}.`,
          );
        }

        await tx.reseller.update({
          where: { id: opts.resellerId },
          data: { walletBalance: { decrement: plan.price } },
        });

        const now = new Date();
        const periodEnd = computePlanPeriodEnd(plan, now);
        return (tx as any).resellerPlanSubscription.upsert({
          where: { resellerId: opts.resellerId },
          update: {
            planId: plan.id,
            status: "ACTIVE",
            startedAt: now,
            currentPeriodEnd: periodEnd,
            trialEndsAt: null,
            cancelledAt: null,
            cancelAtPeriodEnd: false,
            lastPaymentRef: `wallet_${idempotencyKey}`,
            lastPaymentAt: now,
          },
          create: {
            resellerId: opts.resellerId,
            planId: plan.id,
            status: "ACTIVE",
            startedAt: now,
            currentPeriodEnd: periodEnd,
            lastPaymentRef: `wallet_${idempotencyKey}`,
            lastPaymentAt: now,
          },
          include: { plan: true },
        });
      });

      return {
        subscription: sub,
        checkoutUrl: null,
        requiresPayment: false,
        polling: false,
        paymentReference: null,
      };
    }

    // Mobile money — STK push to phone (same pattern as captive portal).
    if (opts.paymentMethod === "MOBILE") {
      const phone = normalizeTanzaniaPhone(opts.customerPhone || customer.phone || "");
      if (!phone) throw new Error("Phone number is required for mobile money payment");
      if (!detectTanzaniaMobileProvider(phone)) {
        throw new Error(
          "Could not detect mobile money provider. Use a Tanzanian Airtel, M-Pesa, Mixx, or Halotel number.",
        );
      }

      const snippe = await SnippeService.createPayment(
        {
          amount: plan.price,
          currency: plan.currency,
          paymentType: "mobile",
          phone,
          description: `SSDomada ${plan.name} (${plan.interval.toLowerCase()})`,
          customer,
          webhookUrl: opts.webhookUrl,
          metadata,
        },
        idempotencyKey,
      );

      if (!snippe.success || !snippe.reference) {
        throw new Error(snippe.message || "Mobile payment could not be started");
      }

      const sub = await this.recordPendingPlanCheckout({
        resellerId: opts.resellerId,
        targetPlan: plan,
        paymentReference: snippe.reference,
        fallbackPeriodEnd: end,
      });

      return {
        subscription: sub,
        checkoutUrl: null,
        requiresPayment: true,
        polling: true,
        paymentReference: snippe.reference,
      };
    }

    // Card — hosted Snippe checkout (card only).
    const snippe = await SnippeService.createSession(
      {
        amount: plan.price,
        currency: plan.currency,
        description: `SSDomada ${plan.name} (${plan.interval.toLowerCase()})`,
        customer,
        redirectUrl: opts.callbackUrl,
        webhookUrl: opts.webhookUrl,
        allowedMethods: ["card"],
        metadata,
      },
      idempotencyKey,
    );

    if (!snippe.success || !snippe.reference) {
      throw new Error(snippe.message || "Card checkout could not be started");
    }

    const sub = await this.recordPendingPlanCheckout({
      resellerId: opts.resellerId,
      targetPlan: plan,
      paymentReference: snippe.reference,
      fallbackPeriodEnd: end,
    });

    return {
      subscription: sub,
      checkoutUrl: snippe.checkoutUrl,
      requiresPayment: true,
      polling: false,
      paymentReference: snippe.reference,
    };
  }

  /**
   * While checkout is in progress, keep an active trial/plan on the books.
   * Only switch to PAST_DUE when the reseller has no current entitlement.
   */
  private static async recordPendingPlanCheckout(opts: {
    resellerId: string;
    targetPlan: { id: string; interval: string };
    paymentReference: string;
    fallbackPeriodEnd: Date;
  }) {
    const existing = await (prisma as any).resellerPlanSubscription.findUnique({
      where: { resellerId: opts.resellerId },
    });

    const pendingSnapshot: PendingPlanCheckoutSnapshot = {
      kind: PENDING_PLAN_CHECKOUT_KIND,
      targetPlanId: opts.targetPlan.id,
      paymentReference: opts.paymentReference,
      previous: existing && subscriptionStillEntitled(existing) ? snapshotFromSubscription(existing) : null,
    };

    if (pendingSnapshot.previous) {
      return (prisma as any).resellerPlanSubscription.update({
        where: { resellerId: opts.resellerId },
        data: {
          lastPaymentRef: opts.paymentReference,
          snapshotJson: pendingSnapshot,
        },
        include: { plan: true },
      });
    }

    return (prisma as any).resellerPlanSubscription.upsert({
      where: { resellerId: opts.resellerId },
      update: {
        planId: opts.targetPlan.id,
        status: "PAST_DUE",
        lastPaymentRef: opts.paymentReference,
        snapshotJson: pendingSnapshot,
      },
      create: {
        resellerId: opts.resellerId,
        planId: opts.targetPlan.id,
        status: "PAST_DUE",
        currentPeriodEnd: opts.fallbackPeriodEnd,
        lastPaymentRef: opts.paymentReference,
        snapshotJson: pendingSnapshot,
      },
      include: { plan: true },
    });
  }

  /**
   * Cancel an in-flight plan checkout and restore the previous trial/subscription.
   */
  static async abandonPendingCheckout(resellerId: string, paymentReference?: string) {
    const sub = await (prisma as any).resellerPlanSubscription.findUnique({
      where: { resellerId },
    });
    if (!sub) return { restored: false };

    const pending = parsePendingCheckout(sub.snapshotJson);
    if (paymentReference && sub.lastPaymentRef && sub.lastPaymentRef !== paymentReference) {
      return { restored: false, reason: "reference_mismatch" as const };
    }
    if (!pending && sub.status !== "PAST_DUE") {
      return { restored: false, reason: "nothing_pending" as const };
    }

    if (pending?.previous) {
      const prev = pending.previous;
      await (prisma as any).resellerPlanSubscription.update({
        where: { resellerId },
        data: {
          planId: prev.planId,
          status: prev.status,
          startedAt: new Date(prev.startedAt),
          currentPeriodEnd: new Date(prev.currentPeriodEnd),
          trialEndsAt: prev.trialEndsAt ? new Date(prev.trialEndsAt) : null,
          cancelledAt: prev.cancelledAt ? new Date(prev.cancelledAt) : null,
          cancelAtPeriodEnd: prev.cancelAtPeriodEnd,
          lastPaymentRef: null,
          snapshotJson: null,
        },
      });
      return { restored: true };
    }

    if (sub.status === "PAST_DUE") {
      await (prisma as any).resellerPlanSubscription.delete({ where: { resellerId } });
      return { restored: true, cleared: true as const };
    }

    await (prisma as any).resellerPlanSubscription.update({
      where: { resellerId },
      data: { lastPaymentRef: null, snapshotJson: null },
    });
    return { restored: true };
  }

  /** Billing + paywall snapshot for dashboard sidebar and plan picker. */
  static async getBillingAccess(resellerId: string) {
    const [usage, accessSnapshot, reseller] = await Promise.all([
      this.computeUsage(resellerId),
      getPlanAccessSnapshot(resellerId),
      prisma.reseller.findUnique({
        where: { id: resellerId },
        select: { walletBalance: true, currency: true, phone: true, user: { select: { phone: true } } },
      }),
    ]);
    const sub = usage.subscription;
    const access = accessSnapshot.access;
    return {
      ...usage,
      wallet: {
        balance: reseller?.walletBalance ?? 0,
        currency: reseller?.currency ?? "TZS",
      },
      defaultPhone: reseller?.phone || reseller?.user?.phone || null,
      features: accessSnapshot.features,
      access: {
        ok: access.ok,
        enforced: accessSnapshot.enforced,
        code: access.ok ? undefined : access.code,
        message: access.ok ? undefined : access.message,
      },
      period: sub
        ? {
            status: sub.status as string,
            planName: sub.plan?.name ?? null,
            planSlug: sub.plan?.slug ?? null,
            endsAt: sub.currentPeriodEnd,
            trialEndsAt: sub.trialEndsAt,
            daysRemaining: planDaysRemaining(sub.currentPeriodEnd),
            label: formatPlanPeriodLabel(sub),
            cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
          }
        : null,
    };
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

    const pending = parsePendingCheckout(sub.snapshotJson);
    const targetPlanId = pending?.targetPlanId ?? sub.planId;
    const targetPlan =
      targetPlanId === sub.planId
        ? sub.plan
        : await (prisma as any).resellerPlan.findUnique({ where: { id: targetPlanId } });
    if (!targetPlan) return null;

    const now = new Date();
    const end = computePlanPeriodEnd(targetPlan, now);

    return (prisma as any).resellerPlanSubscription.update({
      where: { id: sub.id },
      data: {
        planId: targetPlan.id,
        status: "ACTIVE",
        startedAt: now,
        currentPeriodEnd: end,
        trialEndsAt: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        lastPaymentAt: now,
        snapshotJson: null,
      },
    });
  }

  static async handlePaymentFailed(reference: string) {
    const sub = await (prisma as any).resellerPlanSubscription.findFirst({
      where: { lastPaymentRef: reference },
      select: { resellerId: true },
    });
    if (!sub) return null;
    return this.abandonPendingCheckout(sub.resellerId, reference);
  }
}

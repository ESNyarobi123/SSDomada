import type { PaymentType } from "@prisma/client";
import { prisma } from "@/server/lib/prisma";
import { calculateRevenueSplit } from "@/server/utils";
import {
  SnippeService,
  type SnippeMobileProvider,
  type SnippeWebhookEvent,
} from "./snippe.service";
import { RadiusService } from "./radius.service";
import { OmadaService } from "./omada.service";
import { NotificationService } from "./notification.service";

/**
 * PaymentService — orchestrates Snippe checkout / direct STK push and
 * fans out the success path (wallet credit + RADIUS + Omada + notification).
 *
 * Two entry points used by the captive portal and reseller billing pages:
 *   - {@link initiateSession}   hosted checkout (reseller plan upgrades)
 *   - {@link initiateMobilePush} direct STK push (captive portal)
 *
 * Both eventually settle through {@link handleWebhook} which is invoked from
 * the central `/api/webhooks/snippe` route once Snippe pushes the event.
 */

interface BaseInitiateInput {
  userId: string;
  resellerId: string;
  packageId?: string;
  subscriptionId?: string;
  amount: number;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  paymentType: PaymentType;
  /** Identifier of the captive portal session — propagated via Snippe metadata. */
  portalSessionId?: string;
  /** MAC of the device that should be granted access after payment. */
  clientMac?: string;
}

interface InitiateSessionInput extends BaseInitiateInput {
  redirectUrl: string;
}

interface InitiateMobilePushInput extends BaseInitiateInput {
  provider: SnippeMobileProvider;
  phone: string;
}

export class PaymentService {
  /**
   * Create a Snippe hosted-checkout session.
   * Returns the `checkoutUrl` the customer should be redirected to.
   */
  static async initiateSession(input: InitiateSessionInput) {
    const reseller = await prisma.reseller.findUnique({
      where: { id: input.resellerId },
    });
    if (!reseller) throw new Error("Reseller not found");

    const { platformFee, resellerAmount } = calculateRevenueSplit(
      input.amount,
      reseller.commissionRate,
    );

    const idempotencyKey = SnippeService.generateIdempotencyKey("sess");

    const payment = await prisma.payment.create({
      data: {
        snippeReference: pendingReference(idempotencyKey),
        userId: input.userId,
        resellerId: input.resellerId,
        subscriptionId: input.subscriptionId,
        amount: input.amount,
        currency: reseller.currency,
        status: "PENDING",
        paymentType: input.paymentType,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        idempotencyKey,
        platformFee,
        resellerAmount,
      },
    });

    const snippe = await SnippeService.createSession(
      {
        amount: input.amount,
        currency: reseller.currency,
        description: `WiFi Package — ${reseller.companyName}`,
        customer: {
          name: input.customerName,
          phone: input.customerPhone,
          email: input.customerEmail,
        },
        redirectUrl: input.redirectUrl,
        webhookUrl: buildWebhookUrl(),
        metadata: buildMetadata({
          paymentId: payment.id,
          resellerId: input.resellerId,
          packageId: input.packageId,
          subscriptionId: input.subscriptionId,
          portalSessionId: input.portalSessionId,
          clientMac: input.clientMac,
        }),
      },
      idempotencyKey,
    );

    if (!snippe.success || !snippe.reference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      throw new Error(`Payment session failed: ${snippe.message || "unknown"}`);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { snippeReference: snippe.reference },
    });

    return {
      paymentId: payment.id,
      reference: snippe.reference,
      checkoutUrl: snippe.checkoutUrl,
      shortCode: snippe.shortCode,
    };
  }

  /**
   * Direct mobile-money push (STK / USSD prompt).
   * Used by the captive portal so the user stays on the same screen
   * and confirms on their phone.
   */
  static async initiateMobilePush(input: InitiateMobilePushInput) {
    const reseller = await prisma.reseller.findUnique({
      where: { id: input.resellerId },
    });
    if (!reseller) throw new Error("Reseller not found");
    if (!input.phone) throw new Error("Customer phone is required");

    const { platformFee, resellerAmount } = calculateRevenueSplit(
      input.amount,
      reseller.commissionRate,
    );

    const idempotencyKey = SnippeService.generateIdempotencyKey("mob");

    const payment = await prisma.payment.create({
      data: {
        snippeReference: pendingReference(idempotencyKey),
        userId: input.userId,
        resellerId: input.resellerId,
        subscriptionId: input.subscriptionId,
        amount: input.amount,
        currency: reseller.currency,
        status: "PENDING",
        paymentType: "MOBILE",
        customerPhone: input.phone,
        customerEmail: input.customerEmail,
        idempotencyKey,
        platformFee,
        resellerAmount,
      },
    });

    const snippe = await SnippeService.createPayment(
      {
        paymentType: "mobile",
        amount: input.amount,
        currency: reseller.currency,
        phone: input.phone,
        provider: input.provider,
        description: `WiFi Package — ${reseller.companyName}`,
        customer: {
          name: input.customerName,
          phone: input.phone,
          email: input.customerEmail,
        },
        webhookUrl: buildWebhookUrl(),
        metadata: buildMetadata({
          paymentId: payment.id,
          resellerId: input.resellerId,
          packageId: input.packageId,
          subscriptionId: input.subscriptionId,
          portalSessionId: input.portalSessionId,
          clientMac: input.clientMac,
        }),
      },
      idempotencyKey,
    );

    if (!snippe.success || !snippe.reference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      throw new Error(`Mobile push failed: ${snippe.message || "unknown"}`);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { snippeReference: snippe.reference },
    });

    return {
      paymentId: payment.id,
      reference: snippe.reference,
      status: snippe.status,
    };
  }

  /**
   * Settle a payment from a Snippe webhook event.
   *
   * Idempotent: subsequent invocations on a `COMPLETED` payment short-circuit.
   * Errors inside RADIUS / Omada / notification do **not** revert the
   * payment status — they're logged and can be re-issued via admin tools.
   */
  static async handleWebhook(event: SnippeWebhookEvent) {
    const reference = event.reference;
    const status = event.status?.toLowerCase();

    if (!reference) {
      console.warn("[Payment.handleWebhook] missing reference in event", event.id);
      return null;
    }

    const payment = await prisma.payment.findUnique({
      where: { snippeReference: reference },
    });

    if (!payment) {
      console.warn(`[Payment.handleWebhook] no payment for reference=${reference}`);
      return null;
    }

    if (payment.status === "COMPLETED") return payment;

    if (status === "completed") {
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          metadata: serialiseMetadata(event),
        },
      });

      await prisma.reseller.update({
        where: { id: payment.resellerId },
        data: {
          walletBalance: { increment: payment.resellerAmount },
          totalEarnings: { increment: payment.resellerAmount },
        },
      });

      const clientMac = event.metadata.clientMac || event.metadata.client_mac || "";
      const portalSessionId =
        event.metadata.portalSessionId || event.metadata.sessionId || "";

      if (clientMac && payment.subscriptionId) {
        await PaymentService.grantWifiAccess({
          paymentId: payment.id,
          resellerId: payment.resellerId,
          userId: payment.userId,
          subscriptionId: payment.subscriptionId,
          clientMac,
          portalSessionId,
        });
      }

      await PaymentService.notifyResellerOfPayment(payment).catch((err) => {
        console.error("[Notification] payment notify failed:", err);
      });

      return updated;
    }

    if (status === "failed" || status === "voided" || status === "expired") {
      // Snippe `voided` -> we have no CANCELLED enum so we treat it as FAILED.
      const next = status === "expired" ? "EXPIRED" : "FAILED";
      return prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: next as any,
          metadata: serialiseMetadata(event),
        },
      });
    }

    return payment;
  }

  // ---------------------------------------------------------------
  // Side-effects — granting access + notifying
  // ---------------------------------------------------------------

  private static async grantWifiAccess(opts: {
    paymentId: string;
    resellerId: string;
    userId: string;
    subscriptionId: string;
    clientMac: string;
    portalSessionId?: string;
  }) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: opts.subscriptionId },
        include: { package: true },
      });

      if (!subscription?.package) {
        console.warn(`[Payment] subscription/package missing for ${opts.subscriptionId}`);
        return;
      }

      const pkg = subscription.package;
      const sessionTimeoutSeconds = pkg.durationMinutes * 60;
      const expiresAt = subscription.expiresAt;

      const radiusUser = await RadiusService.createAccess({
        resellerId: opts.resellerId,
        userId: opts.userId,
        subscriptionId: opts.subscriptionId,
        clientMac: opts.clientMac,
        authMethod: "MAC",
        sessionTimeoutSeconds,
        expiresAt,
        dataLimitBytes: pkg.dataLimitMb
          ? BigInt(pkg.dataLimitMb) * BigInt(1024 * 1024)
          : undefined,
        bandwidthUpBps: pkg.speedLimitUp ? pkg.speedLimitUp * 1000 : undefined,
        bandwidthDownBps: pkg.speedLimitDown ? pkg.speedLimitDown * 1000 : undefined,
        maxSessions: pkg.maxDevices,
      });

      if (opts.portalSessionId) {
        await prisma.portalSession.update({
          where: { id: opts.portalSessionId },
          data: {
            status: "AUTHORIZED",
            radiusUserId: radiusUser.id,
            authorizedAt: new Date(),
            expiresAt,
          },
        }).catch((err) => {
          console.warn(`[Payment] failed to update portal session ${opts.portalSessionId}:`, err);
        });
      }

      try {
        const site = await prisma.site.findFirst({
          where: { resellerId: opts.resellerId, omadaSiteId: { not: null } },
          orderBy: { createdAt: "asc" },
        });
        if (site?.omadaSiteId) {
          await OmadaService.authorizeClient(site.omadaSiteId, opts.clientMac);
          console.log(`[Omada] Client authorized: MAC=${opts.clientMac} site=${site.omadaSiteId}`);
        }
      } catch (omadaErr) {
        console.error("[Omada] Failed to authorize client after payment:", omadaErr);
      }

      console.log(
        `[RADIUS] Access granted MAC=${opts.clientMac} expiresAt=${expiresAt.toISOString()} timeout=${sessionTimeoutSeconds}s`,
      );
    } catch (radiusError) {
      console.error("[RADIUS] Failed to create credentials after payment:", radiusError);
    }
  }

  private static async notifyResellerOfPayment(payment: {
    resellerId: string;
    amount: number;
    currency: string;
    customerPhone: string | null;
    subscriptionId: string | null;
  }) {
    let packageName: string | undefined;
    if (payment.subscriptionId) {
      const sub = await prisma.subscription.findUnique({
        where: { id: payment.subscriptionId },
        include: { package: { select: { name: true } } },
      });
      packageName = sub?.package?.name;
    }
    await NotificationService.notifyResellerPayment(payment.resellerId, {
      amount: payment.amount,
      currency: payment.currency,
      customerPhone: payment.customerPhone || undefined,
      packageName,
    });
  }

  // ---------------------------------------------------------------
  // Lookups used by dashboards
  // ---------------------------------------------------------------

  static async listByReseller(resellerId: string, page = 1, limit = 20) {
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { resellerId },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          subscription: { include: { package: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.count({ where: { resellerId } }),
    ]);
    return { payments, total, page, limit };
  }

  static async listAll(page = 1, limit = 20, status?: string) {
    const where = status ? ({ status: status as any }) : {};
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          reseller: { select: { companyName: true, brandSlug: true } },
          user: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.count({ where }),
    ]);
    return { payments, total, page, limit };
  }

  static async getRevenueStats(resellerId?: string) {
    const where = resellerId
      ? { resellerId, status: "COMPLETED" as const }
      : { status: "COMPLETED" as const };

    const [totalPayments, totalAmount, todayAmount] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where,
        _sum: { amount: true, platformFee: true, resellerAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          ...where,
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalPayments,
      totalAmount: totalAmount._sum.amount || 0,
      totalPlatformFee: totalAmount._sum.platformFee || 0,
      totalResellerEarnings: totalAmount._sum.resellerAmount || 0,
      todayAmount: todayAmount._sum.amount || 0,
    };
  }
}

// ============================================================
// Helpers (file-local)
// ============================================================

/** Snippe metadata only accepts strings — coerce values + drop empties. */
function buildMetadata(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v == null) continue;
    if (typeof v === "string") {
      if (v.length === 0) continue;
      out[k] = v;
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

function buildWebhookUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "")
    .trim()
    .replace(/\/+$/, "");
  return base ? `${base}/api/webhooks/snippe` : "/api/webhooks/snippe";
}

/** Marker stored in `Payment.snippeReference` before Snippe gives us the real one. */
function pendingReference(seed: string): string {
  return `pending_${seed}`.slice(0, 60);
}

function serialiseMetadata(event: SnippeWebhookEvent) {
  try {
    return JSON.parse(JSON.stringify(event.payload));
  } catch {
    return undefined;
  }
}

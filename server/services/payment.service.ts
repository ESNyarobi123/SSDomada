import { prisma } from "@/server/lib/prisma";
import { calculateRevenueSplit } from "@/server/utils";
import { SnippeService } from "./snippe.service";
import { RadiusService } from "./radius.service";
import { OmadaService } from "./omada.service";
import { NotificationService } from "./notification.service";
import type { PaymentType } from "@prisma/client";

// ============================================================
// PAYMENT SERVICE
// Handles payment creation via Snippe + webhook processing
// ============================================================

interface InitiatePaymentInput {
  userId: string;
  resellerId: string;
  packageId: string;
  amount: number;
  paymentType: PaymentType;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  callbackUrl: string; // Where to redirect after payment
}

export class PaymentService {
  /**
   * Initiate a payment via Snippe Payment Session (Hosted Checkout)
   * This is the primary flow for Captive Portal payments
   */
  static async initiateSession(input: InitiatePaymentInput) {
    // 1. Get reseller for commission calculation
    const reseller = await prisma.reseller.findUnique({
      where: { id: input.resellerId },
    });
    if (!reseller) throw new Error("Reseller not found");

    // 2. Calculate revenue split
    const { platformFee, resellerAmount } = calculateRevenueSplit(
      input.amount,
      reseller.commissionRate
    );

    // 3. Generate idempotency key
    const idempotencyKey = SnippeService.generateIdempotencyKey();

    // 4. Create payment record in DB (PENDING)
    const payment = await prisma.payment.create({
      data: {
        snippeReference: `pending_${idempotencyKey}`, // Temporary, updated after Snippe response
        userId: input.userId,
        resellerId: input.resellerId,
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

    // 5. Call Snippe API to create payment session
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/snippe`;

    const snippeResponse = await SnippeService.createPaymentSession({
      amount: input.amount,
      currency: reseller.currency,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      description: `WiFi Package - ${reseller.companyName}`,
      callbackUrl: input.callbackUrl,
      webhookUrl,
      metadata: {
        paymentId: payment.id,
        resellerId: input.resellerId,
        packageId: input.packageId,
      },
    }, idempotencyKey);

    if (!snippeResponse.success) {
      // Mark payment as failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      throw new Error(`Payment initiation failed: ${snippeResponse.message}`);
    }

    // 6. Update payment with Snippe reference
    await prisma.payment.update({
      where: { id: payment.id },
      data: { snippeReference: snippeResponse.reference },
    });

    return {
      paymentId: payment.id,
      checkoutUrl: snippeResponse.checkoutUrl,
      reference: snippeResponse.reference,
    };
  }

  /**
   * Initiate a Direct Mobile Money payment (STK Push)
   */
  static async initiateDirectMobile(input: InitiatePaymentInput & { provider: "airtel" | "mpesa" | "mixx" | "halotel" }) {
    const reseller = await prisma.reseller.findUnique({
      where: { id: input.resellerId },
    });
    if (!reseller) throw new Error("Reseller not found");
    if (!input.customerPhone) throw new Error("Customer phone is required for mobile payment");

    const { platformFee, resellerAmount } = calculateRevenueSplit(
      input.amount,
      reseller.commissionRate
    );

    const idempotencyKey = SnippeService.generateIdempotencyKey();

    const payment = await prisma.payment.create({
      data: {
        snippeReference: `pending_${idempotencyKey}`,
        userId: input.userId,
        resellerId: input.resellerId,
        amount: input.amount,
        currency: reseller.currency,
        status: "PENDING",
        paymentType: "MOBILE",
        customerPhone: input.customerPhone,
        idempotencyKey,
        platformFee,
        resellerAmount,
      },
    });

    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/snippe`;

    const snippeResponse = await SnippeService.createDirectPayment({
      amount: input.amount,
      currency: reseller.currency,
      phone: input.customerPhone,
      provider: input.provider,
      description: `WiFi Package - ${reseller.companyName}`,
      webhookUrl,
      metadata: {
        paymentId: payment.id,
        resellerId: input.resellerId,
        packageId: input.packageId,
      },
    }, idempotencyKey);

    if (!snippeResponse.success) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      throw new Error(`Direct payment failed: ${snippeResponse.message}`);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { snippeReference: snippeResponse.reference },
    });

    return {
      paymentId: payment.id,
      reference: snippeResponse.reference,
      status: snippeResponse.status,
    };
  }

  /**
   * Handle Snippe payment webhook (payment.completed / payment.failed / payment.expired)
   * This is called from the webhook route
   */
  static async handleWebhook(
    reference: string,
    status: string,
    webhookData?: Record<string, unknown>
  ) {
    const payment = await prisma.payment.findUnique({
      where: { snippeReference: reference },
    });

    if (!payment) throw new Error(`Payment not found: ${reference}`);
    if (payment.status === "COMPLETED") return payment; // Already processed (idempotent)

    if (status === "completed") {
      // Payment successful — credit reseller wallet
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          metadata: webhookData ? JSON.parse(JSON.stringify(webhookData)) : undefined,
        },
      });

      // Credit reseller wallet
      await prisma.reseller.update({
        where: { id: payment.resellerId },
        data: {
          walletBalance: { increment: payment.resellerAmount },
          totalEarnings: { increment: payment.resellerAmount },
        },
      });

      // ============================================================
      // RADIUS — Create WiFi access credentials after payment success
      // ============================================================
      try {
        const metadata = (webhookData?.metadata || {}) as Record<string, string>;
        const clientMac = metadata.clientMac;
        const sessionId = metadata.sessionId;

        if (clientMac && payment.subscriptionId) {
          // Get package for session timeout + bandwidth limits
          const subscription = await prisma.subscription.findUnique({
            where: { id: payment.subscriptionId },
            include: { package: true },
          });

          if (subscription?.package) {
            const pkg = subscription.package;
            const sessionTimeoutSeconds = pkg.durationMinutes * 60;
            const expiresAt = subscription.expiresAt;

            // Create RADIUS credentials — client can now authenticate
            const radiusUser = await RadiusService.createAccess({
              resellerId: payment.resellerId,
              userId: payment.userId,
              subscriptionId: payment.subscriptionId,
              clientMac,
              authMethod: "MAC",
              sessionTimeoutSeconds,
              expiresAt,
              dataLimitBytes: pkg.dataLimitMb ? BigInt(pkg.dataLimitMb) * BigInt(1024 * 1024) : undefined,
              bandwidthUpBps: pkg.speedLimitUp ? pkg.speedLimitUp * 1000 : undefined, // kbps → bps
              bandwidthDownBps: pkg.speedLimitDown ? pkg.speedLimitDown * 1000 : undefined,
              maxSessions: pkg.maxDevices,
            });

            // Update portal session to AUTHORIZED
            if (sessionId) {
              await prisma.portalSession.update({
                where: { id: sessionId },
                data: {
                  status: "AUTHORIZED",
                  radiusUserId: radiusUser.id,
                  authorizedAt: new Date(),
                  expiresAt,
                },
              });
            }

            console.log(`[RADIUS] Access granted: MAC=${clientMac}, expires=${expiresAt.toISOString()}, timeout=${sessionTimeoutSeconds}s`);

            // ============================================================
            // OMADA — also authorize MAC on the controller (dual path for built-in portal)
            // ============================================================
            try {
              // Find the reseller's primary linked Omada site
              const site = await prisma.site.findFirst({
                where: { resellerId: payment.resellerId, omadaSiteId: { not: null } },
                orderBy: { createdAt: "asc" },
              });
              if (site?.omadaSiteId) {
                await OmadaService.authorizeClient(site.omadaSiteId, clientMac);
                console.log(`[Omada] Client authorized: MAC=${clientMac} site=${site.omadaSiteId}`);
              }
            } catch (omadaErr) {
              console.error("[Omada] Failed to authorize client after payment:", omadaErr);
            }
          }
        }
      } catch (radiusError) {
        // Log but don't fail the payment — RADIUS can be retried
        console.error("[RADIUS] Failed to create credentials after payment:", radiusError);
      }

      // Notify reseller (best-effort, non-blocking)
      try {
        const pkgName = (updated as any).subscription?.package?.name;
        await NotificationService.notifyResellerPayment(payment.resellerId, {
          amount: payment.amount,
          currency: payment.currency,
          customerPhone: payment.customerPhone || undefined,
          packageName: pkgName,
        });
      } catch (notifyErr) {
        console.error("[Notification] payment notify failed:", notifyErr);
      }

      return updated;
    } else if (status === "failed") {
      return prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", metadata: webhookData ? JSON.parse(JSON.stringify(webhookData)) : undefined },
      });
    } else if (status === "expired") {
      return prisma.payment.update({
        where: { id: payment.id },
        data: { status: "EXPIRED", metadata: webhookData ? JSON.parse(JSON.stringify(webhookData)) : undefined },
      });
    }

    return payment;
  }

  /**
   * Request a withdrawal (Reseller dashboard)
   */
  static async requestWithdrawal(data: {
    resellerId: string;
    amount: number;
    channel: "MOBILE" | "BANK";
    recipientPhone?: string;
    recipientAccount?: string;
    recipientBank?: string;
    recipientName: string;
  }) {
    const reseller = await prisma.reseller.findUnique({
      where: { id: data.resellerId },
    });

    if (!reseller) throw new Error("Reseller not found");
    if (reseller.walletBalance < data.amount) throw new Error("Insufficient balance");

    // Validate required fields based on channel
    if (data.channel === "MOBILE" && !data.recipientPhone) {
      throw new Error("Phone number is required for mobile withdrawal");
    }
    if (data.channel === "BANK" && (!data.recipientAccount || !data.recipientBank)) {
      throw new Error("Account number and bank are required for bank withdrawal");
    }

    // Deduct from wallet and create withdrawal request
    const [withdrawal] = await prisma.$transaction([
      prisma.withdrawal.create({
        data: {
          resellerId: data.resellerId,
          amount: data.amount,
          currency: reseller.currency,
          channel: data.channel,
          recipientPhone: data.recipientPhone,
          recipientAccount: data.recipientAccount,
          recipientBank: data.recipientBank,
          recipientName: data.recipientName,
        },
      }),
      prisma.reseller.update({
        where: { id: data.resellerId },
        data: { walletBalance: { decrement: data.amount } },
      }),
    ]);

    return withdrawal;
  }

  /**
   * List payments for a reseller
   */
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

  /**
   * List all payments (Super Admin)
   */
  static async listAll(page = 1, limit = 20, status?: string) {
    const where = status ? { status: status as any } : {};

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

  /**
   * Get revenue stats for dashboard
   */
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

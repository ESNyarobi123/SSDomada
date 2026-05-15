import { prisma } from "@/server/lib/prisma";
import { getPortalPublicBaseUrl } from "@/server/lib/public-app-base-url";
import {
  SnippeService,
  type SnippeWebhookEvent,
} from "./snippe.service";

/**
 * PayoutService
 *
 * Owns the *reseller withdrawal* lifecycle:
 *
 *   reseller requests withdrawal
 *     → admin approves (route layer)
 *     → admin processes (this service)  → POST /v1/payouts/send to Snippe
 *     → Snippe webhook returns          → handlePayoutWebhook here
 *
 * Wallet semantics:
 *   - Amount is **already** deducted from the wallet at request time
 *     (see app/api/v1/reseller/withdrawals POST).
 *   - On Snippe success (webhook): nothing else to do for the wallet.
 *   - On Snippe failure / reversal: we refund the wallet.
 */
export class PayoutService {
  /** Process an approved withdrawal — issues the disbursement through Snippe. */
  static async processWithdrawal(withdrawalId: string) {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { reseller: true },
    });

    if (!withdrawal) throw new Error("Withdrawal not found");
    if (withdrawal.status !== "APPROVED") {
      throw new Error("Withdrawal must be approved before processing");
    }

    const idempotencyKey = SnippeService.generateIdempotencyKey("po");
    const webhookUrl = buildWebhookUrl();
    const narration = `SSDomada withdrawal — ${withdrawal.reseller.companyName}`;

    if (withdrawal.channel === "MOBILE") {
      if (!withdrawal.recipientPhone) {
        throw new Error("Recipient phone number is required for mobile payout");
      }
    } else if (!withdrawal.recipientAccount || !withdrawal.recipientBank) {
      throw new Error("Account number and bank are required for bank payout");
    }

    const snippe = await SnippeService.createPayout(
      {
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        channel: withdrawal.channel === "MOBILE" ? "mobile" : "bank",
        recipientPhone: withdrawal.recipientPhone || undefined,
        recipientAccount: withdrawal.recipientAccount || undefined,
        recipientBank: withdrawal.recipientBank || undefined,
        recipientName: withdrawal.recipientName,
        narration,
        webhookUrl,
        metadata: {
          withdrawalId: withdrawal.id,
          resellerId: withdrawal.resellerId,
        },
      },
      idempotencyKey,
    );

    if (!snippe.success || !snippe.reference) {
      // Snippe rejected the request — refund wallet & mark rejected.
      await prisma.$transaction([
        prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: "REJECTED",
            adminNote: `Payout failed: ${snippe.message || "unknown"}`.slice(0, 500),
          },
        }),
        prisma.reseller.update({
          where: { id: withdrawal.resellerId },
          data: { walletBalance: { increment: withdrawal.amount } },
        }),
      ]);
      throw new Error(`Payout failed: ${snippe.message || "unknown"}`);
    }

    const payout = await prisma.payout.create({
      data: {
        snippeReference: snippe.reference,
        resellerId: withdrawal.resellerId,
        withdrawalId: withdrawal.id,
        amount: withdrawal.amount,
        fee: snippe.fee,
        total: snippe.total || withdrawal.amount + snippe.fee,
        channel: withdrawal.channel,
        recipientPhone: withdrawal.recipientPhone,
        recipientAccount: withdrawal.recipientAccount,
        recipientBank: withdrawal.recipientBank,
        recipientName: withdrawal.recipientName,
        status: "PENDING",
        narration,
        idempotencyKey,
      },
    });

    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: "PROCESSING" },
    });

    return payout;
  }

  /**
   * Handle the Snippe webhook for a payout event.
   * Idempotent: re-deliveries of the same status are no-ops.
   */
  static async handlePayoutWebhook(event: SnippeWebhookEvent) {
    const reference = event.reference;
    const status = event.status?.toLowerCase();

    const payout = await prisma.payout.findUnique({
      where: { snippeReference: reference },
      include: { withdrawal: true },
    });

    if (!payout) {
      console.warn(`[Payout.handleWebhook] no payout for reference=${reference}`);
      return null;
    }

    // Already settled — short-circuit.
    if (
      (payout.status === "COMPLETED" && status === "completed") ||
      (payout.status === "FAILED" && status === "failed") ||
      (payout.status === "REVERSED" && status === "reversed")
    ) {
      return payout;
    }

    const metadata = serialiseMetadata(event);

    if (status === "completed") {
      await prisma.$transaction([
        prisma.payout.update({
          where: { id: payout.id },
          data: { status: "COMPLETED", completedAt: new Date(), metadata },
        }),
        ...(payout.withdrawalId
          ? [
              prisma.withdrawal.update({
                where: { id: payout.withdrawalId },
                data: { status: "COMPLETED", processedAt: new Date() },
              }),
            ]
          : []),
      ]);
      return prisma.payout.findUnique({ where: { id: payout.id } });
    }

    if (status === "failed" || status === "reversed") {
      const nextPayoutStatus = status === "reversed" ? "REVERSED" : "FAILED";
      const reason = event.failureReason || `Payout ${status}`;
      await prisma.$transaction([
        prisma.payout.update({
          where: { id: payout.id },
          data: { status: nextPayoutStatus, metadata },
        }),
        ...(payout.withdrawalId
          ? [
              prisma.withdrawal.update({
                where: { id: payout.withdrawalId },
                data: {
                  status: "REJECTED",
                  adminNote: reason.slice(0, 500),
                },
              }),
            ]
          : []),
        prisma.reseller.update({
          where: { id: payout.resellerId },
          data: { walletBalance: { increment: payout.amount } },
        }),
      ]);
      return prisma.payout.findUnique({ where: { id: payout.id } });
    }

    return payout;
  }

  // ---------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------

  static async listByReseller(resellerId: string, page = 1, limit = 20) {
    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: { resellerId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.payout.count({ where: { resellerId } }),
    ]);
    return { payouts, total, page, limit };
  }

  static async listAll(page = 1, limit = 20, status?: string) {
    const where = status ? ({ status: status as any }) : {};
    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          reseller: { select: { companyName: true, brandSlug: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payout.count({ where }),
    ]);
    return { payouts, total, page, limit };
  }
}

// ============================================================
// Helpers
// ============================================================

function buildWebhookUrl(): string {
  const base = getPortalPublicBaseUrl();
  return base ? `${base}/api/webhooks/snippe` : "/api/webhooks/snippe";
}

function serialiseMetadata(event: SnippeWebhookEvent) {
  try {
    return JSON.parse(JSON.stringify(event.payload));
  } catch {
    return undefined;
  }
}

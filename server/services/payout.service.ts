import { prisma } from "@/server/lib/prisma";
import { SnippeService } from "./snippe.service";

// ============================================================
// PAYOUT SERVICE
// Handles reseller withdrawal processing via Snippe Payouts API
// ============================================================

export class PayoutService {
  /**
   * Process a withdrawal request — sends payout via Snippe
   * Called by Super Admin (manual) or automated after approval
   */
  static async processWithdrawal(withdrawalId: string) {
    // 1. Get withdrawal details
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { reseller: true },
    });

    if (!withdrawal) throw new Error("Withdrawal not found");
    if (withdrawal.status !== "APPROVED") {
      throw new Error("Withdrawal must be approved before processing");
    }

    // 2. Generate idempotency key
    const idempotencyKey = SnippeService.generateIdempotencyKey();

    // 3. Send payout via Snippe based on channel
    let snippeResponse;

    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/snippe`;

    if (withdrawal.channel === "MOBILE") {
      if (!withdrawal.recipientPhone) {
        throw new Error("Recipient phone number is required for mobile payout");
      }

      snippeResponse = await SnippeService.createMobilePayout({
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        channel: "mobile",
        recipientPhone: withdrawal.recipientPhone,
        recipientName: withdrawal.recipientName,
        narration: `SSDomada withdrawal - ${withdrawal.reseller.companyName}`,
        webhookUrl,
        metadata: {
          withdrawalId: withdrawal.id,
          resellerId: withdrawal.resellerId,
        },
      }, idempotencyKey);
    } else {
      // BANK payout
      if (!withdrawal.recipientAccount || !withdrawal.recipientBank) {
        throw new Error("Bank account and bank name are required for bank payout");
      }

      snippeResponse = await SnippeService.createBankPayout({
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        channel: "bank",
        recipientAccount: withdrawal.recipientAccount,
        recipientBank: withdrawal.recipientBank,
        recipientName: withdrawal.recipientName,
        narration: `SSDomada withdrawal - ${withdrawal.reseller.companyName}`,
        webhookUrl,
        metadata: {
          withdrawalId: withdrawal.id,
          resellerId: withdrawal.resellerId,
        },
      }, idempotencyKey);
    }

    // 4. Handle Snippe response
    if (!snippeResponse.success) {
      // Mark withdrawal as failed, refund wallet
      await prisma.$transaction([
        prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: { status: "REJECTED", adminNote: `Payout failed: ${snippeResponse.message}` },
        }),
        prisma.reseller.update({
          where: { id: withdrawal.resellerId },
          data: { walletBalance: { increment: withdrawal.amount } },
        }),
      ]);

      throw new Error(`Payout failed: ${snippeResponse.message}`);
    }

    // 5. Create Payout record and update withdrawal status
    const payout = await prisma.payout.create({
      data: {
        snippeReference: snippeResponse.reference,
        resellerId: withdrawal.resellerId,
        withdrawalId: withdrawal.id,
        amount: withdrawal.amount,
        fee: snippeResponse.fee,
        total: snippeResponse.total,
        channel: withdrawal.channel,
        recipientPhone: withdrawal.recipientPhone,
        recipientAccount: withdrawal.recipientAccount,
        recipientBank: withdrawal.recipientBank,
        recipientName: withdrawal.recipientName,
        status: "PENDING",
        narration: `SSDomada withdrawal - ${withdrawal.reseller.companyName}`,
        idempotencyKey,
      },
    });

    // Update withdrawal to PROCESSING
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: "PROCESSING" },
    });

    return payout;
  }

  /**
   * Handle Snippe payout webhook (payout.completed / payout.failed)
   */
  static async handlePayoutWebhook(reference: string, status: string, metadata?: Record<string, string>) {
    const payout = await prisma.payout.findUnique({
      where: { snippeReference: reference },
      include: { withdrawal: true },
    });

    if (!payout) throw new Error(`Payout not found: ${reference}`);
    if (payout.status === "COMPLETED") return payout; // Already processed

    if (status === "completed") {
      // Payout successful
      await prisma.$transaction([
        prisma.payout.update({
          where: { id: payout.id },
          data: { status: "COMPLETED", completedAt: new Date(), metadata },
        }),
        ...(payout.withdrawalId ? [
          prisma.withdrawal.update({
            where: { id: payout.withdrawalId },
            data: { status: "COMPLETED", processedAt: new Date() },
          }),
        ] : []),
      ]);
    } else if (status === "failed" || status === "reversed") {
      // Payout failed — refund reseller wallet
      await prisma.$transaction([
        prisma.payout.update({
          where: { id: payout.id },
          data: { status: status === "reversed" ? "REVERSED" : "FAILED", metadata },
        }),
        ...(payout.withdrawalId ? [
          prisma.withdrawal.update({
            where: { id: payout.withdrawalId },
            data: { status: "REJECTED", adminNote: `Payout ${status}` },
          }),
        ] : []),
        prisma.reseller.update({
          where: { id: payout.resellerId },
          data: { walletBalance: { increment: payout.amount } },
        }),
      ]);
    }

    return payout;
  }

  /**
   * List payouts for a reseller
   */
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

  /**
   * List all payouts (Super Admin)
   */
  static async listAll(page = 1, limit = 20, status?: string) {
    const where = status ? { status: status as any } : {};

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

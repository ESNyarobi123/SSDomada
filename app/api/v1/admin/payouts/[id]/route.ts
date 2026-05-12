import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { processWithdrawalSchema } from "@/lib/validations/admin";
import { PayoutService } from "@/server/services/payout.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/payouts/[id]
 * Get withdrawal details with payout info.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        reseller: {
          select: {
            id: true,
            companyName: true,
            brandSlug: true,
            walletBalance: true,
            totalEarnings: true,
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        payout: true,
      },
    });

    if (!withdrawal) return apiError("Withdrawal not found", 404, "NOT_FOUND");

    return apiSuccess(withdrawal);
  } catch (error) {
    console.error("[Admin Payout GET] Error:", error);
    return apiError("Failed to fetch withdrawal", 500);
  }
}

/**
 * PATCH /api/v1/admin/payouts/[id]
 * Approve, reject, or process a withdrawal request.
 * Actions:
 *   - approve: Mark as approved (ready for processing)
 *   - reject: Reject and refund wallet
 *   - process: Trigger Snippe payout (must be approved first)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const body = await req.json();
    const { action, adminNote } = processWithdrawalSchema.parse(body);

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: { reseller: true },
    });

    if (!withdrawal) return apiError("Withdrawal not found", 404, "NOT_FOUND");

    // === APPROVE ===
    if (action === "approve") {
      if (withdrawal.status !== "PENDING") {
        return apiError(`Cannot approve a ${withdrawal.status.toLowerCase()} withdrawal`, 400, "INVALID_STATUS");
      }

      await prisma.withdrawal.update({
        where: { id },
        data: { status: "APPROVED", adminNote },
      });

      await logAdminAction(admin.userId, "withdrawal.approved", "Withdrawal", id, { amount: withdrawal.amount }, getClientIp(req));

      return apiSuccess({ id, status: "APPROVED", message: "Withdrawal approved. Ready for processing." });
    }

    // === REJECT ===
    if (action === "reject") {
      if (!["PENDING", "APPROVED"].includes(withdrawal.status)) {
        return apiError(`Cannot reject a ${withdrawal.status.toLowerCase()} withdrawal`, 400, "INVALID_STATUS");
      }

      // Refund wallet
      await prisma.$transaction([
        prisma.withdrawal.update({
          where: { id },
          data: { status: "REJECTED", adminNote: adminNote || "Rejected by admin" },
        }),
        prisma.reseller.update({
          where: { id: withdrawal.resellerId },
          data: { walletBalance: { increment: withdrawal.amount } },
        }),
      ]);

      await logAdminAction(admin.userId, "withdrawal.rejected", "Withdrawal", id, { amount: withdrawal.amount, reason: adminNote }, getClientIp(req));

      return apiSuccess({ id, status: "REJECTED", message: "Withdrawal rejected. Amount refunded to reseller wallet." });
    }

    // === PROCESS (trigger Snippe payout) ===
    if (action === "process") {
      if (withdrawal.status !== "APPROVED") {
        return apiError("Withdrawal must be approved before processing", 400, "INVALID_STATUS");
      }

      const payout = await PayoutService.processWithdrawal(id);

      await logAdminAction(admin.userId, "withdrawal.processed", "Withdrawal", id, {
        amount: withdrawal.amount,
        snippeReference: payout.snippeReference,
        channel: payout.channel,
      }, getClientIp(req));

      return apiSuccess({
        id,
        status: "PROCESSING",
        payout: {
          id: payout.id,
          snippeReference: payout.snippeReference,
          amount: payout.amount,
          fee: payout.fee,
          total: payout.total,
          channel: payout.channel,
        },
        message: "Payout initiated via Snippe. Awaiting confirmation.",
      });
    }

    return apiError("Invalid action", 400, "INVALID_ACTION");
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed", 422, "VALIDATION_ERROR");
    }
    console.error("[Admin Payout PATCH] Error:", error);
    return apiError(error.message || "Failed to process withdrawal", 500);
  }
}

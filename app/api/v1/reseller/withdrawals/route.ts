import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { paginationSchema, requestWithdrawalSchema } from "@/lib/validations/reseller";

/**
 * GET /api/v1/reseller/withdrawals
 * View withdrawal history and available balance.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const status = searchParams.get("status") || undefined;

    const where: Record<string, unknown> = { resellerId: ctx.resellerId };
    if (status) (where as any).status = status;

    const [withdrawals, total, reseller, summary] = await Promise.all([
      prisma.withdrawal.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          payout: {
            select: { id: true, snippeReference: true, status: true, channel: true, completedAt: true },
          },
        },
      }),
      prisma.withdrawal.count({ where: where as any }),
      prisma.reseller.findUnique({
        where: { id: ctx.resellerId },
        select: { walletBalance: true, totalEarnings: true, currency: true },
      }),
      prisma.withdrawal.aggregate({
        where: { resellerId: ctx.resellerId, status: "COMPLETED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return apiSuccess(
      {
        withdrawals,
        wallet: {
          availableBalance: reseller?.walletBalance || 0,
          totalEarnings: reseller?.totalEarnings || 0,
          totalWithdrawn: summary._sum?.amount || 0,
          totalWithdrawals: summary._count,
          currency: reseller?.currency || "TZS",
        },
      },
      { page, limit, total }
    );
  } catch (error) {
    console.error("[Reseller Withdrawals GET] Error:", error);
    return apiError("Failed to fetch withdrawals", 500);
  }
}

/**
 * POST /api/v1/reseller/withdrawals
 * Request a new withdrawal (Mobile Money or Bank Transfer).
 * Validates available balance before creating request.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const validated = requestWithdrawalSchema.parse(body);

    // Get current balance
    const reseller = await prisma.reseller.findUnique({
      where: { id: ctx.resellerId },
      select: { walletBalance: true, currency: true },
    });

    if (!reseller) return apiError("Reseller not found", 404);

    // Check sufficient balance
    if (reseller.walletBalance < validated.amount) {
      return apiError(
        `Insufficient balance. Available: ${reseller.walletBalance} ${reseller.currency}, Requested: ${validated.amount} ${reseller.currency}`,
        400,
        "INSUFFICIENT_BALANCE"
      );
    }

    // Check for existing pending withdrawal
    const pendingExists = await prisma.withdrawal.findFirst({
      where: { resellerId: ctx.resellerId, status: { in: ["PENDING", "APPROVED", "PROCESSING"] } },
    });

    if (pendingExists) {
      return apiError("You already have a pending withdrawal request. Wait for it to be processed.", 409, "PENDING_EXISTS");
    }

    // Create withdrawal and deduct from wallet atomically
    const withdrawal = await prisma.$transaction(async (tx) => {
      // Deduct from wallet
      await tx.reseller.update({
        where: { id: ctx.resellerId },
        data: { walletBalance: { decrement: validated.amount } },
      });

      // Create withdrawal request
      return tx.withdrawal.create({
        data: {
          resellerId: ctx.resellerId,
          amount: validated.amount,
          currency: reseller.currency,
          channel: validated.channel,
          recipientPhone: validated.recipientPhone,
          recipientAccount: validated.recipientAccount,
          recipientBank: validated.recipientBank,
          recipientName: validated.recipientName,
        },
      });
    });

    await logResellerAction(ctx.userId, "withdrawal.requested", "Withdrawal", withdrawal.id, {
      amount: validated.amount,
      channel: validated.channel,
    }, getClientIp(req));

    return apiSuccess({
      withdrawal,
      message: "Withdrawal request submitted. You will be notified when processed.",
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors?.map((e: any) => e.message).join(", "), 422);
    }
    console.error("[Reseller Withdrawals POST] Error:", error);
    return apiError(error.message || "Failed to request withdrawal", 500);
  }
}

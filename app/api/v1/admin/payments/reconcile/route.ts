import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import {
  verifyAdmin,
  apiSuccess,
  apiError,
  logAdminAction,
  getClientIp,
} from "@/server/middleware/admin-auth";
import { PaymentService } from "@/server/services/payment.service";

/**
 * POST /api/v1/admin/payments/reconcile
 *
 * Emergency reconciliation endpoint. Pulls the live state from Snippe for a
 * payment and applies it locally. Use when a webhook was rejected or missed
 * (e.g. signature drift) and the customer is stuck waiting for authorization.
 *
 * Body:
 *   { reference: string }  // Snippe reference (e.g. "SN17788...") OR local Payment.id
 *
 * Idempotent — safe to invoke multiple times. See `PaymentService.reconcileFromSnippe`.
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  let payload: { reference?: string } = {};
  try {
    payload = (await req.json()) as { reference?: string };
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const reference = payload.reference?.trim();
  if (!reference) return apiError("`reference` is required", 400);

  const payment = await prisma.payment.findFirst({
    where: { OR: [{ id: reference }, { snippeReference: reference }] },
    select: {
      id: true,
      snippeReference: true,
      status: true,
      amount: true,
      currency: true,
      resellerId: true,
    },
  });

  if (!payment) return apiError("Payment not found", 404);

  const before = payment.status;
  const updated = await PaymentService.reconcileFromSnippe(payment.id);

  await logAdminAction(
    admin.userId,
    "payment.reconcile",
    "Payment",
    payment.id,
    {
      reference: payment.snippeReference,
      before,
      after: updated?.status ?? before,
    },
    getClientIp(req),
  );

  return apiSuccess({
    paymentId: payment.id,
    reference: payment.snippeReference,
    before,
    after: updated?.status ?? before,
  });
}

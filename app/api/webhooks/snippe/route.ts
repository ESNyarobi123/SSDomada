import { NextRequest, NextResponse } from "next/server";
import { SnippeService } from "@/server/services/snippe.service";
import { PaymentService } from "@/server/services/payment.service";
import { PayoutService } from "@/server/services/payout.service";
import { ResellerPlanService } from "@/server/services/reseller-plan.service";

// Snippe expects fast responses (< 30s) and retries on non-2xx.
// We process the event before returning, but the work is small and idempotent.
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/snippe
 *
 * Receives Snippe payment + payout events.
 *
 * Security:
 *   - Verifies HMAC-SHA256 over `{X-Webhook-Timestamp}.{raw_body}` using
 *     SNIPPE_WEBHOOK_SECRET (constant-time comparison + replay protection).
 *
 * Routing:
 *   - `payment.*`  → ResellerPlanService when `metadata.type == "reseller_plan"`,
 *                    otherwise → PaymentService.
 *   - `payout.*`   → PayoutService.
 *
 * Idempotency:
 *   - Every service short-circuits on already-final records, so safe to retry.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");

  const verification = SnippeService.verifyWebhookSignature(rawBody, signature, timestamp);
  if (!verification.ok) {
    console.error(`[Snippe Webhook] signature rejected: ${verification.reason}`);
    return NextResponse.json(
      { error: "Invalid signature", reason: verification.reason },
      { status: 401 },
    );
  }

  const event = SnippeService.parseWebhookEvent(rawBody);
  if (!event) {
    return NextResponse.json({ error: "Unparseable webhook body" }, { status: 400 });
  }

  console.log(
    `[Snippe Webhook] type=${event.type} ref=${event.reference} status=${event.status}`,
  );

  try {
    const family = event.type.split(".")[0];
    const isResellerPlan = event.metadata.type === "reseller_plan";

    if (family === "payment") {
      if (event.type === "payment.completed") {
        if (isResellerPlan) {
          await ResellerPlanService.handlePaymentCompleted(event.reference);
        } else {
          await PaymentService.handleWebhook(event);
        }
      } else if (
        event.type === "payment.failed" ||
        event.type === "payment.voided" ||
        event.type === "payment.expired"
      ) {
        if (!isResellerPlan) {
          // For reseller plans: subscription stays PAST_DUE until paid; surfaced in UI.
          await PaymentService.handleWebhook(event);
        }
      } else {
        console.warn(`[Snippe Webhook] unknown payment event: ${event.type}`);
      }
    } else if (family === "payout") {
      if (
        event.type === "payout.completed" ||
        event.type === "payout.failed" ||
        event.type === "payout.reversed"
      ) {
        await PayoutService.handlePayoutWebhook(event);
      } else {
        console.warn(`[Snippe Webhook] unknown payout event: ${event.type}`);
      }
    } else {
      console.warn(`[Snippe Webhook] ignoring unknown family=${family} type=${event.type}`);
    }
  } catch (error) {
    // Return 200 so Snippe stops retrying on our internal mistakes — we'd rather
    // surface the error in logs / admin tooling than block the merchant queue.
    console.error("[Snippe Webhook] processing error:", error);
    return NextResponse.json({ received: true, processed: false });
  }

  return NextResponse.json({ received: true, processed: true });
}

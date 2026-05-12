import { NextRequest, NextResponse } from "next/server";
import { SnippeService } from "@/server/services/snippe.service";
import { PaymentService } from "@/server/services/payment.service";
import { PayoutService } from "@/server/services/payout.service";
import { ResellerPlanService } from "@/server/services/reseller-plan.service";

// ============================================================
// POST /api/webhooks/snippe
// Handles all Snippe webhooks: payment.completed, payout.completed, etc.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Get raw body and signature for verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-snippe-signature") || "";

    // 2. Verify webhook signature
    const isValid = SnippeService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error("[Webhook] Invalid Snippe signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Parse the webhook payload
    const payload = JSON.parse(rawBody);
    const { event, reference, status } = payload;

    console.log(`[Webhook] Received: ${event} | ref: ${reference} | status: ${status}`);

    // 4. Route to appropriate handler
    const isResellerPlan = payload?.metadata?.type === "reseller_plan";

    switch (event) {
      case "payment.completed":
        if (isResellerPlan) {
          await ResellerPlanService.handlePaymentCompleted(reference);
        } else {
          await PaymentService.handleWebhook(reference, status, payload);
        }
        break;
      case "payment.failed":
      case "payment.expired":
        // Reseller-plan failures leave the subscription PAST_DUE — surface via UI
        if (!isResellerPlan) {
          await PaymentService.handleWebhook(reference, status, payload);
        }
        break;

      case "payout.completed":
      case "payout.failed":
      case "payout.reversed":
        await PayoutService.handlePayoutWebhook(reference, status, payload);
        break;

      default:
        console.warn(`[Webhook] Unknown event: ${event}`);
    }

    // 5. Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing:", error);
    // Still return 200 to prevent Snippe from retrying on our errors
    return NextResponse.json({ received: true, error: "Processing error" });
  }
}

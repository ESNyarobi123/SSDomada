import { NextResponse } from "next/server";
import { ResellerPlanService } from "@/server/services/reseller-plan.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/plans
 * Public — list SSDomada pricing tiers for the marketing/pricing page.
 */
export async function GET() {
  try {
    const plans = await ResellerPlanService.listPublicPlans();
    return NextResponse.json({ success: true, data: plans });
  } catch (err) {
    console.error("[Plans GET] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to load plans" }, { status: 500 });
  }
}

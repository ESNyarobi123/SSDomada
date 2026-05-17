import { NextRequest } from "next/server";
import { verifyReseller, apiSuccess, apiError } from "@/server/middleware/reseller-auth";
import {
  dismissResellerSetupGuide,
  getResellerSetupGuide,
} from "@/server/services/reseller-setup-guide.service";

/**
 * GET /api/v1/reseller/onboarding
 * Setup guide progress for new resellers.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const guide = await getResellerSetupGuide(ctx.resellerId);
    return apiSuccess({ guide });
  } catch (e) {
    console.error("[Reseller onboarding GET]", e);
    return apiError("Failed to load setup guide", 500);
  }
}

/**
 * POST /api/v1/reseller/onboarding
 * Body: { action: "dismiss" }
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = (await req.json()) as { action?: string };
    if (body.action === "dismiss") {
      await dismissResellerSetupGuide(ctx.resellerId);
      const guide = await getResellerSetupGuide(ctx.resellerId);
      return apiSuccess({ guide });
    }
    return apiError("Unknown action", 400);
  } catch (e) {
    console.error("[Reseller onboarding POST]", e);
    return apiError("Failed to update setup guide", 500);
  }
}

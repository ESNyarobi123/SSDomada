import { NextRequest, NextResponse } from "next/server";
import { resellerSwaggerSpec } from "@/lib/swagger-reseller";
import { verifyReseller } from "@/server/middleware/reseller-auth";
import { checkFeatureAccess } from "@/server/services/reseller-plan-access.service";

/**
 * GET /api/v1/reseller/docs
 * Returns the OpenAPI/Swagger JSON specification for Reseller APIs.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const featureGate = await checkFeatureAccess(ctx.resellerId, "apiAccess");
  if (!featureGate.ok) {
    return NextResponse.json(
      { success: false, error: featureGate.message, code: featureGate.code },
      { status: featureGate.statusCode },
    );
  }

  return NextResponse.json(resellerSwaggerSpec);
}

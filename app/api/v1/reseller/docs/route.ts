import { NextResponse } from "next/server";
import { resellerSwaggerSpec } from "@/lib/swagger-reseller";

/**
 * GET /api/v1/reseller/docs
 * Returns the OpenAPI/Swagger JSON specification for Reseller APIs.
 */
export async function GET() {
  return NextResponse.json(resellerSwaggerSpec);
}

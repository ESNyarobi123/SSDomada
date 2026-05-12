import { NextResponse } from "next/server";
import { swaggerSpec } from "@/lib/swagger";

/**
 * GET /api/v1/admin/docs
 * Returns the OpenAPI/Swagger JSON specification.
 * Use this with Swagger UI or any API testing tool (Postman, Insomnia).
 */
export async function GET() {
  return NextResponse.json(swaggerSpec);
}

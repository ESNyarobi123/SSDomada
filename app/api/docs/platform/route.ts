import { NextResponse } from "next/server";
import { platformSwaggerSpec } from "@/lib/swagger-platform";

export async function GET() {
  return NextResponse.json(platformSwaggerSpec);
}

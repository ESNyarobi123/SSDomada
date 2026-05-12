import { NextRequest, NextResponse } from "next/server";

/**
 * DEPRECATED — this stub has been replaced by:
 *   GET  /api/portal/[slug]              (portal config + packages)
 *   POST /api/portal/[slug]/pay          (start payment)
 *   GET  /api/portal/[slug]/status       (poll authorization status)
 *
 * Keeping this route to return a clear 410 Gone with a hint, so any old
 * clients fail fast and migrate.
 */
function gone(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand") || searchParams.get("slug");
  const hint = brand
    ? `/api/portal/${brand}`
    : "/api/portal/{brandSlug}";
  return NextResponse.json(
    {
      success: false,
      error: "This endpoint has been removed. Use the new portal API.",
      newEndpoint: hint,
      code: "GONE",
    },
    { status: 410 }
  );
}

export const GET = gone;
export const POST = gone;

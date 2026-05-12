import { NextRequest, NextResponse } from "next/server";
import { RadiusService } from "@/server/services/radius.service";

/**
 * POST /api/cron/radius-expire
 * 
 * Cron job endpoint: Expire stale RADIUS credentials.
 * Removes radcheck/radreply for users past their expiresAt.
 * Should be called every minute via cron or Vercel Cron.
 * 
 * Protected by CRON_SECRET header.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await RadiusService.expireStaleCredentials();

    console.log(`[RADIUS Cron] Expired ${result.expired} stale credentials`);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[RADIUS Cron] Error:", error);
    return NextResponse.json({ error: "Failed to expire credentials" }, { status: 500 });
  }
}

/**
 * GET — Also allow GET for Vercel Cron compatibility
 */
export async function GET(req: NextRequest) {
  return POST(req);
}

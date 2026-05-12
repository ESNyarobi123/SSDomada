import { NextRequest, NextResponse } from "next/server";
import { OmadaService } from "@/server/services/omada.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/omada-health
 *
 * Diagnostic endpoint — tries to login to Omada Controller and list sites.
 * Returns detailed config status + connectivity result.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` to avoid exposing config.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const env = {
    OMADA_URL: process.env.OMADA_URL ? "set" : "MISSING",
    OMADA_CLIENT_ID: process.env.OMADA_CLIENT_ID ? "set" : "MISSING",
    OMADA_CLIENT_SECRET: process.env.OMADA_CLIENT_SECRET ? "set" : "MISSING",
    OMADA_CONTROLLER_ID: process.env.OMADA_CONTROLLER_ID ? "set" : "MISSING",
  };

  const missing = Object.entries(env).filter(([, v]) => v === "MISSING").map(([k]) => k);
  if (missing.length) {
    return NextResponse.json(
      { ok: false, error: "Missing env vars", missing, env },
      { status: 500 },
    );
  }

  try {
    const startedAt = Date.now();
    const sites = await OmadaService.listSites();
    const durationMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      env,
      durationMs,
      siteCount: sites.length,
      sites: sites.slice(0, 5).map((s) => ({ id: (s as any).siteId || (s as any).id, name: s.name })),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        env,
        error: err.message || String(err),
        hint: "Check OMADA_URL is reachable from container, credentials are valid, and OMADA_CONTROLLER_ID matches.",
      },
      { status: 502 },
    );
  }
}

import { getLandingPageConfig } from "@/server/services/landing-page.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/public/landing-page
 * Marketing site content (footer, contact, social, hero overrides).
 */
export async function GET() {
  try {
    const config = await getLandingPageConfig();
    return Response.json({ success: true, data: config });
  } catch (error) {
    console.error("[Public Landing Page GET] Error:", error);
    return Response.json({ success: false, error: "unavailable" }, { status: 503 });
  }
}

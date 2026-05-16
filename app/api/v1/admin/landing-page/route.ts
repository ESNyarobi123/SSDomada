import { NextRequest } from "next/server";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { getLandingPageConfig, saveLandingPageConfig } from "@/server/services/landing-page.service";
import { defaultLandingPageConfig } from "@/lib/landing-page-settings";

/**
 * GET /api/v1/admin/landing-page
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const config = await getLandingPageConfig();
    return apiSuccess({ config, defaults: defaultLandingPageConfig() });
  } catch (error) {
    console.error("[Admin Landing Page GET] Error:", error);
    return apiError("Failed to load landing page settings", 500);
  }
}

/**
 * PUT /api/v1/admin/landing-page
 * Body: full LandingPageConfig JSON
 */
export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const body = await req.json();
    const config = await saveLandingPageConfig(body);

    await logAdminAction(
      admin.userId,
      "landing_page.updated",
      "SystemSetting",
      undefined,
      { keys: ["brand", "hero", "cta", "footer", "seo"] },
      getClientIp(req)
    );

    return apiSuccess({ config });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      return apiError("Validation failed", 422, "VALIDATION_ERROR");
    }
    console.error("[Admin Landing Page PUT] Error:", error);
    return apiError("Failed to save landing page settings", 500);
  }
}

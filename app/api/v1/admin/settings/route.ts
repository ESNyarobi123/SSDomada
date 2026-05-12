import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { updateSettingSchema } from "@/lib/validations/admin";
import { OmadaClient } from "@/server/lib/omada-client";

/**
 * GET /api/v1/admin/settings
 * Get all system settings + system health status.
 * ?section=all|general|snippe|omada|health
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section") || "all";

    if (section === "health") {
      return await getSystemHealth();
    }

    // Get settings from DB
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });

    // Parse settings into structured object
    const parsed: Record<string, any> = {};
    for (const setting of settings) {
      let value: any = setting.value;
      if (setting.type === "number") value = parseFloat(setting.value);
      else if (setting.type === "boolean") value = setting.value === "true";
      else if (setting.type === "json") {
        try { value = JSON.parse(setting.value); } catch { /* keep as string */ }
      }
      parsed[setting.key] = { value, type: setting.type, updatedAt: setting.updatedAt };
    }

    // If specific section requested
    if (section !== "all") {
      const filtered: Record<string, any> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (key.startsWith(section)) filtered[key] = val;
      }
      return apiSuccess({ settings: filtered, section });
    }

    return apiSuccess({ settings: parsed });
  } catch (error) {
    console.error("[Admin Settings GET] Error:", error);
    return apiError("Failed to load settings", 500);
  }
}

/**
 * PUT /api/v1/admin/settings
 * Create or update a system setting.
 */
export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const body = await req.json();

    // Support bulk update
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        const validated = updateSettingSchema.parse(item);
        const setting = await prisma.systemSetting.upsert({
          where: { key: validated.key },
          update: { value: validated.value, type: validated.type },
          create: { key: validated.key, value: validated.value, type: validated.type },
        });
        results.push(setting);
      }

      await logAdminAction(admin.userId, "settings.bulk_updated", "SystemSetting", undefined, {
        keys: results.map((r) => r.key),
      }, getClientIp(req));

      return apiSuccess({ updated: results });
    }

    // Single update
    const validated = updateSettingSchema.parse(body);
    const setting = await prisma.systemSetting.upsert({
      where: { key: validated.key },
      update: { value: validated.value, type: validated.type },
      create: { key: validated.key, value: validated.value, type: validated.type },
    });

    await logAdminAction(admin.userId, "settings.updated", "SystemSetting", setting.id, {
      key: validated.key,
    }, getClientIp(req));

    return apiSuccess(setting);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed", 422, "VALIDATION_ERROR");
    }
    console.error("[Admin Settings PUT] Error:", error);
    return apiError("Failed to update settings", 500);
  }
}

/**
 * System health check — Omada Controller, Database, etc.
 */
async function getSystemHealth() {
  const checks: Record<string, { status: string; latency?: number; message?: string }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "healthy", latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = { status: "unhealthy", message: "Database connection failed" };
  }

  // Omada Controller check
  const omadaStart = Date.now();
  try {
    await OmadaClient.login();
    checks.omadaController = { status: "connected", latency: Date.now() - omadaStart };
  } catch (error) {
    checks.omadaController = { status: "disconnected", message: "Cannot reach Omada Controller" };
  }

  // System stats
  const [totalResellers, totalDevices, totalPayments, pendingWithdrawals] = await Promise.all([
    prisma.reseller.count(),
    prisma.device.count(),
    prisma.payment.count(),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
  ]);

  return apiSuccess({
    section: "health",
    checks,
    stats: { totalResellers, totalDevices, totalPayments, pendingWithdrawals },
    timestamp: new Date().toISOString(),
  });
}

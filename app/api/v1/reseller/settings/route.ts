import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { changePasswordSchema, updateNotificationSchema } from "@/lib/validations/reseller";
import bcrypt from "bcryptjs";

/**
 * GET /api/v1/reseller/settings
 * Get reseller settings: notification preferences, subscription status, security info.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const [user, reseller, notifPrefs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { email: true, phone: true, createdAt: true, emailVerified: true },
      }),
      prisma.reseller.findUnique({
        where: { id: ctx.resellerId },
        select: {
          isActive: true,
          commissionRate: true,
          createdAt: true,
          brandSlug: true,
        },
      }),
      prisma.notificationPreference.findUnique({
        where: { resellerId: ctx.resellerId },
      }),
    ]);

    // Auto-create default notification preferences
    let prefs = notifPrefs;
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          resellerId: ctx.resellerId,
          emailAddress: user?.email,
          smsPhone: user?.phone,
        },
      });
    }

    // Recent login activity from audit logs
    const recentLogins = await prisma.auditLog.findMany({
      where: { userId: ctx.userId, action: { contains: "login" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { createdAt: true, ipAddress: true },
    });

    return apiSuccess({
      account: {
        email: user?.email,
        phone: user?.phone,
        emailVerified: !!user?.emailVerified,
        memberSince: user?.createdAt,
      },
      subscription: {
        active: reseller?.isActive || false,
        commissionRate: reseller?.commissionRate,
        brandSlug: reseller?.brandSlug,
      },
      notifications: prefs,
      security: {
        recentLogins,
      },
    });
  } catch (error) {
    console.error("[Reseller Settings GET] Error:", error);
    return apiError("Failed to load settings", 500);
  }
}

/**
 * PUT /api/v1/reseller/settings
 * Update settings. Actions: "password" | "notifications"
 */
export async function PUT(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const action = body.action as string;

    // === CHANGE PASSWORD ===
    if (action === "password") {
      const validated = changePasswordSchema.parse(body);

      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { password: true },
      });

      if (!user?.password) {
        return apiError("Account uses social login. Password change not available.", 400);
      }

      const isValid = await bcrypt.compare(validated.currentPassword, user.password);
      if (!isValid) return apiError("Current password is incorrect", 401, "WRONG_PASSWORD");

      const hashedPassword = await bcrypt.hash(validated.newPassword, 12);
      await prisma.user.update({
        where: { id: ctx.userId },
        data: { password: hashedPassword },
      });

      await logResellerAction(ctx.userId, "settings.password_changed", "User", ctx.userId, {}, getClientIp(req));

      return apiSuccess({ message: "Password changed successfully" });
    }

    // === NOTIFICATION PREFERENCES ===
    if (action === "notifications") {
      const validated = updateNotificationSchema.parse(body);

      const prefs = await prisma.notificationPreference.upsert({
        where: { resellerId: ctx.resellerId },
        update: validated,
        create: {
          resellerId: ctx.resellerId,
          ...validated,
        },
      });

      await logResellerAction(ctx.userId, "settings.notifications_updated", "NotificationPreference", prefs.id, {}, getClientIp(req));

      return apiSuccess(prefs);
    }

    return apiError("Invalid action. Use 'password' or 'notifications'.", 400);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors?.map((e: any) => e.message).join(", "), 422);
    }
    console.error("[Reseller Settings PUT] Error:", error);
    return apiError("Failed to update settings", 500);
  }
}

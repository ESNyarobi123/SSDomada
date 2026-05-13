import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError, logAdminAction, getClientIp } from "@/server/middleware/admin-auth";
import { AuthService } from "@/server/services/auth.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/admin/resellers/[id]/impersonate
 * Create a session token for the reseller's user (super-admin only, audited).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const { id } = await params;

  try {
    const reseller = await prisma.reseller.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, isActive: true } },
      },
    });

    if (!reseller) return apiError("Reseller not found", 404, "NOT_FOUND");
    if (reseller.user.role !== "RESELLER") {
      return apiError("This account is not a reseller login", 400, "INVALID_ROLE");
    }

    const token = await AuthService.createSession(reseller.userId);

    await logAdminAction(admin.userId, "reseller.impersonation_started", "Reseller", id, {}, getClientIp(req));

    return apiSuccess({
      token,
      resellerId: reseller.id,
      user: {
        id: reseller.user.id,
        email: reseller.user.email,
        name: reseller.user.name,
        isActive: reseller.user.isActive,
      },
    });
  } catch (error) {
    console.error("[Admin Reseller impersonate] Error:", error);
    return apiError("Failed to create impersonation session", 500);
  }
}

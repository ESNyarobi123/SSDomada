import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";

/**
 * Reseller authentication context — guarantees tenant isolation.
 * Every query in reseller routes MUST use ctx.resellerId to scope data.
 */
export interface ResellerContext {
  userId: string;
  resellerId: string;
  email: string;
  companyName: string;
  brandSlug: string;
  role: "RESELLER";
}

/**
 * Verify that the request comes from an authenticated Reseller.
 * Returns ResellerContext with resellerId for tenant-scoped queries.
 *
 * Usage:
 *   const ctx = await verifyReseller(req);
 *   if (ctx instanceof NextResponse) return ctx;
 *   // ctx.resellerId is guaranteed — use in all DB queries
 */
export async function verifyReseller(req: NextRequest): Promise<ResellerContext | NextResponse> {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          include: {
            reseller: {
              select: { id: true, companyName: true, brandSlug: true, isActive: true },
            },
          },
        },
      },
    });

    if (!session || session.expires < new Date()) {
      return NextResponse.json(
        { success: false, error: "Session expired or invalid", code: "SESSION_EXPIRED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "RESELLER") {
      return NextResponse.json(
        { success: false, error: "Access denied. Reseller account required.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (!session.user.isActive) {
      return NextResponse.json(
        { success: false, error: "Your account has been deactivated. Contact support.", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    if (!session.user.reseller) {
      return NextResponse.json(
        { success: false, error: "Reseller profile not found", code: "NO_RESELLER_PROFILE" },
        { status: 403 }
      );
    }

    if (!session.user.reseller.isActive) {
      return NextResponse.json(
        { success: false, error: "Your reseller account has been suspended. Contact support.", code: "RESELLER_SUSPENDED" },
        { status: 403 }
      );
    }

    return {
      userId: session.user.id,
      resellerId: session.user.reseller.id,
      email: session.user.email,
      companyName: session.user.reseller.companyName,
      brandSlug: session.user.reseller.brandSlug,
      role: "RESELLER",
    };
  } catch (error) {
    console.error("[ResellerAuth] Error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed", code: "AUTH_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Log a reseller action to audit trail
 */
export async function logResellerAction(
  userId: string,
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entity, entityId, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined, ipAddress },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to log reseller action:", error);
  }
}

/**
 * Extract client IP
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Standard API responses
 */
export function apiSuccess<T>(data: T, meta?: { page?: number; limit?: number; total?: number }) {
  return NextResponse.json({ success: true, data, ...(meta && { meta }) });
}

export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code: code || "ERROR" },
    { status }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";

/**
 * Admin authentication result
 */
export interface AdminContext {
  userId: string;
  email: string;
  role: "SUPER_ADMIN";
}

/**
 * Verify that the request comes from an authenticated Super Admin.
 * Extracts user from session/token and validates role.
 *
 * Usage in route handlers:
 *   const admin = await verifyAdmin(req);
 *   if (admin instanceof NextResponse) return admin; // Error response
 */
export async function verifyAdmin(req: NextRequest): Promise<AdminContext | NextResponse> {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Verify session token and get user
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });

    if (!session || session.expires < new Date()) {
      return NextResponse.json(
        { error: "Session expired or invalid", code: "SESSION_EXPIRED" },
        { status: 401 }
      );
    }

    // Check SUPER_ADMIN role
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access denied. Super Admin privileges required.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (!session.user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      role: "SUPER_ADMIN",
    };
  } catch (error) {
    console.error("[AdminAuth] Error:", error);
    return NextResponse.json(
      { error: "Authentication failed", code: "AUTH_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Log an admin action to the audit trail
 */
export async function logAdminAction(
  userId: string,
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        ipAddress,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to log action:", error);
  }
}

/**
 * Extract client IP from request
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Standard error response builder
 */
export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code: code || "ERROR" },
    { status }
  );
}

/**
 * Standard success response builder
 */
export function apiSuccess<T>(data: T, meta?: { page?: number; limit?: number; total?: number }) {
  return NextResponse.json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}

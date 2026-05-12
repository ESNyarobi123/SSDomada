import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";

export interface CustomerContext {
  userId: string;
  email: string;
  name: string | null;
  role: "END_USER";
}

export async function verifyCustomer(req: NextRequest): Promise<CustomerContext | NextResponse> {
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
      include: { user: true },
    });

    if (!session || session.expires < new Date()) {
      return NextResponse.json(
        { success: false, error: "Session expired or invalid", code: "SESSION_EXPIRED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "END_USER") {
      return NextResponse.json(
        { success: false, error: "Customer account required.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (!session.user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account deactivated", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: "END_USER",
    };
  } catch (error) {
    console.error("[CustomerAuth]", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed", code: "AUTH_ERROR" },
      { status: 500 }
    );
  }
}

export function apiSuccess<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code: code || "ERROR" },
    { status }
  );
}

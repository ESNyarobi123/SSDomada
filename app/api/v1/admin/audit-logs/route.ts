import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";
import { paginationSchema } from "@/lib/validations/admin";

/**
 * GET /api/v1/admin/audit-logs
 * Browse audit logs with filtering by action, entity, user, date range.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const action = searchParams.get("action") || undefined;
    const entity = searchParams.get("entity") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search") || undefined;

    const where: any = {};

    if (action) where.action = { contains: action, mode: "insensitive" };
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search } },
        { ipAddress: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Enrich logs with user info
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = logs.map((log) => ({
      ...log,
      user: log.userId ? userMap.get(log.userId) || null : null,
    }));

    return apiSuccess(enriched, { page, limit, total });
  } catch (error) {
    console.error("[Admin Audit Logs] Error:", error);
    return apiError("Failed to fetch audit logs", 500);
  }
}

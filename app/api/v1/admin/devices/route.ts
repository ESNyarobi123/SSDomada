import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyAdmin, apiSuccess, apiError } from "@/server/middleware/admin-auth";
import { paginationSchema } from "@/lib/validations/admin";

/**
 * GET /api/v1/admin/devices
 * List all devices across all resellers.
 * Supports filtering by reseller, site, status, type, and search by MAC/name.
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

    const search = searchParams.get("search") || undefined;
    const resellerId = searchParams.get("resellerId") || undefined;
    const siteId = searchParams.get("siteId") || undefined;
    const status = searchParams.get("status") || undefined; // ONLINE, OFFLINE, PENDING
    const type = searchParams.get("type") || undefined; // AP, SWITCH, GATEWAY, OTHER

    const where: any = {};

    if (resellerId) where.resellerId = resellerId;
    if (siteId) where.siteId = siteId;
    if (status) where.status = status;
    if (type) where.type = type;

    if (search) {
      where.OR = [
        { mac: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { ip: { contains: search } },
        { model: { contains: search, mode: "insensitive" } },
      ];
    }

    const [devices, total, statusCounts] = await Promise.all([
      prisma.device.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastSeen: "desc" },
        include: {
          reseller: { select: { id: true, companyName: true, brandSlug: true } },
          site: { select: { id: true, name: true, location: true } },
        },
      }),
      prisma.device.count({ where }),
      prisma.device.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    return apiSuccess(
      {
        devices,
        summary: {
          online: statusCounts.find((s) => s.status === "ONLINE")?._count || 0,
          offline: statusCounts.find((s) => s.status === "OFFLINE")?._count || 0,
          pending: statusCounts.find((s) => s.status === "PENDING")?._count || 0,
        },
      },
      { page, limit, total }
    );
  } catch (error) {
    console.error("[Admin Devices GET] Error:", error);
    return apiError("Failed to fetch devices", 500);
  }
}

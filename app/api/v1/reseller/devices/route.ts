import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { paginationSchema, addDeviceSchema } from "@/lib/validations/reseller";
import { OmadaService, type OmadaSiteLinkSource } from "@/server/services/omada.service";
import { buildInformUrlPendingUserMessage } from "@/lib/add-device-inform-guide";
import { ensureActiveResellerPlan, ensureCapacity } from "@/server/middleware/paywall";

/**
 * GET /api/v1/reseller/devices
 * List all devices belonging to this reseller.
 * Includes live status from Omada Controller when available.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const search = searchParams.get("search") || undefined;
    const siteId = searchParams.get("siteId") || undefined;
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;

    const where: Record<string, unknown> = { resellerId: ctx.resellerId };
    if (siteId) (where as any).siteId = siteId;
    if (status) (where as any).status = status;
    if (type) (where as any).type = type;

    if (search) {
      (where as any).OR = [
        { mac: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { ip: { contains: search } },
        { model: { contains: search, mode: "insensitive" } },
      ];
    }

    const [devices, total, statusCounts] = await Promise.all([
      prisma.device.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastSeen: "desc" },
        include: {
          site: { select: { id: true, name: true, location: true, omadaSiteId: true } },
        },
      }),
      prisma.device.count({ where: where as any }),
      prisma.device.groupBy({
        by: ["status"],
        where: { resellerId: ctx.resellerId },
        _count: true,
      }),
    ]);

    const summary = {
      online: statusCounts.find((s) => s.status === "ONLINE")?._count || 0,
      offline: statusCounts.find((s) => s.status === "OFFLINE")?._count || 0,
      pending: statusCounts.find((s) => s.status === "PENDING")?._count || 0,
      total: statusCounts.reduce((sum, s) => sum + s._count, 0),
    };

    return apiSuccess({ devices, summary }, { page, limit, total });
  } catch (error) {
    console.error("[Reseller Devices GET] Error:", error);
    return apiError("Failed to fetch devices", 500);
  }
}

/**
 * POST /api/v1/reseller/devices
 * Add a new device by MAC address. Optionally adopt it on Omada Controller.
 * Optional body: `deviceUsername` + `devicePassword` (both together) when the AP’s web login was changed — passed to Omada `start-adopt`.
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  // Paywall: must have active plan and device capacity
  const planGate = await ensureActiveResellerPlan(ctx.resellerId);
  if (planGate) return planGate;
  const capGate = await ensureCapacity(ctx.resellerId, "devices");
  if (capGate) return capGate;

  try {
    const body = await req.json();
    const validated = addDeviceSchema.parse(body);

    // Verify site belongs to this reseller
    const site = await prisma.site.findFirst({
      where: { id: validated.siteId, resellerId: ctx.resellerId },
    });
    if (!site) return apiError("Site not found or not owned by you", 404, "SITE_NOT_FOUND");

    // Check MAC not already registered
    const existingDevice = await prisma.device.findUnique({ where: { mac: validated.mac.toUpperCase() } });
    if (existingDevice) return apiError("Device with this MAC already registered", 409, "MAC_EXISTS");

    // Link SSDomada site → Omada site first (match by name, create on controller, or use stored omadaSiteId)
    const link = await OmadaService.resolveOmadaSiteIdForResellerSite({
      id: site.id,
      name: site.name,
      omadaSiteId: site.omadaSiteId,
    });

    let omadaSiteId = link.omadaSiteId;
    if (omadaSiteId && link.linkSource !== "db") {
      try {
        await prisma.site.update({
          where: { id: site.id },
          data: { omadaSiteId },
        });
      } catch (e: unknown) {
        console.error("[Reseller Devices POST] Failed to persist omadaSiteId:", e);
        const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
        if (code === "P2002") {
          return apiError(
            "This Omada site is already linked to another SSDomada site. Rename one of the sites or unlink in admin.",
            409,
            "OMADA_SITE_ID_CONFLICT"
          );
        }
        return apiError("Failed to save Omada site link.", 500);
      }
    }

    const device = await prisma.device.create({
      data: {
        resellerId: ctx.resellerId,
        siteId: validated.siteId,
        name: validated.name,
        mac: validated.mac.toUpperCase(),
        type: validated.type,
        status: "PENDING",
      },
      include: { site: { select: { name: true, omadaSiteId: true } } },
    });

    let adopted = false;
    let omadaInfo: { ip?: string; model?: string; firmware?: string } = {};
    const omada: {
      siteLinked: boolean;
      siteLinkSource: OmadaSiteLinkSource;
      omadaSiteId?: string;
      controllerDeviceListed?: boolean;
      adoptAttempted: boolean;
      adopted: boolean;
      resolutionNote?: string;
      message?: string;
      userMessage?: string;
      errorCode?: number;
    } = {
      siteLinked: Boolean(omadaSiteId),
      siteLinkSource: link.linkSource,
      adoptAttempted: false,
      adopted: false,
    };

    if (link.linkMessage) {
      omada.resolutionNote = link.linkMessage;
    }
    if (omadaSiteId) {
      omada.omadaSiteId = omadaSiteId;
    }

    if (omadaSiteId) {
      const preview = await OmadaService.findDeviceByMac(omadaSiteId, validated.mac.toUpperCase());
      omada.controllerDeviceListed = Boolean(preview);

      if (!preview) {
        omada.userMessage = buildInformUrlPendingUserMessage();
        omada.resolutionNote = omada.resolutionNote
          ? `${omada.resolutionNote} Inform URL not configured on AP.`
          : "Inform URL not configured on AP.";
      }

      omada.adoptAttempted = true;
      const adoptCreds =
        validated.deviceUsername?.trim() && validated.devicePassword
          ? { username: validated.deviceUsername.trim(), password: validated.devicePassword }
          : undefined;
      const adoptRes = await OmadaService.adoptDevice(omadaSiteId, validated.mac.toUpperCase(), adoptCreds);
      adopted = adoptRes.adopted;
      omada.adopted = adoptRes.adopted;
      if (!adoptRes.adopted) {
        omada.message = adoptRes.message;
        omada.errorCode = adoptRes.errorCode;
        if (!omada.userMessage) {
          omada.userMessage = preview
            ? "Device imehifadhiwa lakini Omada haijai-adopt bado. Hakikisha AP iko online na Inform URL imewekwa, kisha jaribu tena."
            : buildInformUrlPendingUserMessage();
        }
      }
      const live = await OmadaService.findDeviceByMac(omadaSiteId, validated.mac);
      if (live) {
        omadaInfo = {
          ip: live.ip,
          model: live.model,
          firmware: (live as any).firmwareVersion,
        };
        await prisma.device.update({
          where: { id: device.id },
          data: {
            status: adopted ? "ONLINE" : "PENDING",
            ip: omadaInfo.ip,
            model: omadaInfo.model,
            firmwareVersion: omadaInfo.firmware,
            omadaDeviceId: validated.mac.toUpperCase(),
            lastSeen: adopted ? new Date() : undefined,
          },
        });
      }
    } else {
      omada.message =
        link.linkMessage ||
        "Could not link this SSDomada site to Omada. Device is saved locally only — check OMADA_* settings and controller connectivity.";
    }

    await logResellerAction(ctx.userId, "device.added", "Device", device.id, {
      mac: device.mac,
      name: device.name,
      adopted,
      omadaSiteId: omadaSiteId || undefined,
      siteLinkSource: link.linkSource,
      omadaErrorCode: omada.errorCode,
      omadaMessage: omada.message || omada.resolutionNote,
    }, getClientIp(req));

    const fresh = await prisma.device.findUnique({
      where: { id: device.id },
      include: { site: { select: { id: true, name: true, omadaSiteId: true } } },
    });

    return apiSuccess({ ...fresh!, adopted, omada, ...omadaInfo });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("Validation failed: " + error.errors.map((e: any) => `${e.path}: ${e.message}`).join(", "), 422, "VALIDATION_ERROR");
    }
    console.error("[Reseller Devices POST] Error:", error);
    return apiError("Failed to add device", 500);
  }
}

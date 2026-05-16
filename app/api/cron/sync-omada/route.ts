import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { OmadaService } from "@/server/services/omada.service";
import { RadiusService } from "@/server/services/radius.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sync-omada
 *
 * Periodic synchronization between SSDomada and the Omada Controller:
 *   - Pulls latest device status (online/offline, signal, IP)
 *   - Marks expired RADIUS users / portal sessions
 *   - Heals missing Omada site IDs for resellers
 *
 * Run from Vercel Cron, GitHub Actions, or a Linux cron every 5 minutes.
 *
 * Auth: callers must include `Authorization: Bearer <CRON_SECRET>` header.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const stats = {
    sitesScanned: 0,
    devicesUpdated: 0,
    devicesOffline: 0,
    expiredSessions: 0,
    expiredRadius: 0,
    dataLimited: 0,
    omadaDeauthorized: 0,
    expiredSubscriptions: 0,
    healedSites: 0,
    errors: [] as string[],
  };

  try {
    // 1. Heal sites without omadaSiteId — try to create them now
    const orphanSites = await prisma.site.findMany({
      where: { omadaSiteId: null },
      include: { reseller: { select: { companyName: true } } },
      take: 20,
    });
    for (const s of orphanSites) {
      const omadaSiteId = await OmadaService.createOmadaSiteOnly(s.name || s.reseller.companyName);
      if (omadaSiteId) {
        await prisma.site.update({ where: { id: s.id }, data: { omadaSiteId } });
        stats.healedSites += 1;
      }
    }

    // 2. Sync device status per site
    const sites = await prisma.site.findMany({
      where: { omadaSiteId: { not: null } },
      select: { id: true, omadaSiteId: true },
    });

    for (const site of sites) {
      stats.sitesScanned += 1;
      try {
        const liveDevices = await OmadaService.listDevices(site.omadaSiteId!);
        const liveByMac = new Map(
          liveDevices.map((d) => [(d.mac || "").toUpperCase().replace(/[:-]/g, ""), d]),
        );

        const dbDevices = await prisma.device.findMany({ where: { siteId: site.id } });
        for (const d of dbDevices) {
          const key = d.mac.toUpperCase().replace(/[:-]/g, "");
          const live = liveByMac.get(key);
          if (live) {
            const isOnline = (live.status as any) === 1 || (live.status as any) === "ONLINE" || (live as any).statusCategory === 1;
            await prisma.device.update({
              where: { id: d.id },
              data: {
                status: isOnline ? "ONLINE" : "OFFLINE",
                ip: live.ip || d.ip,
                model: live.model || d.model,
                firmwareVersion: (live as any).firmwareVersion || d.firmwareVersion,
                lastSeen: isOnline ? new Date() : d.lastSeen,
              },
            });
            stats.devicesUpdated += 1;
            if (!isOnline) stats.devicesOffline += 1;
          } else if (d.status !== "OFFLINE") {
            await prisma.device.update({
              where: { id: d.id },
              data: { status: "OFFLINE" },
            });
            stats.devicesOffline += 1;
          }
        }
      } catch (err: any) {
        stats.errors.push(`site=${site.id}: ${err.message || err}`);
      }
    }

    // 3. Enforce paid-access limits. This removes FreeRADIUS rows and asks
    // Omada to unauthorize expired/quota-exceeded clients.
    const expiry = await RadiusService.expireStaleCredentials();
    stats.expiredRadius = expiry.expired;
    stats.dataLimited = expiry.dataLimited;
    stats.omadaDeauthorized = expiry.omadaDeauthorized;
    stats.expiredSubscriptions = expiry.expiredSubscriptions;
    stats.expiredSessions = expiry.expiredPortalSessions;
    stats.errors.push(...expiry.errors);

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      stats,
    });
  } catch (error: any) {
    console.error("[Cron sync-omada] Fatal:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Sync failed", stats },
      { status: 500 },
    );
  }
}

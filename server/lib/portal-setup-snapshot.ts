import { prisma } from "@/server/lib/prisma";
import { getPortalPublicBaseUrl } from "@/server/lib/public-app-base-url";
import type { PortalSetupSnapshot } from "@/lib/portal-setup-types";

export type { PortalSetupSnapshot } from "@/lib/portal-setup-types";

/**
 * Build JSON payload for super-admins configuring Omada manually (external portal + SSIDs).
 */
export async function buildPortalSetupSnapshot(
  resellerId: string,
  opts: { brandSlug: string; companyName: string; resellerEmail: string; siteId?: string | null }
): Promise<PortalSetupSnapshot> {
  const base = getPortalPublicBaseUrl();
  const portalUrl = base.startsWith("http") ? `${base}/portal/${opts.brandSlug}` : "";

  const sites = await prisma.site.findMany({
    where: {
      resellerId,
      ...(opts.siteId ? { id: opts.siteId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, omadaSiteId: true },
  });

  const siteIds = sites.map((s) => s.id);
  const [devices, ssids] = await Promise.all([
    prisma.device.findMany({
      where: { resellerId, siteId: { in: siteIds } },
      select: {
        id: true,
        siteId: true,
        name: true,
        mac: true,
        model: true,
        status: true,
        omadaDeviceId: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.ssidConfig.findMany({
      where: { resellerId, siteId: { in: siteIds } },
      select: {
        id: true,
        siteId: true,
        ssidName: true,
        password: true,
        omadaSsidId: true,
        band: true,
      },
      orderBy: { ssidName: "asc" },
    }),
  ]);

  return {
    portalUrl,
    brandSlug: opts.brandSlug,
    companyName: opts.companyName,
    resellerEmail: opts.resellerEmail,
    sites: sites.map((site) => ({
      siteId: site.id,
      siteName: site.name,
      omadaSiteId: site.omadaSiteId,
      devices: devices
        .filter((d) => d.siteId === site.id)
        .map((d) => ({
          id: d.id,
          name: d.name,
          mac: d.mac,
          model: d.model,
          status: d.status,
          omadaDeviceId: d.omadaDeviceId,
        })),
      ssids: ssids
        .filter((x) => x.siteId === site.id)
        .map((x) => ({
          id: x.id,
          ssidName: x.ssidName,
          open: x.password == null || x.password === "",
          omadaSsidId: x.omadaSsidId,
          band: x.band,
        })),
    })),
  };
}

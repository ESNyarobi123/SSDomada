import { OmadaClient } from "@/server/lib/omada-client";
import { prisma } from "@/server/lib/prisma";
import type { OmadaSite, OmadaDevice, OmadaClient as OmadaClientType, OmadaApiResponse } from "@/types/omada";

const OMADA_CONTROLLER_ID = process.env.OMADA_CONTROLLER_ID || "";

export type OmadaSiteLinkSource = "db" | "omada_match" | "omada_created" | "unavailable";

/**
 * Business logic for interacting with Omada Controller
 * Uses OmadaClient for HTTP calls, adds DB persistence.
 *
 * NOTE: All methods are best-effort — if controller is unreachable,
 * we still allow DB-only operations so the dashboard keeps working.
 * Callers should pass `{ throwOnFail: true }` if they need hard failure.
 */
export class OmadaService {
  // ============================================================
  // SITES
  // ============================================================

  /**
   * List all sites from Omada Controller
   */
  static async listSites(): Promise<OmadaSite[]> {
    const res = await OmadaClient.get<OmadaApiResponse<OmadaSite>>(
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites?page=1&pageSize=100`
    );
    return res.result.data;
  }

  /**
   * Create a new site on Omada Controller (no DB write).
   * Returns the omadaSiteId on success, or null on failure.
   */
  static async createOmadaSiteOnly(
    name: string,
    opts?: {
      scenario?: string;
      timeZone?: string; 
      region?: string;
      deviceUsername?: string;
      devicePassword?: string;
    }
  ): Promise<string | null> {
    const devicePassword = opts?.devicePassword || process.env.OMADA_DEVICE_PASSWORD;
    if (!devicePassword) {
      console.error("[OmadaService] createOmadaSiteOnly skipped: OMADA_DEVICE_PASSWORD is required by Omada OpenAPI");
      return null;
    }

    const scenario = opts?.scenario || process.env.OMADA_SITE_SCENARIO || "General";
    const timeZone = opts?.timeZone || process.env.OMADA_SITE_TIME_ZONE || "Africa/Nairobi";
    const region = opts?.region || process.env.OMADA_SITE_REGION || "Tanzania";
    const deviceUsername = opts?.deviceUsername || process.env.OMADA_DEVICE_USERNAME || "ssdomada";

    try {
      const omadaRes = await OmadaClient.post<{ errorCode: number; msg?: string; result?: { siteId?: string } }>(
        `/openapi/v1/${OMADA_CONTROLLER_ID}/sites`,
        {
          name,
          type: 0,
          region,
          timeZone,
          scenario,
          deviceAccountSetting: {
            username: deviceUsername,
            password: devicePassword,
          },
          supportES: true,
          supportL2: true,
        }
      );
      if (omadaRes.errorCode !== 0) {
        console.error("[OmadaService] createOmadaSiteOnly rejected:", omadaRes.msg || omadaRes.errorCode);
        return null;
      }

      if (omadaRes.result?.siteId) return omadaRes.result.siteId;

      // Some Omada versions return an empty result for create; fetch by name to link the DB row.
      const sites = await this.listSites();
      return sites.find((site) => site.name === name)?.siteId || null;
    } catch (err) {
      console.error("[OmadaService] createOmadaSiteOnly failed:", err);
      return null;
    }
  }

  /**
   * Ensure there is an Omada Controller site id for a SSDomada site row.
   * Uses DB `omadaSiteId` if set; otherwise tries to match an existing Omada site by name,
   * then creates a new Omada site from `site.name` (requires OMADA_DEVICE_PASSWORD).
   */
  static async resolveOmadaSiteIdForResellerSite(site: {
    id: string;
    name: string;
    omadaSiteId: string | null;
  }): Promise<{
    omadaSiteId: string | null;
    linkSource: OmadaSiteLinkSource;
    linkMessage?: string;
  }> {
    if (site.omadaSiteId) {
      return { omadaSiteId: site.omadaSiteId, linkSource: "db" };
    }

    if (!process.env.OMADA_DEVICE_PASSWORD) {
      return {
        omadaSiteId: null,
        linkSource: "unavailable",
        linkMessage:
          "OMADA_DEVICE_PASSWORD is not configured — cannot auto-create an Omada site. Set it on the SSDomada server or link this site manually in Omada.",
      };
    }

    const targetName = site.name.trim();
    if (!targetName) {
      return { omadaSiteId: null, linkSource: "unavailable", linkMessage: "Site name is empty." };
    }

    try {
      const onOmada = await this.listSites();
      const match = onOmada.find((s) => s.name.trim().toLowerCase() === targetName.toLowerCase());
      if (match?.siteId) {
        const conflict = await prisma.site.findFirst({
          where: { omadaSiteId: match.siteId, NOT: { id: site.id } },
        });
        if (!conflict) {
          return { omadaSiteId: match.siteId, linkSource: "omada_match" };
        }
      }
    } catch (err) {
      console.error("[OmadaService] resolveOmadaSiteId listSites failed:", err);
    }

    const created = await this.createOmadaSiteOnly(targetName);
    if (created) {
      return { omadaSiteId: created, linkSource: "omada_created" };
    }

    const suffix = site.id.slice(-6);
    const fallback = await this.createOmadaSiteOnly(`${targetName} (${suffix})`);
    if (fallback) {
      return {
        omadaSiteId: fallback,
        linkSource: "omada_created",
        linkMessage: `Created Omada site as "${targetName} (${suffix})" because the plain name could not be used.`,
      };
    }

    return {
      omadaSiteId: null,
      linkSource: "unavailable",
      linkMessage:
        "Could not create or match an Omada site. Check OMADA_* env vars, controller reachability, and Open API permissions.",
    };
  }

  /**
   * Create a new site on Omada Controller + save to DB (legacy combined helper)
   */
  static async createSite(resellerId: string, name: string, location?: string) {
    const omadaSiteId = await this.createOmadaSiteOnly(name);

    // Save to DB regardless — Omada link can be repaired later
    const site = await prisma.site.create({
      data: {
        resellerId,
        name,
        omadaSiteId: omadaSiteId || undefined,
        location,
      },
    });

    return site;
  }

  /**
   * Ensure a reseller has at least one Omada-linked site.
   * Called on register, on first dashboard load, etc.
   * Returns the site (existing or newly created).
   */
  static async ensureResellerSite(resellerId: string, companyName: string) {
    const existing = await prisma.site.findFirst({
      where: { resellerId },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      // Heal: if DB site has no omadaSiteId, try to match or create on Omada Controller
      if (!existing.omadaSiteId) {
        const link = await this.resolveOmadaSiteIdForResellerSite({
          id: existing.id,
          name: existing.name,
          omadaSiteId: null,
        });
        if (link.omadaSiteId) {
          try {
            return await prisma.site.update({
              where: { id: existing.id },
              data: { omadaSiteId: link.omadaSiteId },
            });
          } catch {
            return existing;
          }
        }
      }
      return existing;
    }
    return this.createSite(resellerId, companyName);
  }

  // ============================================================
  // DEVICES
  // ============================================================

  /**
   * List devices for a specific site from Omada Controller
   */
  static async listDevices(omadaSiteId: string): Promise<OmadaDevice[]> {
    const res = await OmadaClient.get<OmadaApiResponse<OmadaDevice>>(
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/devices`
    );
    return res.result.data;
  }

  /**
   * Sync device status from Omada Controller to database
   */
  static async syncDevices(siteId: string, omadaSiteId: string) {
    const omadaDevices = await this.listDevices(omadaSiteId);

    for (const device of omadaDevices) {
      await prisma.device.upsert({
        where: { mac: device.mac },
        update: {
          status: device.status === 1 ? "ONLINE" : "OFFLINE",
          ip: device.ip,
          name: device.name,
          model: device.model,
          firmwareVersion: device.firmwareVersion,
          lastSeen: device.status === 1 ? new Date() : undefined,
        },
        create: {
          siteId,
          resellerId: (await prisma.site.findUnique({ where: { id: siteId } }))!.resellerId,
          name: device.name,
          mac: device.mac,
          model: device.model,
          type: "AP",
          status: device.status === 1 ? "ONLINE" : "OFFLINE",
          ip: device.ip,
          omadaDeviceId: device.mac,
          firmwareVersion: device.firmwareVersion,
        },
      });
    }
  }

  /**
   * Reboot a device on Omada Controller by MAC
   */
  static async rebootDevice(omadaSiteId: string, deviceMac: string) {
    const macSeg = OmadaService.normalizeMacForOmadaDevicePath(deviceMac);
    return OmadaClient.post(
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/cmd/devices/${macSeg}/reboot`,
      {}
    );
  }

  // ============================================================
  // CLIENTS (WiFi users)
  // ============================================================

  /**
   * List connected clients for a site
   */
  static async listClients(omadaSiteId: string): Promise<OmadaClientType[]> {
    const res = await OmadaClient.get<OmadaApiResponse<OmadaClientType>>(
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/clients`
    );
    return res.result.data;
  }

  /**
   * Authorize a client MAC address on Omada (grant WiFi access)
   */
  static async authorizeClient(omadaSiteId: string, clientMac: string) {
    return OmadaClient.post(
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/cmd/clients/${clientMac}/authorize`,
      { authorizeMac: clientMac }
    );
  }

  /**
   * Deauthorize a client MAC address (revoke WiFi access)
   */
  static async deauthorizeClient(omadaSiteId: string, clientMac: string) {
    return OmadaClient.post(
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/cmd/clients/${clientMac}/unauthorize`,
      { unauthorizeMac: clientMac }
    );
  }

  // ============================================================
  // DEVICE ADOPTION
  // ============================================================

  /**
   * Omada OpenAPI device command paths expect MAC as six colon-separated octets (upper hex).
   * Input may use dashes or no separators (as stored in SSDomada).
   */
  static normalizeMacForOmadaDevicePath(mac: string): string {
    const hex = mac.replace(/[:-]/g, "").toUpperCase();
    if (!/^[0-9A-F]{12}$/.test(hex)) return mac.trim();
    return hex.match(/.{2}/g)!.join(":");
  }

  /**
   * Adopt a device into a site on Omada Controller.
   * The device must already be connected to the network and visible to the controller.
   * On failure, `message` / `errorCode` come from Omada (or the HTTP client) so operators can debug.
   */
  static async adoptDevice(omadaSiteId: string, deviceMac: string): Promise<{
    adopted: boolean;
    message?: string;
    errorCode?: number;
  }> {
    try {
      const macSeg = OmadaService.normalizeMacForOmadaDevicePath(deviceMac);
      const res = await OmadaClient.post<{ errorCode: number; msg?: string }>(
        `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/cmd/devices/${macSeg}/adopt`,
        {}
      );
      if (res.errorCode === 0) return { adopted: true };
      return {
        adopted: false,
        errorCode: res.errorCode,
        message: res.msg?.trim() || `Omada returned errorCode ${res.errorCode}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[OmadaService] adoptDevice failed:", err);
      return { adopted: false, message };
    }
  }

  /**
   * Look up an Omada device by MAC across a site and return its raw record (or null).
   */
  static async findDeviceByMac(omadaSiteId: string, mac: string) {
    try {
      const devices = await this.listDevices(omadaSiteId);
      const target = mac.toUpperCase().replace(/[:-]/g, "");
      return (
        devices.find((d) => (d.mac || "").toUpperCase().replace(/[:-]/g, "") === target) || null
      );
    } catch {
      return null;
    }
  }

  // ============================================================
  // SSID / WLAN
  // ============================================================

  /**
   * Create a wireless network (SSID) on a site.
   * Returns the omadaSsidId on success, null otherwise.
   */
  static async createSsid(
    omadaSiteId: string,
    input: {
      ssidName: string;
      password?: string | null;
      isHidden?: boolean;
      band?: "2.4GHz" | "5GHz" | "both";
      vlanId?: number | null;
      portalEnabled?: boolean; // attach captive portal
    }
  ): Promise<string | null> {
    const bandMap: Record<string, number[]> = {
      "2.4GHz": [0], // 2.4G
      "5GHz": [1], // 5G
      both: [0, 1],
    };
    const wlanBand = bandMap[input.band || "2.4GHz"];
    const securityMode = input.password ? "wpaPersonal" : "none";

    try {
      const res = await OmadaClient.post<{ errorCode: number; result: { id: string } }>(
        `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/wlans/ssids`,
        {
          name: input.ssidName,
          wlanBand,
          hidden: input.isHidden ?? false,
          security: securityMode,
          pskCipher: input.password ? "wpa2-psk" : undefined,
          pskKey: input.password || undefined,
          vlanId: input.vlanId ?? undefined,
          portalEnable: input.portalEnabled ?? !input.password, // open SSIDs default to captive portal
        }
      );
      if (res.errorCode !== 0) return null;
      return res.result?.id || null;
    } catch (err) {
      console.error("[OmadaService] createSsid failed:", err);
      return null;
    }
  }

  /**
   * Delete an SSID on Omada Controller.
   */
  static async deleteSsid(omadaSiteId: string, omadaSsidId: string): Promise<boolean> {
    try {
      const res = await OmadaClient.delete<{ errorCode: number }>(
        `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/wlans/ssids/${omadaSsidId}`
      );
      return res.errorCode === 0;
    } catch (err) {
      console.error("[OmadaService] deleteSsid failed:", err);
      return false;
    }
  }

  // ============================================================
  // EXTERNAL CAPTIVE PORTAL
  // ============================================================

  /**
   * Configure an External Captive Portal on a site so that connecting
   * WiFi clients are redirected to our `/portal/{brandSlug}` page.
   *
   * `portalUrl` should be the full HTTPS URL (e.g. https://ssdomada.com/portal/brand-x).
   */
  static async setExternalPortal(
    omadaSiteId: string,
    opts: { name: string; portalUrl: string; ssidIds?: string[] }
  ): Promise<boolean> {
    try {
      const res = await OmadaClient.post<{ errorCode: number }>(
        `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/portals`,
        {
          name: opts.name,
          authType: "externalRadius", // External web portal with our backend
          portalType: "external",
          externalUrl: opts.portalUrl,
          httpsRedirection: true,
          authenticationTimeout: 480, // minutes
          ssids: opts.ssidIds || [],
        }
      );
      return res.errorCode === 0;
    } catch (err) {
      console.error("[OmadaService] setExternalPortal failed:", err);
      return false;
    }
  }
}

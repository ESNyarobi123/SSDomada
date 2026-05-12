import { OmadaClient } from "@/server/lib/omada-client";
import { prisma } from "@/server/lib/prisma";
import type { OmadaSite, OmadaDevice, OmadaClient as OmadaClientType, OmadaApiResponse } from "@/types/omada";

const OMADA_CONTROLLER_ID = process.env.OMADA_CONTROLLER_ID || "";

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
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites`
    );
    return res.result.data;
  }

  /**
   * Create a new site on Omada Controller (no DB write).
   * Returns the omadaSiteId on success, or null on failure.
   */
  static async createOmadaSiteOnly(name: string, opts?: { scenario?: string; timeZone?: string }): Promise<string | null> {
    try {
      const omadaRes = await OmadaClient.post<{ errorCode: number; result: { siteId: string } }>(
        `/openapi/v1/${OMADA_CONTROLLER_ID}/sites`,
        {
          name,
          scenario: opts?.scenario || "Hotel",
          timeZone: opts?.timeZone || "Africa/Dar_es_Salaam",
        }
      );
      if (omadaRes.errorCode !== 0) return null;
      return omadaRes.result.siteId;
    } catch (err) {
      console.error("[OmadaService] createOmadaSiteOnly failed:", err);
      return null;
    }
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
      // Heal: if DB site has no omadaSiteId, try to create one now
      if (!existing.omadaSiteId) {
        const omadaSiteId = await this.createOmadaSiteOnly(existing.name || companyName);
        if (omadaSiteId) {
          return prisma.site.update({
            where: { id: existing.id },
            data: { omadaSiteId },
          });
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
    return OmadaClient.post(
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/cmd/devices/${deviceMac}/reboot`,
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
   * Adopt a device into a site on Omada Controller.
   * The device must already be connected to the network and visible to the controller.
   * Returns true on success, false if controller failed (DB is still updated by caller).
   */
  static async adoptDevice(omadaSiteId: string, deviceMac: string): Promise<boolean> {
    try {
      const res = await OmadaClient.post<{ errorCode: number }>(
        `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/cmd/devices/${deviceMac}/adopt`,
        {}
      );
      return res.errorCode === 0;
    } catch (err) {
      console.error("[OmadaService] adoptDevice failed:", err);
      return false;
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

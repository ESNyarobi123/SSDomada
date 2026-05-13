import { OmadaClient } from "@/server/lib/omada-client";
import { prisma } from "@/server/lib/prisma";
import type { OmadaSite, OmadaDevice, OmadaClient as OmadaClientType, OmadaApiResponse } from "@/types/omada";

const OMADA_CONTROLLER_ID = process.env.OMADA_CONTROLLER_ID || "";

export type OmadaSiteLinkSource = "db" | "omada_match" | "omada_created" | "unavailable";

/** Outcome of Omada Open API SSID create (`createSsid`). */
export type OmadaCreateSsidResult = {
  omadaSsidId: string | null;
  errorCode?: number;
  msg?: string;
};

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

  /** 12 hex chars for MAC equality checks (Omada may use colons or hyphens). */
  static comparableMac(mac: string | null | undefined): string {
    if (!mac) return "";
    return mac.toUpperCase().replace(/[:-]/g, "");
  }

  /** MAC string from an Omada device row (field names differ by controller / firmware). */
  static macFromOmadaDeviceRow(d: OmadaDevice | Record<string, unknown>): string {
    const o = d as Record<string, unknown>;
    const v = o.mac ?? o.macAddr ?? o.deviceMac ?? o.apMac;
    return typeof v === "string" ? v : "";
  }

  static omadaRowMatchesMac(row: unknown, dbMac: string): boolean {
    const key = OmadaService.comparableMac(OmadaService.macFromOmadaDeviceRow(row as OmadaDevice));
    return key.length === 12 && key === OmadaService.comparableMac(dbMac);
  }

  /**
   * List devices for a specific site from Omada Controller.
   * Many Omada builds return an empty first page unless `page` and `pageSize` are set (same as sites list).
   */
  static async listDevices(omadaSiteId: string): Promise<OmadaDevice[]> {
    const acc: OmadaDevice[] = [];
    let page = 1;
    const pageSize = 500;

    for (let guard = 0; guard < 40; guard++) {
      const res = await OmadaClient.get<OmadaApiResponse<OmadaDevice>>(
        `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/devices?page=${page}&pageSize=${pageSize}`
      );

      if (typeof res?.errorCode === "number" && res.errorCode !== 0) {
        console.warn("[OmadaService] listDevices non-zero errorCode:", res.errorCode, res.msg);
        break;
      }

      const batch = Array.isArray(res?.result?.data) ? res.result.data : [];
      acc.push(...batch);

      const total = res?.result?.totalRows;
      if (typeof total === "number" && acc.length >= total) break;
      if (batch.length < pageSize) break;
      page += 1;
    }

    return acc;
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
   * Open API: POST .../sites/{siteId}/devices/{AA-BB-CC-DD-EE-FF}/reboot
   */
  static async rebootDevice(omadaSiteId: string, deviceMac: string) {
    const macHyp = OmadaService.normalizeMacForOmadaDevicePathHyphen(deviceMac);
    return OmadaClient.post(
      `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/devices/${macHyp}/reboot`,
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

  /** Some controller builds expect hyphenated MAC in `/cmd/devices/{mac}/…` paths (OpenAPI examples use AA-BB-…). */
  static normalizeMacForOmadaDevicePathHyphen(mac: string): string {
    const hex = mac.replace(/[:-]/g, "").toUpperCase();
    if (!/^[0-9A-F]{12}$/.test(hex)) return mac.trim();
    return hex.match(/.{2}/g)!.join("-");
  }

  /**
   * Adopt a device into a site on Omada Controller.
   * The device must already be connected to the network and visible to the controller.
   *
   * **Primary:** Omada Open API `POST .../sites/{siteId}/devices/{AA-BB-...}/start-adopt` (documented MAC format).
   * **Fallback:** legacy `POST .../cmd/devices/{mac}/adopt` (colon or hyphen) for older deployments.
   *
   * `start-adopt` returns `errorCode === 0` when the command is accepted; use Omada UI or `listDevices` to confirm adoption finished.
   *
   * @param deviceCreds Optional AP web UI username/password (both required together). Overrides `OMADA_DEVICE_USERNAME` / `OMADA_DEVICE_PASSWORD` when set.
   */
  static async adoptDevice(
    omadaSiteId: string,
    deviceMac: string,
    deviceCreds?: { username?: string; password?: string }
  ): Promise<{
    adopted: boolean;
    message?: string;
    errorCode?: number;
  }> {
    const macSeg = OmadaService.normalizeMacForOmadaDevicePath(deviceMac);

    const parseResult = (res: Record<string, unknown>): { adopted: boolean; message?: string; errorCode?: number } => {
      const ec = res.errorCode;
      if (ec === 0) return { adopted: true };
      const msg = typeof res.msg === "string" ? res.msg.trim() : "";
      const blob = JSON.stringify(res);
      return {
        adopted: false,
        errorCode: typeof ec === "number" ? ec : undefined,
        message:
          msg ||
          (typeof ec === "number"
            ? `Omada returned errorCode ${ec}`
            : `Omada adopt did not succeed (${blob.slice(0, 280)})`),
      };
    };

    const shouldTryV2 = (message?: string) =>
      process.env.OMADA_ADOPT_TRY_V2 === "true" || (!!message && /404|Not Found|"status":\s*404/i.test(message));

    const macHyp = OmadaService.normalizeMacForOmadaDevicePathHyphen(deviceMac);
    const tryLegacyCmdAdopt = async (seg: string) => {
      const v1Path = `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/cmd/devices/${seg}/adopt`;
      const v2Path = `/openapi/v2/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/cmd/devices/${seg}/adopt`;
      const res = (await OmadaClient.post<Record<string, unknown>>(v1Path, {})) as Record<string, unknown>;
      const first = parseResult(res);
      if (first.adopted) return first;
      if (shouldTryV2(first.message)) {
        try {
          const res2 = (await OmadaClient.post<Record<string, unknown>>(v2Path, {})) as Record<string, unknown>;
          const second = parseResult(res2);
          if (second.adopted) return second;
          return {
            adopted: false,
            message: `v1: ${first.message || "failed"} · v2: ${second.message || "failed"}`,
            errorCode: second.errorCode ?? first.errorCode,
          };
        } catch (e2) {
          const m2 = e2 instanceof Error ? e2.message : String(e2);
          return {
            adopted: false,
            message: `v1: ${first.message || "failed"} · v2 request error: ${m2}`,
            errorCode: first.errorCode,
          };
        }
      }
      return first;
    };

    try {
      const startPath = `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/devices/${macHyp}/start-adopt`;
      const adoptBody: Record<string, unknown> = {};
      const u = deviceCreds?.username?.trim() || process.env.OMADA_DEVICE_USERNAME;
      const p = deviceCreds?.password || process.env.OMADA_DEVICE_PASSWORD;
      if (u) adoptBody.username = u;
      if (p) adoptBody.password = p;

      const startRes = (await OmadaClient.post<Record<string, unknown>>(startPath, adoptBody)) as Record<string, unknown>;
      const startParsed = parseResult(startRes);
      if (startParsed.adopted) return startParsed;

      const legacyColon = await tryLegacyCmdAdopt(macSeg);
      if (legacyColon.adopted) return legacyColon;

      const looks404 = /404|Not Found|"status":\s*404/i.test(legacyColon.message || "");
      if (looks404 && macHyp !== macSeg) {
        const legacyHyphen = await tryLegacyCmdAdopt(macHyp);
        if (legacyHyphen.adopted) return legacyHyphen;
        return {
          adopted: false,
          message: `start-adopt: ${startParsed.message || "failed"} · legacy colon: ${legacyColon.message || "failed"} · legacy hyphen: ${legacyHyphen.message || "failed"}`,
          errorCode: legacyHyphen.errorCode ?? legacyColon.errorCode ?? startParsed.errorCode,
        };
      }

      return {
        adopted: false,
        message: `start-adopt: ${startParsed.message || "failed"} · legacy: ${legacyColon.message || "failed"}`,
        errorCode: legacyColon.errorCode ?? startParsed.errorCode,
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
      const target = OmadaService.comparableMac(mac);
      if (target.length !== 12) return null;
      return devices.find((d) => OmadaService.omadaRowMatchesMac(d, mac)) || null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // SSID / WLAN
  // ============================================================

  /** Omada Open API: SSIDs live under a WLAN group (`wlanId`), not `/setting/wlans/ssids`. */
  static async listWlanGroupsForSite(omadaSiteId: string): Promise<{ id: string; name?: string }[]> {
    for (const apiVer of ["v1", "v2"] as const) {
      try {
        const res = await OmadaClient.get<{
          errorCode: number;
          msg?: string;
          result?: unknown;
        }>(
          `/openapi/${apiVer}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/wireless-network/wlans`
        );
        if (typeof res?.errorCode === "number" && res.errorCode !== 0) {
          console.warn("[OmadaService] listWlanGroupsForSite rejected:", apiVer, res.errorCode, res.msg);
          continue;
        }
        const rows = OmadaService.coerceOmadaListPayload(res?.result);
        const groups = rows
          .map((row) => ({
            id: OmadaService.pickWlanGroupId(row),
            name: typeof row.name === "string" ? row.name : undefined,
          }))
          .filter((w) => w.id.length > 0);
        if (groups.length > 0) return groups;
      } catch (err) {
        console.warn("[OmadaService] listWlanGroupsForSite failed:", apiVer, err);
      }
    }
    return [];
  }

  private static coerceOmadaListPayload(result: unknown): Record<string, unknown>[] {
    if (Array.isArray(result)) return result as Record<string, unknown>[];
    if (!result || typeof result !== "object") return [];
    const o = result as Record<string, unknown>;
    for (const key of ["data", "list", "records", "items", "rows", "wlanGroups", "result"]) {
      const v = o[key];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
        return v as Record<string, unknown>[];
      }
    }
    for (const v of Object.values(o)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null && !Array.isArray(v[0])) {
        return v as Record<string, unknown>[];
      }
    }
    return [];
  }

  private static pickWlanGroupId(row: Record<string, unknown>): string {
    for (const k of ["wlanId", "wlanGroupKey", "wlanGroupId", "groupId", "key", "groupKey", "id"]) {
      const v = row[k];
      if (typeof v === "string" && v.length > 0) return v;
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    return "";
  }

  private static pickDefaultWlanGroup(groups: { id: string; name?: string }[]): { id: string; name?: string } | null {
    if (!groups.length) return null;
    const byName = groups.find((g) => /default/i.test(g.name || ""));
    return byName || groups[0];
  }

  /** Spring MVC JSON error wrapper (HTTP 4xx/5xx) instead of `{ errorCode }`. */
  private static isSpringJsonError(data: unknown): data is { status: number; error?: string; path?: string; message?: string } {
    if (!data || typeof data !== "object") return false;
    const o = data as Record<string, unknown>;
    return typeof o.status === "number" && typeof o.error === "string";
  }

  /**
   * List SSIDs in a WLAN group (Open API). `page` / `pageSize` are required by many Omada builds.
   */
  private static async listSsidsInWlanGroup(omadaSiteId: string, wlanId: string): Promise<Record<string, unknown>[]> {
    for (const apiVer of ["v1", "v2"] as const) {
      try {
        const res = await OmadaClient.get<{
          errorCode?: number;
          msg?: string;
          result?: unknown;
        }>(
          `/openapi/${apiVer}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/wireless-network/wlans/${wlanId}/ssids?page=1&pageSize=100`
        );
        if (typeof res?.errorCode === "number" && res.errorCode !== 0) continue;
        const rows = OmadaService.coerceOmadaListPayload(res?.result);
        if (rows.length > 0) return rows;
      } catch {
        /* try next */
      }
    }
    return [];
  }

  private static pickRateLimitIdFromSsidRow(row: Record<string, unknown>): string | null {
    const rl = row.rateLimit;
    const srl = row.ssidRateLimit;
    const a = rl && typeof rl === "object" ? (rl as { rateLimitId?: unknown }).rateLimitId : undefined;
    const b = srl && typeof srl === "object" ? (srl as { rateLimitId?: unknown }).rateLimitId : undefined;
    for (const v of [a, b]) {
      if (typeof v === "string" && v.length > 0) return v;
    }
    return null;
  }

  /** Copy a rate-limit profile id from an existing SSID (Omada often requires this on create). */
  private static async borrowRateLimitIdFromExistingSsid(
    omadaSiteId: string,
    wlanId: string
  ): Promise<string | null> {
    const rows = await OmadaService.listSsidsInWlanGroup(omadaSiteId, wlanId);
    for (const row of rows) {
      const id = OmadaService.pickRateLimitIdFromSsidRow(row);
      if (id) return id;
    }
    return null;
  }

  /**
   * Omada SDN / Open API SSID create shape (see TP-Link Omada Web API docs / community API-REFERENCE).
   * `band` bitmask: 1 = 2.4 GHz, 2 = 5 GHz, 3 = both.
   */
  private static buildSsdnStyleOpenApiCreateSsidBody(
    input: {
      ssidName: string;
      password?: string | null;
      isHidden?: boolean;
      band?: "2.4GHz" | "5GHz" | "both";
      vlanId?: number | null;
      portalEnabled?: boolean;
    },
    rateLimitId: string | null
  ): Record<string, unknown> {
    const bandInt = input.band === "both" ? 3 : input.band === "5GHz" ? 2 : 1;
    const broadcast = !(input.isHidden ?? false);
    const pwd = input.password || undefined;
    const vlanId = input.vlanId ?? undefined;
    const portalOpen = input.portalEnabled ?? !pwd;

    const body: Record<string, unknown> = {
      name: input.ssidName,
      band: bandInt,
      type: 0,
      guestNetEnable: false,
      security: pwd ? 3 : 0,
      broadcast,
      vlanSetting: vlanId ? { mode: 1, customConfig: { vlanId } } : { mode: 0 },
      wlanScheduleEnable: false,
      macFilterEnable: false,
      wlanId: "",
      enable11r: false,
      pmfMode: 3,
      multiCastSetting: {
        multiCastEnable: true,
        arpCastEnable: true,
        filterEnable: false,
        ipv6CastEnable: true,
        channelUtil: 100,
      },
      wpaPsk: pwd ? [2, 3] : undefined,
      deviceType: 1,
      dhcpOption82: { dhcpEnable: false },
      greEnable: false,
      prohibitWifiShare: false,
      mloEnable: false,
      rateAndBeaconCtrl: {
        rate2gCtrlEnable: false,
        rate5gCtrlEnable: false,
        rate6gCtrlEnable: false,
      },
    };

    if (pwd) {
      body.pskSetting = {
        securityKey: pwd,
        encryptionPsk: 3,
        versionPsk: 2,
        gikRekeyPskEnable: false,
      };
    } else {
      body.portalEnable = portalOpen;
    }

    if (rateLimitId) {
      body.rateLimit = { rateLimitId };
      body.ssidRateLimit = { rateLimitId };
    }

    return OmadaService.omitUndefinedRecord(body);
  }

  /** Omada controller builds differ on SSID create payload — try several Open-API-shaped bodies. */
  private static buildCreateSsidBodyCandidates(
    input: {
      ssidName: string;
      password?: string | null;
      isHidden?: boolean;
      band?: "2.4GHz" | "5GHz" | "both";
      vlanId?: number | null;
      portalEnabled?: boolean;
    },
    rateLimitId: string | null
  ): Record<string, unknown>[] {
    const bandMap: Record<string, number[]> = {
      "2.4GHz": [0],
      "5GHz": [1],
      both: [0, 1],
    };
    const wlanBandArr = bandMap[input.band || "2.4GHz"];
    /** Bitmask for `band` integer field: 1 = 2.4 GHz, 2 = 5 GHz, 3 = both (Omada SDN). */
    const bandInt = input.band === "both" ? 3 : input.band === "5GHz" ? 2 : 1;
    const hidden = input.isHidden ?? false;
    const pwd = input.password || undefined;
    const securityStr = pwd ? "wpaPersonal" : "none";
    const vlanId = input.vlanId ?? undefined;
    const portalOpen = input.portalEnabled ?? !pwd;

    const out: Record<string, unknown>[] = [];

    // 0–1: Full SDN-style payloads (preferred when Open API matches controller Web API shape)
    out.push(OmadaService.buildSsdnStyleOpenApiCreateSsidBody(input, rateLimitId));
    if (rateLimitId) {
      out.push(OmadaService.buildSsdnStyleOpenApiCreateSsidBody(input, null));
    }

    // Omada Open API requires numeric `band` (e.g. 3 = 2.4G+5G); `wlanBand` alone is not enough on many builds.
    const withBand = (b: Record<string, unknown>) =>
      OmadaService.omitUndefinedRecord({ ...b, band: bandInt });

    // 2: Array wlanBand + required `band`
    out.push(
      withBand({
        name: input.ssidName,
        wlanBand: wlanBandArr,
        hidden,
        security: securityStr,
        pskCipher: pwd ? "wpa2-psk" : undefined,
        pskKey: pwd,
        vlanId,
        ...(pwd ? {} : { portalEnable: portalOpen }),
      })
    );

    // 2: Integer wlanBand + `band`
    out.push(
      withBand({
        name: input.ssidName,
        wlanBand: bandInt,
        hidden,
        security: securityStr,
        pskCipher: pwd ? "wpa2-psk" : undefined,
        pskKey: pwd,
        vlanId,
      })
    );

    // 3: `band` only (no wlanBand) — some controllers reject duplicate band hints
    out.push(
      OmadaService.omitUndefinedRecord({
        name: input.ssidName,
        band: bandInt,
        hidden,
        security: securityStr,
        pskCipher: pwd ? "wpa2-psk" : undefined,
        pskKey: pwd,
        vlanId,
        ...(pwd ? {} : { portalEnable: portalOpen }),
      })
    );

    // 4: Array wlanBand, no pskCipher
    out.push(
      withBand({
        name: input.ssidName,
        wlanBand: wlanBandArr,
        hidden,
        security: securityStr,
        pskKey: pwd,
        vlanId,
      })
    );

    // 5: Alternate security string + passphrase key name
    if (pwd) {
      out.push(
        withBand({
          name: input.ssidName,
          wlanBand: wlanBandArr,
          hidden,
          security: "wpapsk",
          passphrase: pwd,
          vlanId,
        })
      );
    }

    // 6: Integer security (WPA2/WPA3 style) + int band — only when password set
    if (pwd) {
      out.push(
        withBand({
          name: input.ssidName,
          wlanBand: bandInt,
          hidden,
          security: 3,
          pskKey: pwd,
          vlanId,
        })
      );
    }

    // Dedupe identical JSON shapes
    const seen = new Set<string>();
    return out.filter((b) => {
      const k = JSON.stringify(b);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  private static extractOmadaEntityIdFromPostResult(result: unknown): string | null {
    if (typeof result === "string" && result.length > 0) return result;
    if (result && typeof result === "object") {
      const o = result as Record<string, unknown>;
      const id = o.id ?? o.ssidId ?? o.ssidID ?? o.wlanId;
      if (typeof id === "string" && id.length > 0) return id;
      if (o.data && typeof o.data === "object") {
        const d = o.data as Record<string, unknown>;
        const id2 = d.id ?? d.ssidId ?? d.ssidID;
        if (typeof id2 === "string" && id2.length > 0) return id2;
      }
    }
    return null;
  }

  private static omitUndefinedRecord(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  }

  /**
   * Omada "quick create SSID" (no wlanId). Used when the site has no WLAN group list yet.
   */
  private static async tryQuickCreateSsid(
    omadaSiteId: string,
    input: {
      ssidName: string;
      password?: string | null;
      isHidden?: boolean;
      band?: "2.4GHz" | "5GHz" | "both";
    }
  ): Promise<OmadaCreateSsidResult> {
    let last: OmadaCreateSsidResult = { omadaSsidId: null, msg: "quick-create-ssid: no compatible response" };
    for (const apiVer of ["v1", "v2"] as const) {
      const path = `/openapi/${apiVer}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/wireless-network/quick-create-ssid`;
      const attempts: Record<string, unknown>[] = [
        { name: input.ssidName, password: input.password || "" },
        { name: input.ssidName, wlanPassword: input.password || "" },
        { ssidName: input.ssidName, password: input.password || "" },
      ];
      for (const raw of attempts) {
        try {
          const res = await OmadaClient.post<{ errorCode?: number; msg?: string; result?: unknown }>(path, raw);
          const id = OmadaService.extractOmadaEntityIdFromPostResult(res?.result);
          if (id) return { omadaSsidId: id };
          if (res?.errorCode === 0) {
            last = {
              omadaSsidId: null,
              errorCode: 0,
              msg: res.msg || "Omada returned success but no SSID id in quick-create response",
            };
          } else {
            const rawJson = JSON.stringify(res).slice(0, 600);
            last = {
              omadaSsidId: null,
              errorCode: typeof res?.errorCode === "number" ? res.errorCode : -1,
              msg: res.msg || `quick-create: ${rawJson}`,
            };
          }
        } catch (err) {
          last = { omadaSsidId: null, msg: err instanceof Error ? err.message : String(err) };
        }
      }
    }
    return last;
  }

  /**
   * Create a wireless network (SSID) on a site (Omada Open API).
   * Picks the default WLAN group (name contains "Default" if present, else the first group).
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
  ): Promise<OmadaCreateSsidResult> {
    try {
      const groups = await this.listWlanGroupsForSite(omadaSiteId);
      const wlan = this.pickDefaultWlanGroup(groups);
      if (!wlan) {
        console.warn("[OmadaService] createSsid: no WLAN groups from Omada; trying quick-create-ssid");
        return await this.tryQuickCreateSsid(omadaSiteId, input);
      }

      const rateLimitId = await OmadaService.borrowRateLimitIdFromExistingSsid(omadaSiteId, wlan.id);

      const bodies = OmadaService.buildCreateSsidBodyCandidates(input, rateLimitId);
      let lastErr: OmadaCreateSsidResult = { omadaSsidId: null, msg: "No SSID create attempts" };

      for (const apiVer of ["v1", "v2"] as const) {
        const path = `/openapi/${apiVer}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/wireless-network/wlans/${wlan.id}/ssids`;
        for (let i = 0; i < bodies.length; i++) {
          const body = bodies[i];
          const res = await OmadaClient.post<{
            errorCode?: number;
            msg?: string;
            result?: unknown;
            status?: number;
            error?: string;
            path?: string;
          }>(path, body);

          const idEarly = OmadaService.extractOmadaEntityIdFromPostResult(res?.result);
          if (idEarly) {
            return { omadaSsidId: idEarly };
          }

          const code = res?.errorCode;
          if (code === 0) {
            const snippet = JSON.stringify(res.result)?.slice(0, 800);
            lastErr = {
              omadaSsidId: null,
              errorCode: 0,
              msg: snippet
                ? `Omada accepted the request but no SSID id was found (result=${snippet})`
                : "Omada accepted the request but returned an empty result for SSID id",
            };
            continue;
          }

          if (OmadaService.isSpringJsonError(res)) {
            lastErr = {
              omadaSsidId: null,
              errorCode: res.status,
              msg: `${res.error || "HTTP"} ${res.status}: ${res.message || res.path || ""}`.trim(),
            };
            continue;
          }

          const raw = JSON.stringify(res).slice(0, 900);
          lastErr = {
            omadaSsidId: null,
            errorCode: typeof code === "number" ? code : -1,
            msg: res.msg || (typeof code === "number" ? `Omada errorCode=${code}` : `Unexpected Omada response: ${raw}`),
          };
        }
      }

      console.error("[OmadaService] createSsid: all body variants failed for wlan", wlan.id);
      return lastErr;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[OmadaService] createSsid failed:", err);
      return { omadaSsidId: null, msg: message };
    }
  }

  /**
   * Delete an SSID on Omada Controller.
   * Tries each WLAN group until one succeeds (SSID ids are scoped per group in Open API).
   */
  static async deleteSsid(omadaSiteId: string, omadaSsidId: string): Promise<boolean> {
    const base = `/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}`;

    try {
      const groups = await this.listWlanGroupsForSite(omadaSiteId);
      for (const w of groups) {
        try {
          const res = await OmadaClient.delete<{ errorCode: number; msg?: string }>(
            `${base}/wireless-network/wlans/${w.id}/ssids/${omadaSsidId}`
          );
          if (res.errorCode === 0) return true;
        } catch {
          /* try next wlan */
        }
      }

      const legacy = await OmadaClient.delete<{ errorCode: number }>(
        `${base}/setting/wlans/ssids/${omadaSsidId}`
      );
      return legacy.errorCode === 0;
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
  ): Promise<{ ok: boolean; errorCode?: number; msg?: string }> {
    const ids = opts.ssidIds || [];
    const baseFields = {
      name: opts.name,
      authType: "externalRadius",
      portalType: "external",
      externalUrl: opts.portalUrl,
      httpsRedirection: true,
      authenticationTimeout: 480,
    } as const;

    const bodyVariants: Record<string, unknown>[] = [
      { ...baseFields, ssids: ids },
      { ...baseFields, ssidIds: ids },
      { ...baseFields, ssids: ids, ssidIds: ids },
    ];
    const seen = new Set<string>();
    const uniqueBodies = bodyVariants.filter((b) => {
      const k = JSON.stringify(b);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let last: { errorCode?: number; msg?: string } = {};
    for (const ver of ["v1", "v2"] as const) {
      const path = `/openapi/${ver}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/portals`;
      for (const body of uniqueBodies) {
        try {
          const res = await OmadaClient.post<{ errorCode: number; msg?: string }>(path, body);
          last = { errorCode: res.errorCode, msg: typeof res.msg === "string" ? res.msg : undefined };
          if (res.errorCode === 0) return { ok: true };
        } catch (err) {
          console.error("[OmadaService] setExternalPortal attempt failed:", ver, err);
          last = { msg: err instanceof Error ? err.message : String(err) };
        }
      }
    }
    return {
      ok: false,
      errorCode: last.errorCode,
      msg: last.msg,
    };
  }

  private static normalizeExternalPortalUrl(u: string): string {
    return u.trim().replace(/\/+$/, "").toLowerCase();
  }

  private static rowLooksLikePortalRow(row: unknown): row is Record<string, unknown> {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    const id =
      typeof r.portalId === "string"
        ? r.portalId
        : typeof r.portalID === "string"
          ? r.portalID
          : typeof r.id === "string"
            ? r.id
            : "";
    if (!id) return false;
    if (typeof r.externalUrl === "string" || typeof r.externalPortalUrl === "string") return true;
    if (r.authType != null || r.portalType != null) return true;
    return false;
  }

  private static collectArraysDeep(obj: unknown, depth: number, out: unknown[][]): void {
    if (depth < 0 || obj == null) return;
    if (Array.isArray(obj)) {
      out.push(obj);
      return;
    }
    if (typeof obj !== "object") return;
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(v)) out.push(v);
      else OmadaService.collectArraysDeep(v, depth - 1, out);
    }
  }

  private static extractPortalRows(res: unknown): Record<string, unknown>[] {
    if (!res || typeof res !== "object") return [];
    const o = res as { errorCode?: number; result?: unknown };
    if (o.errorCode !== undefined && o.errorCode !== 0) return [];
    const result = o.result;
    if (Array.isArray(result)) return result as Record<string, unknown>[];
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      for (const key of ["data", "list", "rows", "records", "portals", "items"] as const) {
        if (Array.isArray(r[key])) return r[key] as Record<string, unknown>[];
      }
    }
    if (result && typeof result === "object") {
      const nested: unknown[][] = [];
      OmadaService.collectArraysDeep(result, 10, nested);
      for (const arr of nested) {
        const portalish = (arr as unknown[]).filter(OmadaService.rowLooksLikePortalRow) as Record<string, unknown>[];
        if (portalish.length > 0) return portalish;
      }
    }
    return [];
  }

  /** List portal profiles configured on an Omada site (Open API shape varies by controller version). */
  static async listSitePortals(omadaSiteId: string): Promise<Record<string, unknown>[]> {
    for (const ver of ["v1", "v2"] as const) {
      const bases = [
        `/openapi/${ver}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/portals?currentPage=1&currentPageSize=100`,
        `/openapi/${ver}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/portals?page=1&pageSize=100`,
        `/openapi/${ver}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/portals?page=1&pageSize=500`,
        `/openapi/${ver}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/portals`,
      ];
      for (const path of bases) {
        try {
          const res = await OmadaClient.get<unknown>(path);
          const rows = OmadaService.extractPortalRows(res);
          if (rows.length > 0) return rows;
        } catch {
          /* try next */
        }
      }
    }
    return [];
  }

  private static pickPortalRowId(row: Record<string, unknown>): string | null {
    const v = row.portalId ?? row.portalID ?? row.id;
    return typeof v === "string" && v.length > 0 ? v : null;
  }

  private static pickPortalExternalUrl(row: Record<string, unknown>): string {
    const u = row.externalUrl ?? row.externalPortalUrl ?? row.externalWebPortalUrl ?? row.portalUrl ?? row.url;
    return typeof u === "string" ? u : "";
  }

  private static pickPortalSsids(row: Record<string, unknown>): string[] {
    const s = row.ssids ?? row.ssidIds;
    if (!Array.isArray(s)) return [];
    const out: string[] = [];
    for (const item of s) {
      if (typeof item === "string") out.push(item);
      else if (item && typeof item === "object" && typeof (item as { id?: string }).id === "string") {
        out.push((item as { id: string }).id);
      }
    }
    return out.filter(Boolean);
  }

  private static async tryPatchPortalWithSsids(
    omadaSiteId: string,
    portalId: string,
    merged: string[],
    portalName: string,
    portalUrl: string
  ): Promise<boolean> {
    const full = {
      name: portalName,
      externalUrl: portalUrl,
      authType: "externalRadius",
      portalType: "external",
      httpsRedirection: true,
      authenticationTimeout: 480,
    } as const;
    const patchBodies: Record<string, unknown>[] = [
      { ssids: merged },
      { ssidIds: merged },
      { ssids: merged, ssidIds: merged },
      { ...full, ssids: merged },
      { ...full, ssidIds: merged },
      { ...full, ssids: merged, ssidIds: merged },
    ];
    for (const ver of ["v1", "v2"] as const) {
      const basePath = `/openapi/${ver}/${OMADA_CONTROLLER_ID}/sites/${omadaSiteId}/setting/portals/${portalId}`;
      for (const body of patchBodies) {
        try {
          const res = await OmadaClient.patch<{ errorCode?: number; msg?: string }>(basePath, body);
          if (res?.errorCode === 0) return true;
        } catch {
          /* try next */
        }
        try {
          const resPut = await OmadaClient.put<{ errorCode?: number; msg?: string }>(basePath, body);
          if (resPut?.errorCode === 0) return true;
        } catch {
          /* try next */
        }
      }
    }
    return false;
  }

  /**
   * Attach Omada WLAN SSIDs (open / portal) to the site's external portal and keep portal URL/name in sync.
   * Pre-authentication allowlist is not exposed reliably via Open API — configure in Omada UI (see docs/captive-preauth-allowlist.md).
   */
  static async syncExternalPortalWithOpenSsids(
    omadaSiteId: string,
    opts: { portalUrl: string; portalName: string; omadaSsidIds: string[] }
  ): Promise<{ ok: boolean; method?: "patch" | "post" | "skipped"; message?: string }> {
    const ids = [...new Set(opts.omadaSsidIds.filter(Boolean))];
    if (ids.length === 0) {
      return { ok: false, method: "skipped", message: "No Omada SSID ids to attach" };
    }
    const target = OmadaService.normalizeExternalPortalUrl(opts.portalUrl);

    try {
      const rows = await OmadaService.listSitePortals(omadaSiteId);
      let match = rows.find((r) => {
        const u = OmadaService.normalizeExternalPortalUrl(OmadaService.pickPortalExternalUrl(r));
        return u.length > 0 && u === target;
      });
      if (!match && rows.length === 1) {
        match = rows[0];
      }

      const portalId = match ? OmadaService.pickPortalRowId(match) : null;
      const existing = match ? OmadaService.pickPortalSsids(match) : [];
      const merged = [...new Set([...existing, ...ids])];

      if (portalId) {
        const patched = await OmadaService.tryPatchPortalWithSsids(
          omadaSiteId,
          portalId,
          merged,
          opts.portalName,
          opts.portalUrl
        );
        if (patched) return { ok: true, method: "patch" };
        console.warn("[OmadaService] syncExternalPortalWithOpenSsids: PATCH failed; portal id=", portalId);
        return { ok: false, method: "skipped", message: "Found portal but PATCH ssids failed (check controller API version)." };
      }

      const postRes = await OmadaService.setExternalPortal(omadaSiteId, {
        name: opts.portalName,
        portalUrl: opts.portalUrl,
        ssidIds: merged,
      });
      if (postRes.ok) return { ok: true, method: "post" };

      if (rows.length === 0) {
        const bare = await OmadaService.setExternalPortal(omadaSiteId, {
          name: opts.portalName,
          portalUrl: opts.portalUrl,
          ssidIds: [],
        });
        if (bare.ok) {
          const rowsAfter = await OmadaService.listSitePortals(omadaSiteId);
          let match2 = rowsAfter.find((r) => {
            const u = OmadaService.normalizeExternalPortalUrl(OmadaService.pickPortalExternalUrl(r));
            return u.length > 0 && u === target;
          });
          if (!match2 && rowsAfter.length === 1) {
            match2 = rowsAfter[0];
          }
          const portalId2 = match2 ? OmadaService.pickPortalRowId(match2) : null;
          if (
            portalId2 &&
            (await OmadaService.tryPatchPortalWithSsids(
              omadaSiteId,
              portalId2,
              merged,
              opts.portalName,
              opts.portalUrl
            ))
          ) {
            return { ok: true, method: "post" };
          }
        }
      }

      return {
        ok: false,
        method: "post",
        message:
          postRes.msg ||
          (postRes.errorCode != null ? `POST portals errorCode=${postRes.errorCode}` : "POST portals failed (list empty or Omada rejected)."),
      };
    } catch (err) {
      console.error("[OmadaService] syncExternalPortalWithOpenSsids failed:", err);
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}

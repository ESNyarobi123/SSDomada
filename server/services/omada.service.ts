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

  /** Omada controller builds differ on SSID create payload — try several Open-API-shaped bodies. */
  private static buildCreateSsidBodyCandidates(input: {
    ssidName: string;
    password?: string | null;
    isHidden?: boolean;
    band?: "2.4GHz" | "5GHz" | "both";
    vlanId?: number | null;
    portalEnabled?: boolean;
  }): Record<string, unknown>[] {
    const bandMap: Record<string, number[]> = {
      "2.4GHz": [0],
      "5GHz": [1],
      both: [0, 1],
    };
    const wlanBandArr = bandMap[input.band || "2.4GHz"];
    const bandInt = input.band === "both" ? 3 : input.band === "5GHz" ? 1 : 2;
    const hidden = input.isHidden ?? false;
    const pwd = input.password || undefined;
    const securityStr = pwd ? "wpaPersonal" : "none";
    const vlanId = input.vlanId ?? undefined;
    const portalOpen = input.portalEnabled ?? !pwd;

    const out: Record<string, unknown>[] = [];

    // Omada Open API requires numeric `band` (e.g. 3 = 2.4G+5G); `wlanBand` alone is not enough on many builds.
    const withBand = (b: Record<string, unknown>) =>
      OmadaService.omitUndefinedRecord({ ...b, band: bandInt });

    // 1: Array wlanBand + required `band`
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

      const bodies = OmadaService.buildCreateSsidBodyCandidates(input);
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

import { redis } from "./redis";

/**
 * Omada Controller — External Portal Server client (v5.0.15+ / v6.x).
 *
 * TP-Link documents the flow as:
 *   1. POST {controller}/{omadacId}/api/v2/hotspot/login
 *      → Hotspot Operator credentials → CSRF token + session cookie
 *   2. POST {controller}/{omadacId}/api/v2/hotspot/extPortal/auth
 *      → mark the client authenticated (authType 4)
 *
 * Reference: https://support.omadanetworks.com/en/document/13080/
 *
 * Required env:
 *   - OMADA_URL                e.g. https://server.ssdomada.site:8043
 *   - OMADA_CONTROLLER_ID      omadacId from the controller URL path
 *   - OMADA_HOTSPOT_USERNAME   Hotspot → Operators account (NOT admin login)
 *   - OMADA_HOTSPOT_PASSWORD
 *
 * Optional:
 *   - OMADA_HOTSPOT_TLS_INSECURE=true
 */

const OMADA_URL = (process.env.OMADA_URL || "").replace(/\/+$/, "");
const OMADA_CONTROLLER_ID = (process.env.OMADA_CONTROLLER_ID || "").trim().replace(/^\/+|\/+$/g, "");
const HOTSPOT_USERNAME = process.env.OMADA_HOTSPOT_USERNAME || "";
const HOTSPOT_PASSWORD = process.env.OMADA_HOTSPOT_PASSWORD || "";
const TLS_INSECURE = process.env.OMADA_HOTSPOT_TLS_INSECURE === "true";

const TOKEN_CACHE_KEY = "omada:hotspot:token";
const COOKIE_CACHE_KEY = "omada:hotspot:cookie";
const TOKEN_TTL_SECONDS = 20 * 60;

export interface OmadaPortalAuthInput {
  clientMac: string;
  apMac: string;
  ssidName: string;
  radioId: number;
  site: string;
  /**
   * Session duration in MILLISECONDS as supplied by callers. The actual
   * value sent to Omada depends on `OMADA_EXT_PORTAL_TIME_UNIT`
   * (`microsecond` default → multiplied by 1000; `millisecond` → sent
   * as-is). See `callExtPortalAuth`.
   */
  time: number;
}

export interface OmadaPortalAuthResult {
  ok: boolean;
  errorCode?: number;
  message?: string;
  raw?: unknown;
}

class OmadaPortalApiError extends Error {
  constructor(message: string, public httpStatus?: number, public body?: unknown) {
    super(message);
    this.name = "OmadaPortalApiError";
  }
}

interface CredentialBundle {
  token: string;
  cookie: string;
}

export class OmadaPortalClient {
  static isConfigured(): boolean {
    return Boolean(OMADA_URL && OMADA_CONTROLLER_ID && HOTSPOT_USERNAME && HOTSPOT_PASSWORD);
  }

  static async authorise(input: OmadaPortalAuthInput): Promise<OmadaPortalAuthResult> {
    if (!OmadaPortalClient.isConfigured()) {
      return {
        ok: false,
        message:
          "OMADA_URL, OMADA_CONTROLLER_ID, OMADA_HOTSPOT_USERNAME, OMADA_HOTSPOT_PASSWORD must be set",
      };
    }

    try {
      const creds = await OmadaPortalClient.getCredentials();
      let result = await OmadaPortalClient.callExtPortalAuth(input, creds);

      if (result.errorCode === -1 || result.errorCode === 401) {
        await OmadaPortalClient.invalidateCache();
        result = await OmadaPortalClient.callExtPortalAuth(
          input,
          await OmadaPortalClient.getCredentials(true),
        );
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error("[OmadaPortal] authorise failed:", message);
      return { ok: false, message };
    }
  }

  /**
   * Revoke an existing external-portal authorisation by re-calling
   * `extPortal/auth` with `time = 1` (effectively zero). Omada has no
   * dedicated deauth endpoint for external portals; this is the documented
   * trick to invalidate the session — the next packet from the client will
   * be intercepted by the captive portal again.
   *
   * Caller must supply the same `apMac`, `ssidName`, `radioId`, `site` that
   * were used during the original authorise call (we have them on
   * PortalSession).
   */
  static async deauthorise(
    input: Omit<OmadaPortalAuthInput, "time">,
  ): Promise<OmadaPortalAuthResult> {
    return OmadaPortalClient.authorise({ ...input, time: 1 });
  }

  /**
   * Call the legacy `unauthorize` endpoint the Omada controller's web UI
   * uses — i.e. the "Unauthorize" button in Site → Clients. This is the
   * ONLY thing that actually clears an active External Portal v2 auth
   * state, because the documented Open API does not expose an
   * unauthorize endpoint for clients.
   *
   * Uses the Hotspot Operator session (TPOMADA_SESSIONID cookie +
   * CSRF token) that we already maintain for extPortal/auth.
   *
   * Tries a small list of historically-documented paths so this keeps
   * working across controller versions:
   *   - /api/v2/sites/{siteId}/cmd/clients/{mac}/unauthorize
   *   - /api/v2/cmd/sites/{siteId}/clients/{mac}/unauthorize
   *   - /api/v2/hotspot/cmd/sites/{siteId}/clients/{mac}/unauthorize
   */
  static async unauthoriseClient(opts: {
    omadaSiteId: string;
    clientMac: string;
  }): Promise<{ ok: boolean; path: string; errorCode?: number; message?: string; httpStatus?: number }> {
    if (!OmadaPortalClient.isConfigured()) {
      return {
        ok: false,
        path: "(unconfigured)",
        message: "OMADA hotspot operator credentials not configured",
      };
    }

    const tryOnce = async (
      creds: CredentialBundle,
    ): Promise<{ ok: boolean; path: string; errorCode?: number; message?: string; httpStatus?: number }> => {
      const base = OmadaPortalClient.controllerBase();
      const paths = [
        `/api/v2/sites/${opts.omadaSiteId}/cmd/clients/${opts.clientMac}/unauthorize`,
        `/api/v2/cmd/sites/${opts.omadaSiteId}/clients/${opts.clientMac}/unauthorize`,
        `/api/v2/hotspot/cmd/sites/${opts.omadaSiteId}/clients/${opts.clientMac}/unauthorize`,
      ];

      let last: { ok: boolean; path: string; errorCode?: number; message?: string; httpStatus?: number } = {
        ok: false,
        path: paths[paths.length - 1],
        message: "no candidate path responded",
      };

      for (const path of paths) {
        const url = `${base}${path}`;
        try {
          const res = await fetchSafe(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Cookie: creds.cookie,
              "Csrf-Token": creds.token,
            },
            body: JSON.stringify({}),
          });

          let parsed: any = null;
          try {
            parsed = await res.json();
          } catch {
            parsed = null;
          }
          const errorCode = typeof parsed?.errorCode === "number" ? parsed.errorCode : undefined;
          const msg = typeof parsed?.msg === "string" ? parsed.msg : undefined;

          console.log(
            `[OmadaPortal] unauthorise path=${path} status=${res.status} errorCode=${errorCode ?? "?"} msg=${msg ?? "?"}`,
          );

          if (errorCode === 0) {
            return { ok: true, path, errorCode, message: msg, httpStatus: res.status };
          }

          last = { ok: false, path, errorCode, message: msg ?? `HTTP ${res.status}`, httpStatus: res.status };

          // 404 / "path not found" → try next candidate. Anything else is a real
          // failure (auth, permission, mac wrong) — bail out so logs are clean.
          const notFound =
            res.status === 404 ||
            errorCode === 404 ||
            errorCode === -44112 ||
            errorCode === undefined ||
            (typeof msg === "string" && /not\s*found|invalid\s*url|404/i.test(msg));
          if (!notFound) {
            return last;
          }
        } catch (err: any) {
          const message = err?.message || String(err);
          console.warn(`[OmadaPortal] unauthorise threw path=${path}: ${message}`);
          last = { ok: false, path, message };
        }
      }
      return last;
    };

    try {
      let creds = await OmadaPortalClient.getCredentials();
      let result = await tryOnce(creds);

      // CSRF / session expired → relogin once and retry the whole sequence.
      if (!result.ok && (result.errorCode === -1 || result.errorCode === 401 || result.httpStatus === 401)) {
        await OmadaPortalClient.invalidateCache();
        creds = await OmadaPortalClient.getCredentials(true);
        result = await tryOnce(creds);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, path: "(threw)", message };
    }
  }

  private static controllerBase(): string {
    if (!OMADA_URL) throw new OmadaPortalApiError("OMADA_URL is not set");
    if (!OMADA_CONTROLLER_ID) throw new OmadaPortalApiError("OMADA_CONTROLLER_ID is not set");
    if (OMADA_URL.endsWith(`/${OMADA_CONTROLLER_ID}`)) return OMADA_URL;
    return `${OMADA_URL}/${OMADA_CONTROLLER_ID}`;
  }

  private static async getCredentials(forceRefresh = false): Promise<CredentialBundle> {
    if (!forceRefresh) {
      const [token, cookie] = await Promise.all([
        redis.get(TOKEN_CACHE_KEY),
        redis.get(COOKIE_CACHE_KEY),
      ]);
      if (token && cookie) return { token, cookie };
    }
    return OmadaPortalClient.login();
  }

  private static async invalidateCache(): Promise<void> {
    await Promise.all([redis.del(TOKEN_CACHE_KEY), redis.del(COOKIE_CACHE_KEY)]);
  }

  /** POST /api/v2/hotspot/login */
  private static async login(): Promise<CredentialBundle> {
    const url = `${OmadaPortalClient.controllerBase()}/api/v2/hotspot/login`;
    const body = JSON.stringify({ name: HOTSPOT_USERNAME, password: HOTSPOT_PASSWORD });

    const res = await fetchSafe(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });

    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      throw new OmadaPortalApiError(`Hotspot login: non-JSON (status ${res.status})`, res.status);
    }

    if (parsed?.errorCode !== 0 || !parsed?.result?.token) {
      throw new OmadaPortalApiError(
        `Hotspot login rejected: ${parsed?.msg || `errorCode=${parsed?.errorCode}`}`,
        res.status,
        parsed,
      );
    }

    const setCookie = res.headers.get("set-cookie") || "";
    const cookie = parseSessionCookie(setCookie);
    if (!cookie) {
      throw new OmadaPortalApiError(
        "Hotspot login OK but no TPOMADA_SESSIONID / TPEAP_SESSIONID cookie",
        res.status,
        parsed,
      );
    }

    const token: string = parsed.result.token;
    await Promise.all([
      redis.set(TOKEN_CACHE_KEY, token, "EX", TOKEN_TTL_SECONDS),
      redis.set(COOKIE_CACHE_KEY, cookie, "EX", TOKEN_TTL_SECONDS),
    ]);
    return { token, cookie };
  }

  /**
   * POST /api/v2/hotspot/extPortal/auth
   *
   * Per TP-Link's docs the `time` field is "microseconds" — but their own
   * PHP code template names the variable `$milliseconds` and passes it
   * directly, which is one of the most common confusions when integrating
   * with Omada. Real-world testing on Omada v5.x suggests this field is
   * actually interpreted in **milliseconds** on some firmware versions.
   *
   * To stay safe across builds we expose a `OMADA_EXT_PORTAL_TIME_UNIT`
   * env var: set it to `millisecond` (recommended) if you find Omada keeps
   * authorising the client for far longer than your package duration. The
   * default behaviour (`microsecond`) matches the original docs.
   */
  private static async callExtPortalAuth(
    input: OmadaPortalAuthInput,
    creds: CredentialBundle,
  ): Promise<OmadaPortalAuthResult> {
    const url = `${OmadaPortalClient.controllerBase()}/api/v2/hotspot/extPortal/auth`;
    const unit = (process.env.OMADA_EXT_PORTAL_TIME_UNIT || "microsecond").toLowerCase();
    // input.time is already in MILLISECONDS (durationMs from callers).
    // microsecond mode: multiply by 1000.
    // millisecond mode: send as-is (Omada interprets directly as ms).
    const timeValue = unit === "millisecond" ? input.time : Math.round(input.time * 1000);

    const payload = {
      clientMac: input.clientMac,
      apMac: input.apMac,
      ssidName: input.ssidName,
      radioId: input.radioId,
      site: input.site,
      time: timeValue,
      authType: 4,
    };

    console.log(
      `[OmadaPortal] extPortal/auth mac=${input.clientMac} ap=${input.apMac} ssid=${input.ssidName} timeMs=${input.time} sent=${timeValue} unit=${unit}`,
    );

    const res = await fetchSafe(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: creds.cookie,
        "Csrf-Token": creds.token,
      },
      body: JSON.stringify(payload),
    });

    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      return {
        ok: false,
        message: `extPortal/auth: non-JSON (status ${res.status})`,
      };
    }

    const errorCode = typeof parsed?.errorCode === "number" ? parsed.errorCode : undefined;
    const msg = typeof parsed?.msg === "string" ? parsed.msg : undefined;

    if (errorCode === 0) {
      return { ok: true, errorCode, message: msg, raw: parsed };
    }

    return {
      ok: false,
      errorCode,
      message: msg || `extPortal/auth rejected (errorCode=${errorCode ?? "n/a"})`,
      raw: parsed,
    };
  }
}

async function fetchSafe(url: string, init: RequestInit): Promise<Response> {
  if (!TLS_INSECURE) return fetch(url, init);

  const { Agent, fetch: undiciFetch } = await import("undici");
  const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  const undiciInit = { ...(init as Record<string, unknown>), dispatcher };
  const res = await undiciFetch(url, undiciInit as unknown as Parameters<typeof undiciFetch>[1]);
  return res as unknown as Response;
}

/** v5.11+ uses TPOMADA_SESSIONID; older builds use TPEAP_SESSIONID. */
function parseSessionCookie(setCookieHeader: string): string | null {
  if (!setCookieHeader) return null;
  const match =
    setCookieHeader.match(/TPOMADA_SESSIONID=[^;]+/) ||
    setCookieHeader.match(/TPEAP_SESSIONID=[^;]+/);
  return match ? match[0] : null;
}

import { redis } from "./redis";

/**
 * Omada Controller — External Portal Server v2 client.
 *
 * Authorises captive-portal clients on the controller by performing the
 * documented two-step flow:
 *
 *   1. `POST {controller}/api/v2/hotspot/login`
 *      → log in with a Hotspot Operator account, returning a CSRF token in
 *        the body and a session cookie (`TPEAP_SESSIONID`) in `Set-Cookie`.
 *
 *   2. `POST {controller}/portal/auth?token=<csrf>` (with the session cookie)
 *      → tells Omada to mark the client MAC as authenticated, granting
 *        Internet access for the duration specified in `time` (milliseconds).
 *
 * The OpenAPI `/cmd/clients/{mac}/authorize` endpoint we previously used is
 * for the controller's built-in guest portal and does **not** work for
 * external portals. This client is the correct integration path.
 *
 * Token + cookie are cached in Redis to avoid re-logging in on every payment.
 *
 * Required env:
 *   - OMADA_URL              base URL of the controller (e.g. `https://omada.example.com:8043`)
 *   - OMADA_HOTSPOT_USERNAME hotspot operator username
 *   - OMADA_HOTSPOT_PASSWORD hotspot operator password
 *
 * Optional:
 *   - OMADA_HOTSPOT_TLS_INSECURE=true   allow self-signed certs (dev/staging)
 */

const OMADA_URL = (process.env.OMADA_URL || "").replace(/\/+$/, "");
const HOTSPOT_USERNAME = process.env.OMADA_HOTSPOT_USERNAME || "";
const HOTSPOT_PASSWORD = process.env.OMADA_HOTSPOT_PASSWORD || "";
const TLS_INSECURE = process.env.OMADA_HOTSPOT_TLS_INSECURE === "true";

const TOKEN_CACHE_KEY = "omada:hotspot:token";
const COOKIE_CACHE_KEY = "omada:hotspot:cookie";
/** Hotspot tokens generally live ~30 min; refresh aggressively to be safe. */
const TOKEN_TTL_SECONDS = 20 * 60;

export interface OmadaPortalAuthInput {
  /** Client MAC formatted as `AA-BB-CC-DD-EE-FF` (hyphen-separated, upper case). */
  clientMac: string;
  /** AP MAC formatted the same way. */
  apMac: string;
  /** SSID name from Omada redirect (`ssidName=...`). */
  ssidName: string;
  /** Radio band: `0` = 2.4 GHz, `1` = 5 GHz, `2` = 6 GHz. */
  radioId: number;
  /** Omada-side site id from the `site=` redirect query parameter. */
  site: string;
  /** Authorization duration in milliseconds. */
  time: number;
  /** Optional: forward the raw `t` (timestamp) Omada gave us; some builds expect it. */
  t?: string;
}

export interface OmadaPortalAuthResult {
  ok: boolean;
  errorCode?: number;
  message?: string;
  /** Raw response body, helpful for diagnostics. */
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
  /** Returns true when the env is configured well enough to attempt auth. */
  static isConfigured(): boolean {
    return Boolean(OMADA_URL && HOTSPOT_USERNAME && HOTSPOT_PASSWORD);
  }

  /**
   * Authorise an external-portal client on the controller.
   *
   * Idempotent — repeated calls for the same MAC simply extend the session.
   * Returns `ok: false` with a diagnostic message on failure; callers should
   * log this and fall back to the OpenAPI authorize as a best-effort.
   */
  static async authorise(input: OmadaPortalAuthInput): Promise<OmadaPortalAuthResult> {
    if (!OmadaPortalClient.isConfigured()) {
      return {
        ok: false,
        message:
          "OMADA_URL / OMADA_HOTSPOT_USERNAME / OMADA_HOTSPOT_PASSWORD are not configured",
      };
    }

    try {
      const result = await OmadaPortalClient.callPortalAuth(input, await OmadaPortalClient.getCredentials());
      // If the cached token expired (errorCode -1 or 401), retry once with a fresh login.
      if (result.errorCode === -1 || result.errorCode === 401) {
        await OmadaPortalClient.invalidateCache();
        return await OmadaPortalClient.callPortalAuth(
          input,
          await OmadaPortalClient.getCredentials(/* forceRefresh */ true),
        );
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error("[OmadaPortal] authorise failed:", message);
      return { ok: false, message };
    }
  }

  // ----------------------------------------------------------------
  // Internal — token cache + HTTP calls
  // ----------------------------------------------------------------

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

  /**
   * `POST /api/v2/hotspot/login` — operator login.
   *
   * The controller returns `{ errorCode: 0, result: { token: "..." } }` on
   * success and sets a `TPEAP_SESSIONID` cookie via `Set-Cookie`. Both are
   * required for the subsequent `/portal/auth` call.
   */
  private static async login(): Promise<CredentialBundle> {
    const url = `${OMADA_URL}/api/v2/hotspot/login`;
    const body = JSON.stringify({ name: HOTSPOT_USERNAME, password: HOTSPOT_PASSWORD });

    const res = await fetchSafe(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      throw new OmadaPortalApiError(`Hotspot login: non-JSON response (status ${res.status})`, res.status);
    }

    if (parsed?.errorCode !== 0 || !parsed?.result?.token) {
      throw new OmadaPortalApiError(
        `Hotspot login rejected: ${parsed?.msg || `errorCode=${parsed?.errorCode}`}`,
        res.status,
        parsed,
      );
    }

    const setCookie = res.headers.get("set-cookie") || "";
    const cookie = parseCookie(setCookie);
    if (!cookie) {
      throw new OmadaPortalApiError(
        "Hotspot login succeeded but no TPEAP_SESSIONID cookie was set",
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
   * `POST /portal/auth?token=<csrf>` — push the client into the authorised state.
   */
  private static async callPortalAuth(
    input: OmadaPortalAuthInput,
    creds: CredentialBundle,
  ): Promise<OmadaPortalAuthResult> {
    const url = `${OMADA_URL}/portal/auth?token=${encodeURIComponent(creds.token)}`;
    const payload: Record<string, unknown> = {
      clientMac: input.clientMac,
      apMac: input.apMac,
      ssidName: input.ssidName,
      radioId: input.radioId,
      site: input.site,
      time: input.time,
    };
    if (input.t) payload.t = input.t;

    const res = await fetchSafe(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
        message: `portal/auth: non-JSON response (status ${res.status})`,
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
      message: msg || `portal/auth rejected (errorCode=${errorCode ?? "n/a"})`,
      raw: parsed,
    };
  }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/**
 * Wrap `fetch` to optionally accept self-signed certs in dev. In production we
 * stay strict so a misconfigured controller fails loudly rather than silently
 * trusting whatever certificate the network hands back.
 */
async function fetchSafe(url: string, init: RequestInit): Promise<Response> {
  if (!TLS_INSECURE) return fetch(url, init);

  // Lazy-load undici only when needed so we keep cold-start cost on the
  // default path. The standard `fetch` in Next.js (node >=18) is undici under
  // the hood — we just need a dispatcher with TLS verification disabled.
  const { Agent, fetch: undiciFetch } = await import("undici");
  const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  // Undici's `RequestInit` is structurally compatible at runtime but the
  // ambient global `RequestInit` has narrower `body` typing — cast through the
  // any boundary purely for the type checker; the values themselves are fine.
  const undiciInit = { ...(init as Record<string, unknown>), dispatcher };
  const res = await undiciFetch(url, undiciInit as unknown as Parameters<typeof undiciFetch>[1]);
  return res as unknown as Response;
}

/**
 * Extract the `TPEAP_SESSIONID` cookie from a `Set-Cookie` header.
 * Returns `"TPEAP_SESSIONID=...;"` formatted for the subsequent request.
 */
function parseCookie(setCookieHeader: string): string | null {
  if (!setCookieHeader) return null;
  // `Set-Cookie` may include multiple cookies separated by commas. We don't
  // care about any but TPEAP_SESSIONID, so a simple regex is enough.
  const match = setCookieHeader.match(/TPEAP_SESSIONID=[^;]+/);
  return match ? match[0] : null;
}

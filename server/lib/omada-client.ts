import { redis } from "./redis";

const OMADA_URL = process.env.OMADA_URL || "";
const OMADA_CLIENT_ID = process.env.OMADA_CLIENT_ID || "";
const OMADA_CLIENT_SECRET = process.env.OMADA_CLIENT_SECRET || "";
const OMADA_CONTROLLER_ID = process.env.OMADA_CONTROLLER_ID || "";

/**
 * Low-level HTTP client for Omada Controller API
 * Handles authentication, token caching, and request retry
 */
export class OmadaClient {
  private static token: string | null = null;
  private static tokenExpiry: number = 0;

  /**
   * Login to Omada Controller and cache the token
   */
  static async login(): Promise<string> {
    // Check Redis cache first
    const cachedToken = await redis.get("omada:token");
    if (cachedToken) {
      this.token = cachedToken;
      return cachedToken;
    }

    const res = await fetch(`${OMADA_URL}/openapi/authorize/token?grant_type=client_credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        omadacId: OMADA_CONTROLLER_ID,
        client_id: OMADA_CLIENT_ID,
        client_secret: OMADA_CLIENT_SECRET,
      }),
    });

    const data = await res.json();

    if (data.errorCode !== 0) {
      throw new Error(`Omada login failed: ${data.msg}`);
    }

    this.token = data.result.accessToken;
    this.tokenExpiry = Date.now() + (data.result.expiresIn * 1000);

    // Cache token in Redis (expire 5 min before actual expiry)
    await redis.set(
      "omada:token",
      this.token!,
      "EX",
      Math.max(data.result.expiresIn - 300, 60)
    );

    return this.token!;
  }

  /**
   * Make an authenticated request to Omada Controller
   */
  static async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    let token = this.token;

    // Re-authenticate if token expired
    if (!token || Date.now() >= this.tokenExpiry) {
      token = await this.login();
    }

    const url = `${OMADA_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `AccessToken=${token}`,
      },
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const data = await res.json();

    // If token expired, retry once
    if (data.errorCode === -1) {
      this.token = null;
      await redis.del("omada:token");
      token = await this.login();

      options.headers = {
        "Content-Type": "application/json",
        Authorization: `AccessToken=${token}`,
      };

      const retryRes = await fetch(url, options);
      return retryRes.json();
    }

    return data;
  }

  /**
   * GET shorthand
   */
  static async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /**
   * POST shorthand
   */
  static async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /**
   * PATCH shorthand
   */
  static async patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  /**
   * DELETE shorthand
   */
  static async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

import axios, { AxiosError, AxiosInstance } from "axios";
import crypto from "crypto";

/**
 * Snippe Payment Gateway client.
 *
 * Matches the Snippe Public API version `2026-01-25`:
 *   - Base URL:   https://api.snippe.sh
 *   - Auth:       Authorization: Bearer <api_key>
 *   - Sessions:   POST /api/v1/sessions          (hosted checkout)
 *   - Payments:   POST /v1/payments              (direct, e.g. STK push)
 *   - Payouts:    POST /v1/payouts/send          (mobile + bank, single endpoint)
 *   - Webhooks:   HMAC-SHA256 over `{timestamp}.{raw_body}` with X-Webhook-Signature
 *
 * Reference: https://docs.snippe.sh/docs/2026-01-25
 */

// ============================================================
// Env / configuration
// ============================================================

function readEnv(name: string): string {
  return (process.env[name] || "").trim();
}

const SNIPPE_BASE_URL =
  readEnv("SNIPPE_BASE_URL") ||
  readEnv("SNIPPE_API_URL").replace(/\/v1\/?$/, "") ||
  "https://api.snippe.sh";

const SNIPPE_API_KEY = readEnv("SNIPPE_API_KEY");
const SNIPPE_WEBHOOK_SECRET = readEnv("SNIPPE_WEBHOOK_SECRET");

/** Max age (in seconds) we accept for incoming webhook timestamps to defeat replays. */
const WEBHOOK_TIMESTAMP_TOLERANCE_SEC = 5 * 60;

/** Snippe enforces a 30-char ceiling on Idempotency-Key. */
const MAX_IDEMPOTENCY_KEY_LENGTH = 30;

// ============================================================
// Public types
// ============================================================

export type SnippePaymentMethod = "mobile_money" | "qr" | "card";

export type SnippeMobileProvider = "airtel" | "mpesa" | "mixx" | "halotel";

export interface SnippeMoney {
  value: number;
  currency: string;
}

export interface SnippeCustomer {
  name?: string;
  phone?: string;
  email?: string;
}

/** Input for hosted-checkout (POST /api/v1/sessions). */
export interface SnippeCreateSessionInput {
  amount: number;
  currency?: string;
  description?: string;
  customer?: SnippeCustomer;
  redirectUrl?: string;
  webhookUrl?: string;
  allowedMethods?: SnippePaymentMethod[];
  expiresInSeconds?: number;
  profileId?: string;
  metadata?: Record<string, string>;
}

/** Input for direct payment intent (POST /v1/payments). */
export interface SnippeCreatePaymentInput {
  amount: number;
  currency?: string;
  paymentType: "mobile" | "card" | "dynamic-qr";
  phone?: string;
  provider?: SnippeMobileProvider;
  description?: string;
  customer?: SnippeCustomer;
  webhookUrl?: string;
  redirectUrl?: string;
  metadata?: Record<string, string>;
}

/** Input for disbursement (POST /v1/payouts/send). Channel switches mobile / bank. */
export interface SnippeCreatePayoutInput {
  amount: number;
  currency?: string;
  channel: "mobile" | "bank";
  provider?: SnippeMobileProvider;
  recipientPhone?: string;
  recipientAccount?: string;
  recipientBank?: string;
  recipientName: string;
  narration?: string;
  webhookUrl?: string;
  metadata?: Record<string, string>;
}

interface BaseResult {
  success: boolean;
  message?: string;
  code?: number;
  raw?: unknown;
}

export interface SnippeSessionResult extends BaseResult {
  reference: string;
  status: string;
  checkoutUrl?: string;
  shortCode?: string;
  paymentLinkUrl?: string;
  expiresAt?: string;
}

export interface SnippePaymentResult extends BaseResult {
  reference: string;
  status: string;
  paymentUrl?: string;
  paymentQrCode?: string;
  externalReference?: string;
  amount?: SnippeMoney;
  completedAt?: string;
}

export interface SnippePayoutResult extends BaseResult {
  reference: string;
  status: string;
  fee: number;
  total: number;
  amount?: SnippeMoney;
}

export interface SnippeBalanceResult extends BaseResult {
  available: number;
  balance: number;
  currency: string;
}

export type SnippeWebhookEventType =
  | "payment.completed"
  | "payment.failed"
  | "payment.voided"
  | "payment.expired"
  | "payout.completed"
  | "payout.failed"
  | "payout.reversed";

export interface SnippeWebhookEvent {
  id?: string;
  type: SnippeWebhookEventType | string;
  apiVersion?: string;
  createdAt?: string;
  reference: string;
  status: string;
  amount?: SnippeMoney;
  customer?: SnippeCustomer;
  metadata: Record<string, string>;
  failureReason?: string;
  /** Original parsed payload for callers that want to inspect everything. */
  payload: unknown;
}

// ============================================================
// Service
// ============================================================

export class SnippeService {
  private static _client: AxiosInstance | null = null;

  /** Lazy axios instance with auth headers + base URL. */
  private static getClient(): AxiosInstance {
    if (!this._client) {
      if (!SNIPPE_API_KEY) {
        console.warn("[Snippe] SNIPPE_API_KEY is not configured — calls will fail.");
      }
      this._client = axios.create({
        baseURL: SNIPPE_BASE_URL.replace(/\/+$/, ""),
        timeout: 30_000,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${SNIPPE_API_KEY}`,
          "User-Agent": "SSDomada/1.0 (+https://ssdomada.site)",
        },
      });
    }
    return this._client;
  }

  // ------------------------------------------------------------
  // Idempotency
  // ------------------------------------------------------------

  /**
   * Build an Idempotency-Key under Snippe's 30-char ceiling.
   * Pattern: `<prefix>_<10 hex chars>` so logs stay scannable.
   */
  static generateIdempotencyKey(prefix: string = "pay"): string {
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8) || "pay";
    const random = crypto.randomBytes(10).toString("hex"); // 20 chars
    const key = `${safePrefix}_${random}`;
    return key.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
  }

  // ------------------------------------------------------------
  // Payment Sessions  (hosted checkout)   POST /api/v1/sessions
  // ------------------------------------------------------------

  /** Create a hosted checkout session — best for desktop/long-form (reseller plans). */
  static async createSession(
    input: SnippeCreateSessionInput,
    idempotencyKey?: string,
  ): Promise<SnippeSessionResult> {
    const key = idempotencyKey || this.generateIdempotencyKey("sess");

    const body = {
      amount: Math.round(input.amount),
      currency: input.currency || "TZS",
      allowed_methods: input.allowedMethods || ["mobile_money", "qr", "card"],
      customer: input.customer ? cleanCustomer(input.customer) : undefined,
      redirect_url: input.redirectUrl,
      webhook_url: input.webhookUrl,
      description: input.description,
      metadata: input.metadata,
      expires_in: input.expiresInSeconds || 3600,
      profile_id: input.profileId,
    };

    try {
      const res = await this.getClient().post("/api/v1/sessions", body, {
        headers: { "Idempotency-Key": key },
      });

      const d = unwrap(res.data);
      return {
        success: true,
        reference: d.reference || d.id || "",
        status: d.status || "pending",
        checkoutUrl: d.checkout_url,
        shortCode: d.short_code,
        paymentLinkUrl: d.payment_link_url,
        expiresAt: d.expires_at,
        code: res.status,
        raw: res.data,
      };
    } catch (error) {
      return buildErrorResult(error, "Session creation failed", {
        reference: "",
        status: "failed",
      });
    }
  }

  /** GET /api/v1/sessions/:reference */
  static async getSession(reference: string): Promise<SnippeSessionResult> {
    try {
      const res = await this.getClient().get(`/api/v1/sessions/${encodeURIComponent(reference)}`);
      const d = unwrap(res.data);
      return {
        success: true,
        reference: d.reference || d.id || reference,
        status: d.status || "pending",
        checkoutUrl: d.checkout_url,
        shortCode: d.short_code,
        paymentLinkUrl: d.payment_link_url,
        expiresAt: d.expires_at,
        code: res.status,
        raw: res.data,
      };
    } catch (error) {
      return buildErrorResult(error, "Get session failed", {
        reference,
        status: "failed",
      });
    }
  }

  /** POST /api/v1/sessions/:reference/cancel */
  static async cancelSession(reference: string): Promise<BaseResult> {
    try {
      const res = await this.getClient().post(
        `/api/v1/sessions/${encodeURIComponent(reference)}/cancel`,
      );
      return { success: true, code: res.status, raw: res.data };
    } catch (error) {
      return buildErrorResult(error, "Cancel session failed", {});
    }
  }

  // ------------------------------------------------------------
  // Direct Payments  (mobile STK push etc.)  POST /v1/payments
  // ------------------------------------------------------------

  /**
   * Create a direct payment intent.
   * For mobile_money this triggers an STK push to the customer's phone.
   */
  static async createPayment(
    input: SnippeCreatePaymentInput,
    idempotencyKey?: string,
  ): Promise<SnippePaymentResult> {
    const key = idempotencyKey || this.generateIdempotencyKey(input.paymentType.slice(0, 4));

    const body: Record<string, unknown> = {
      payment_type: input.paymentType,
      amount: Math.round(input.amount),
      currency: input.currency || "TZS",
      description: input.description,
      customer: input.customer ? cleanCustomer(input.customer) : undefined,
      phone_number: input.phone,
      provider: input.provider,
      webhook_url: input.webhookUrl,
      redirect_url: input.redirectUrl,
      metadata: input.metadata,
    };

    try {
      const res = await this.getClient().post("/v1/payments", body, {
        headers: { "Idempotency-Key": key },
      });
      const d = unwrap(res.data);
      return {
        success: true,
        reference: d.reference || d.id || "",
        status: d.status || "pending",
        paymentUrl: d.payment_url,
        paymentQrCode: d.payment_qr_code,
        externalReference: d.external_reference,
        amount: parseMoney(d.amount),
        code: res.status,
        raw: res.data,
      };
    } catch (error) {
      return buildErrorResult(error, "Create payment failed", {
        reference: "",
        status: "failed",
      });
    }
  }

  /** GET /v1/payments/:reference */
  static async getPayment(reference: string): Promise<SnippePaymentResult> {
    try {
      const res = await this.getClient().get(`/v1/payments/${encodeURIComponent(reference)}`);
      const d = unwrap(res.data);
      return {
        success: true,
        reference: d.reference || d.id || reference,
        status: d.status || "pending",
        externalReference: d.external_reference,
        amount: parseMoney(d.amount),
        completedAt: d.completed_at,
        code: res.status,
        raw: res.data,
      };
    } catch (error) {
      return buildErrorResult(error, "Get payment failed", {
        reference,
        status: "failed",
      });
    }
  }

  /** GET /v1/payments/balance */
  static async getBalance(): Promise<SnippeBalanceResult> {
    try {
      const res = await this.getClient().get("/v1/payments/balance");
      const d = unwrap(res.data);
      return {
        success: true,
        available: parseMoney(d.available)?.value || 0,
        balance: parseMoney(d.balance)?.value || 0,
        currency: parseMoney(d.balance)?.currency || "TZS",
        code: res.status,
        raw: res.data,
      };
    } catch (error) {
      return buildErrorResult(error, "Get balance failed", {
        available: 0,
        balance: 0,
        currency: "TZS",
      });
    }
  }

  // ------------------------------------------------------------
  // Disbursements (Payouts)   POST /v1/payouts/send
  // ------------------------------------------------------------

  /**
   * Single endpoint that handles mobile and bank disbursements.
   * Always calculate the fee with `getPayoutFee` first to ensure balance.
   */
  static async createPayout(
    input: SnippeCreatePayoutInput,
    idempotencyKey?: string,
  ): Promise<SnippePayoutResult> {
    const key = idempotencyKey || this.generateIdempotencyKey("po");

    const body: Record<string, unknown> = {
      amount: Math.round(input.amount),
      currency: input.currency || "TZS",
      channel: { type: input.channel === "mobile" ? "mobile_money" : "bank" },
      recipient: buildPayoutRecipient(input),
      narration: input.narration,
      webhook_url: input.webhookUrl,
      metadata: input.metadata,
    };

    try {
      const res = await this.getClient().post("/v1/payouts/send", body, {
        headers: { "Idempotency-Key": key },
      });
      const d = unwrap(res.data);
      return {
        success: true,
        reference: d.reference || d.id || "",
        status: d.status || "pending",
        fee: parseMoney(d.fees)?.value || 0,
        total: parseMoney(d.total)?.value || (Math.round(input.amount) + (parseMoney(d.fees)?.value || 0)),
        amount: parseMoney(d.amount),
        code: res.status,
        raw: res.data,
      };
    } catch (error) {
      return buildPayoutErrorResult(error, "Create payout failed");
    }
  }

  /** GET /v1/payouts/:reference */
  static async getPayout(reference: string): Promise<SnippePayoutResult> {
    try {
      const res = await this.getClient().get(`/v1/payouts/${encodeURIComponent(reference)}`);
      const d = unwrap(res.data);
      return {
        success: true,
        reference: d.reference || d.id || reference,
        status: d.status || "pending",
        fee: parseMoney(d.fees)?.value || 0,
        total: parseMoney(d.total)?.value || 0,
        amount: parseMoney(d.amount),
        code: res.status,
        raw: res.data,
      };
    } catch (error) {
      return buildPayoutErrorResult(error, "Get payout failed");
    }
  }

  /**
   * GET /v1/payouts/fee?amount=...
   * Returns the gross fee Snippe will deduct for the given amount.
   */
  static async getPayoutFee(amount: number): Promise<{
    success: boolean;
    amount: number;
    fee: number;
    total: number;
    currency: string;
    message?: string;
  }> {
    try {
      const res = await this.getClient().get(`/v1/payouts/fee?amount=${Math.round(amount)}`);
      const d = unwrap(res.data);
      return {
        success: true,
        amount: d.amount ?? Math.round(amount),
        fee: d.fee_amount ?? 0,
        total: d.total_amount ?? Math.round(amount),
        currency: d.currency || "TZS",
      };
    } catch (error) {
      const ax = error as AxiosError<{ message?: string }>;
      return {
        success: false,
        amount: Math.round(amount),
        fee: 0,
        total: Math.round(amount),
        currency: "TZS",
        message: ax.response?.data?.message || ax.message,
      };
    }
  }

  // ------------------------------------------------------------
  // Webhooks
  // ------------------------------------------------------------

  /**
   * Constant-time verification of an incoming Snippe webhook.
   *
   * Signature spec (2026-01-25):
   *   message   = `${timestamp}.${raw_body}`
   *   signature = hex(HMAC-SHA256(SNIPPE_WEBHOOK_SECRET, message))
   *
   * @param rawBody  Exact bytes of the request body (do NOT JSON.stringify after parsing).
   * @param signature Value of header `X-Webhook-Signature`.
   * @param timestamp Value of header `X-Webhook-Timestamp` (unix seconds).
   * @param toleranceSeconds Override replay tolerance (default: 5 min).
   */
  static verifyWebhookSignature(
    rawBody: string,
    signature: string | null,
    timestamp: string | null,
    toleranceSeconds: number = WEBHOOK_TIMESTAMP_TOLERANCE_SEC,
  ): { ok: true } | { ok: false; reason: string } {
    if (!SNIPPE_WEBHOOK_SECRET) {
      return { ok: false, reason: "SNIPPE_WEBHOOK_SECRET not configured" };
    }
    if (!signature) return { ok: false, reason: "missing X-Webhook-Signature header" };
    if (!timestamp) return { ok: false, reason: "missing X-Webhook-Timestamp header" };

    const ts = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp" };

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > toleranceSeconds) {
      return { ok: false, reason: "timestamp outside tolerance window" };
    }

    const expected = crypto
      .createHmac("sha256", SNIPPE_WEBHOOK_SECRET)
      .update(`${ts}.${rawBody}`)
      .digest("hex");

    const sigBuf = safeBuffer(signature);
    const expBuf = safeBuffer(expected);

    if (sigBuf.length !== expBuf.length) {
      return { ok: false, reason: "signature length mismatch" };
    }
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { ok: false, reason: "signature mismatch" };
    }

    return { ok: true };
  }

  /**
   * Parse a webhook payload into a normalised event.
   * Handles both the 2026-01-25 (`type` + nested `data`) and legacy (`event` flat) formats.
   */
  static parseWebhookEvent(rawBody: string): SnippeWebhookEvent | null {
    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object") return null;

    const isNested = parsed.type && parsed.data && typeof parsed.data === "object";
    const type: string = parsed.type || parsed.event || "";
    const data = isNested ? parsed.data : parsed;

    const reference: string = data.reference || data.session_reference || data.id || "";
    const status: string = data.status || (type.split(".")[1] ?? "");

    const meta = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
    const flatMeta: Record<string, string> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (v == null) continue;
      flatMeta[k] = typeof v === "string" ? v : JSON.stringify(v);
    }

    return {
      id: parsed.id,
      type,
      apiVersion: parsed.api_version,
      createdAt: parsed.created_at,
      reference,
      status,
      amount: parseMoney(data.amount),
      customer: data.customer && typeof data.customer === "object" ? data.customer : undefined,
      metadata: flatMeta,
      failureReason: data.failure_reason,
      payload: parsed,
    };
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Snippe returns either `{ status, code, data }` or `{ code, data }` depending on endpoint.
 * Always pull `.data` if present, otherwise treat the body itself as the payload.
 */
function unwrap(body: unknown): Record<string, any> {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, any>;
  if (b.data && typeof b.data === "object") return b.data;
  return b;
}

function parseMoney(value: unknown): SnippeMoney | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return { value, currency: "TZS" };
  if (typeof value === "object") {
    const v = (value as Record<string, unknown>).value;
    const c = (value as Record<string, unknown>).currency;
    if (typeof v === "number") {
      return { value: v, currency: typeof c === "string" ? c : "TZS" };
    }
  }
  return undefined;
}

function cleanCustomer(c: SnippeCustomer): SnippeCustomer {
  const out: SnippeCustomer = {};
  if (c.name) out.name = c.name;
  if (c.phone) out.phone = c.phone;
  if (c.email) out.email = c.email;
  return out;
}

function buildPayoutRecipient(input: SnippeCreatePayoutInput): Record<string, unknown> {
  if (input.channel === "mobile") {
    return {
      type: "mobile_money",
      name: input.recipientName,
      phone: input.recipientPhone,
      provider: input.provider,
    };
  }
  return {
    type: "bank",
    name: input.recipientName,
    account_number: input.recipientAccount,
    bank_code: input.recipientBank,
  };
}

function safeBuffer(s: string): Buffer {
  return Buffer.from(s, "utf8");
}

function buildErrorResult<T extends Record<string, unknown>>(
  error: unknown,
  fallback: string,
  defaults: T,
): T & BaseResult {
  const ax = error as AxiosError<{ message?: string; error_code?: string }>;
  const body = ax.response?.data as Record<string, unknown> | undefined;
  const message =
    (body && (body.message as string)) ||
    ax.message ||
    fallback;

  if (process.env.NODE_ENV !== "test") {
    console.error("[Snippe]", fallback, {
      status: ax.response?.status,
      message,
      body,
    });
  }

  return {
    ...defaults,
    success: false,
    code: ax.response?.status,
    message,
    raw: body,
  };
}

function buildPayoutErrorResult(error: unknown, fallback: string): SnippePayoutResult {
  return buildErrorResult(error, fallback, {
    reference: "",
    status: "failed",
    fee: 0,
    total: 0,
  });
}

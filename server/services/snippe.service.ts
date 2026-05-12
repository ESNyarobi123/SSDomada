import axios, { AxiosInstance, AxiosError } from "axios";
import { v4 as uuidv4 } from "uuid";

// ============================================================
// SNIPPE API SERVICE
// Core HTTP client for Snippe Payment Gateway
// Handles: Collections, Payment Sessions, Payouts, Webhooks
// ============================================================

const SNIPPE_BASE_URL = process.env.SNIPPE_BASE_URL || "https://api.snippe.co.tz/v1";
const SNIPPE_API_KEY = process.env.SNIPPE_API_KEY || "";
const SNIPPE_SECRET_KEY = process.env.SNIPPE_SECRET_KEY || "";
const SNIPPE_WEBHOOK_SECRET = process.env.SNIPPE_WEBHOOK_SECRET || "";

// ============================================================
// Types
// ============================================================

export interface SnippePaymentSessionInput {
  amount: number;
  currency?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  description: string;
  callbackUrl: string;      // Redirect after payment
  webhookUrl?: string;       // Webhook notification URL
  metadata?: Record<string, string>;
}

export interface SnippeDirectPaymentInput {
  amount: number;
  currency?: string;
  phone: string;            // Customer's mobile money number
  provider: "airtel" | "mpesa" | "mixx" | "halotel";
  description: string;
  webhookUrl?: string;
  metadata?: Record<string, string>;
}

export interface SnippePayoutInput {
  amount: number;
  currency?: string;
  channel: "mobile" | "bank";
  recipientPhone?: string;   // For mobile payouts
  recipientAccount?: string; // For bank payouts
  recipientBank?: string;    // Bank code/name
  recipientName: string;
  narration: string;
  webhookUrl?: string;
  metadata?: Record<string, string>;
}

export interface SnippePaymentResponse {
  success: boolean;
  reference: string;
  status: string;
  checkoutUrl?: string;      // For payment sessions
  message?: string;
}

export interface SnippePayoutResponse {
  success: boolean;
  reference: string;
  status: string;
  fee: number;
  total: number;
  message?: string;
}

export interface SnippeWebhookPayload {
  event: "payment.completed" | "payment.failed" | "payment.expired" | "payout.completed" | "payout.failed" | "payout.reversed";
  reference: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, string>;
  completedAt?: string;
}

// ============================================================
// Snippe API Client
// ============================================================

export class SnippeService {
  private static client: AxiosInstance;

  /**
   * Get or create the Axios instance with auth headers
   */
  private static getClient(): AxiosInstance {
    if (!this.client) {
      this.client = axios.create({
        baseURL: SNIPPE_BASE_URL,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SNIPPE_API_KEY}`,
          "X-Secret-Key": SNIPPE_SECRET_KEY,
        },
        timeout: 30000, // 30 seconds
      });
    }
    return this.client;
  }

  /**
   * Generate a unique idempotency key
   */
  static generateIdempotencyKey(): string {
    return uuidv4();
  }

  // ============================================================
  // COLLECTIONS (Receiving Payments)
  // ============================================================

  /**
   * Create a Payment Session (Hosted Checkout)
   * Best for: Captive Portal — redirects customer to Snippe's secure page
   */
  static async createPaymentSession(
    input: SnippePaymentSessionInput,
    idempotencyKey?: string
  ): Promise<SnippePaymentResponse> {
    const key = idempotencyKey || this.generateIdempotencyKey();

    try {
      const response = await this.getClient().post("/payments/sessions", {
        amount: input.amount,
        currency: input.currency || "TZS",
        customer: {
          phone: input.customerPhone,
          email: input.customerEmail,
          name: input.customerName,
        },
        description: input.description,
        callback_url: input.callbackUrl,
        webhook_url: input.webhookUrl,
        metadata: input.metadata,
      }, {
        headers: { "Idempotency-Key": key },
      });

      return {
        success: true,
        reference: response.data.reference,
        status: response.data.status,
        checkoutUrl: response.data.checkout_url,
      };
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Direct Mobile Money Payment
   * Best for: When you want to trigger STK push directly
   */
  static async createDirectPayment(
    input: SnippeDirectPaymentInput,
    idempotencyKey?: string
  ): Promise<SnippePaymentResponse> {
    const key = idempotencyKey || this.generateIdempotencyKey();

    try {
      const response = await this.getClient().post("/payments/mobile", {
        amount: input.amount,
        currency: input.currency || "TZS",
        phone: input.phone,
        provider: input.provider,
        description: input.description,
        webhook_url: input.webhookUrl,
        metadata: input.metadata,
      }, {
        headers: { "Idempotency-Key": key },
      });

      return {
        success: true,
        reference: response.data.reference,
        status: response.data.status,
      };
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Check payment status by reference
   */
  static async getPaymentStatus(reference: string): Promise<SnippePaymentResponse> {
    try {
      const response = await this.getClient().get(`/payments/${reference}`);
      return {
        success: true,
        reference: response.data.reference,
        status: response.data.status,
      };
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // ============================================================
  // PAYOUTS (Disbursements to Resellers)
  // ============================================================

  /**
   * Send payout to mobile money
   */
  static async createMobilePayout(
    input: SnippePayoutInput,
    idempotencyKey?: string
  ): Promise<SnippePayoutResponse> {
    const key = idempotencyKey || this.generateIdempotencyKey();

    try {
      const response = await this.getClient().post("/payouts/mobile", {
        amount: input.amount,
        currency: input.currency || "TZS",
        phone: input.recipientPhone,
        recipient_name: input.recipientName,
        narration: input.narration,
        webhook_url: input.webhookUrl,
        metadata: input.metadata,
      }, {
        headers: { "Idempotency-Key": key },
      });

      return {
        success: true,
        reference: response.data.reference,
        status: response.data.status,
        fee: response.data.fee || 0,
        total: response.data.total || input.amount,
      };
    } catch (error) {
      return this.handlePayoutError(error as AxiosError);
    }
  }

  /**
   * Send payout to bank account
   */
  static async createBankPayout(
    input: SnippePayoutInput,
    idempotencyKey?: string
  ): Promise<SnippePayoutResponse> {
    const key = idempotencyKey || this.generateIdempotencyKey();

    try {
      const response = await this.getClient().post("/payouts/bank", {
        amount: input.amount,
        currency: input.currency || "TZS",
        account_number: input.recipientAccount,
        bank_code: input.recipientBank,
        recipient_name: input.recipientName,
        narration: input.narration,
        webhook_url: input.webhookUrl,
        metadata: input.metadata,
      }, {
        headers: { "Idempotency-Key": key },
      });

      return {
        success: true,
        reference: response.data.reference,
        status: response.data.status,
        fee: response.data.fee || 0,
        total: response.data.total || input.amount,
      };
    } catch (error) {
      return this.handlePayoutError(error as AxiosError);
    }
  }

  /**
   * Check payout status by reference
   */
  static async getPayoutStatus(reference: string): Promise<SnippePayoutResponse> {
    try {
      const response = await this.getClient().get(`/payouts/${reference}`);
      return {
        success: true,
        reference: response.data.reference,
        status: response.data.status,
        fee: response.data.fee || 0,
        total: response.data.total || 0,
      };
    } catch (error) {
      return this.handlePayoutError(error as AxiosError);
    }
  }

  // ============================================================
  // WEBHOOKS
  // ============================================================

  /**
   * Verify webhook signature from Snippe
   * Call this in your webhook route to ensure request is authentic
   */
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", SNIPPE_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse webhook payload
   */
  static parseWebhookPayload(body: unknown): SnippeWebhookPayload {
    return body as SnippeWebhookPayload;
  }

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  private static handleError(error: AxiosError): SnippePaymentResponse {
    const message = (error.response?.data as Record<string, string>)?.message
      || error.message
      || "Payment request failed";

    console.error("[Snippe] Payment error:", message);

    return {
      success: false,
      reference: "",
      status: "failed",
      message,
    };
  }

  private static handlePayoutError(error: AxiosError): SnippePayoutResponse {
    const message = (error.response?.data as Record<string, string>)?.message
      || error.message
      || "Payout request failed";

    console.error("[Snippe] Payout error:", message);

    return {
      success: false,
      reference: "",
      status: "failed",
      fee: 0,
      total: 0,
      message,
    };
  }
}

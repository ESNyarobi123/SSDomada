import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "SSDomada — Portal & RADIUS API",
    version: "1.0.0",
    description: "Public Captive Portal endpoints, RADIUS management, and Webhook handlers for the SSDomada WiFi Billing System.",
  },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Captive Portal", description: "Public endpoints — no auth required. Called by WiFi clients." },
    { name: "RADIUS Management", description: "Reseller-authenticated RADIUS user management." },
    { name: "Webhooks", description: "Payment gateway callbacks." },
    { name: "Cron", description: "Scheduled maintenance tasks." },
  ],
  paths: {
    "/api/portal/{slug}": {
      get: {
        tags: ["Captive Portal"],
        summary: "Load captive portal (entry point)",
        description: "Called when a WiFi client is redirected by Omada. Returns branding, packages, and session info.",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" }, description: "Reseller brand slug (e.g. 'fastnet')" },
          { name: "clientMac", in: "query", schema: { type: "string" }, description: "Client MAC address from Omada" },
          { name: "apMac", in: "query", schema: { type: "string" }, description: "Access Point MAC" },
          { name: "ssid", in: "query", schema: { type: "string" }, description: "WiFi network name" },
          { name: "nasId", in: "query", schema: { type: "string" }, description: "NAS identifier" },
          { name: "url", in: "query", schema: { type: "string" }, description: "Original URL the client was trying to visit" },
        ],
        responses: {
          200: {
            description: "Portal data with branding, packages, session, and client authorization status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        portal: {
                          type: "object",
                          description: "Branding config (colors, logo, welcome text)",
                        },
                        packages: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                              price: { type: "number" },
                              currency: { type: "string" },
                              duration: { type: "string" },
                              durationMinutes: { type: "integer" },
                              speedLimitDown: { type: "integer" },
                              speedLimitUp: { type: "integer" },
                              isFeatured: { type: "boolean" },
                            },
                          },
                        },
                        session: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            clientMac: { type: "string" },
                            status: { type: "string", enum: ["PENDING", "PAYING", "AUTHORIZED", "EXPIRED"] },
                          },
                        },
                        client: {
                          type: "object",
                          properties: {
                            mac: { type: "string" },
                            isAuthorized: { type: "boolean" },
                            remainingSeconds: { type: "integer" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: "Portal not found" },
          503: { description: "Portal unavailable (reseller inactive)" },
        },
      },
    },
    "/api/portal/{slug}/pay": {
      post: {
        tags: ["Captive Portal"],
        summary: "Initiate payment from portal",
        description: "Customer selects a package → creates Payment + calls Snippe → returns checkout URL.",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionId", "packageId"],
                properties: {
                  sessionId: { type: "string", description: "Portal session ID from GET /api/portal/{slug}" },
                  packageId: { type: "string", description: "Selected WiFi package ID" },
                  phone: { type: "string", description: "Customer phone (for M-Pesa/Airtel Money)" },
                  paymentMethod: { type: "string", enum: ["MOBILE", "CARD"], default: "MOBILE" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment initiated — redirect customer to checkoutUrl",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        paymentId: { type: "string" },
                        checkoutUrl: { type: "string", description: "Snippe hosted checkout URL" },
                        sessionId: { type: "string" },
                        amount: { type: "number" },
                        currency: { type: "string" },
                        package: { type: "string" },
                        expiresAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Missing required fields" },
          404: { description: "Portal or package not found" },
          410: { description: "Session expired" },
          502: { description: "Payment gateway error" },
        },
      },
    },
    "/api/portal/{slug}/status": {
      get: {
        tags: ["Captive Portal"],
        summary: "Poll session status (after payment)",
        description: "Frontend polls this every 3-5s after redirecting to Snippe. Returns AUTHORIZED when payment completes and RADIUS credentials are created.",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
          { name: "sessionId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Session status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        sessionId: { type: "string" },
                        status: { type: "string", enum: ["PENDING", "PAYING", "AUTHORIZED", "EXPIRED"] },
                        clientMac: { type: "string" },
                        authorizedAt: { type: "string", format: "date-time", nullable: true },
                        expiresAt: { type: "string", format: "date-time", nullable: true },
                        remainingSeconds: { type: "integer" },
                        redirectUrl: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/reseller/radius": {
      get: {
        tags: ["RADIUS Management"],
        summary: "List RADIUS users, online sessions, or accounting data",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "view", in: "query", schema: { type: "string", enum: ["active", "online", "accounting"] }, description: "active=authorized clients, online=connected now, accounting=usage data" },
          { name: "username", in: "query", schema: { type: "string" }, description: "Required for accounting view" },
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "RADIUS data based on view type" },
          401: { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["RADIUS Management"],
        summary: "Grant, revoke, or expire RADIUS access",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action"],
                properties: {
                  action: { type: "string", enum: ["grant", "revoke", "expire-stale"], description: "grant=manual access, revoke=disconnect, expire-stale=cleanup" },
                  clientMac: { type: "string", description: "Required for grant/revoke" },
                  username: { type: "string", description: "Alternative to clientMac for revoke" },
                  sessionTimeoutMinutes: { type: "integer", default: 60, description: "For grant: session duration" },
                  expiresInMinutes: { type: "integer", default: 60, description: "For grant: when credentials expire" },
                  bandwidthUpKbps: { type: "integer", description: "Upload speed limit in kbps" },
                  bandwidthDownKbps: { type: "integer", description: "Download speed limit in kbps" },
                  maxSessions: { type: "integer", default: 1, description: "Max simultaneous connections" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Action completed" },
          400: { description: "Invalid action or missing fields" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/api/webhooks/snippe": {
      post: {
        tags: ["Webhooks"],
        summary: "Snippe payment/payout webhook",
        description: "Called by Snippe when payment.completed, payment.failed, payout.completed, etc. On payment success: credits reseller wallet + creates RADIUS credentials.",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  event: { type: "string", enum: ["payment.completed", "payment.failed", "payment.expired", "payout.completed", "payout.failed"] },
                  reference: { type: "string" },
                  status: { type: "string" },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Webhook acknowledged" },
        },
      },
    },
    "/api/cron/radius-expire": {
      get: {
        tags: ["Cron"],
        summary: "Expire stale RADIUS credentials (GET)",
        description: "Same as POST. Protected by CRON_SECRET.",
        security: [],
        parameters: [
          { name: "Authorization", in: "header", schema: { type: "string" }, description: "Bearer {CRON_SECRET}" },
        ],
        responses: { "200": { description: "Expiration result" } },
      },
      post: {
        tags: ["Cron"],
        summary: "Expire stale RADIUS credentials",
        description: "Should run every minute. Removes radcheck/radreply for expired users. Protected by CRON_SECRET.",
        parameters: [
          { name: "Authorization", in: "header", schema: { type: "string" }, description: "Bearer {CRON_SECRET}" },
        ],
        responses: {
          200: {
            description: "Expiration result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    expired: { type: "integer", description: "Number of credentials expired" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/cron/sync-omada": {
      get: {
        tags: ["Cron"],
        summary: "Sync Omada devices and enforce access",
        description: "Protected by CRON_SECRET.",
        security: [],
        parameters: [
          { name: "Authorization", in: "header", schema: { type: "string" }, description: "Bearer {CRON_SECRET}" },
        ],
        responses: { "200": { description: "Sync stats" } },
      },
    },
    "/api/docs/portal": {
      get: {
        tags: ["Meta"],
        summary: "OpenAPI JSON (this document)",
        responses: { "200": { description: "OpenAPI spec" } },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http" as const,
        scheme: "bearer",
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}

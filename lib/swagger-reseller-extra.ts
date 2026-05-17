import { pathId, stdErrorResponses } from "./swagger-helpers";

/** Reseller API paths not yet in lib/swagger-reseller.ts — merged at runtime. */
export const resellerExtraPaths = {
  "/docs": {
    get: {
      tags: ["Meta"],
      summary: "OpenAPI JSON (this document)",
      description: "May require active platform plan (apiAccess feature).",
      responses: { "200": { description: "OpenAPI 3.0 spec" }, "402": { description: "Plan does not include API access" } },
    },
  },
  "/billing": {
    get: {
      tags: ["Platform Billing"],
      summary: "Current SSDomada plan, usage, wallet, pending checkout",
      responses: { "200": { description: "Billing access snapshot" }, ...stdErrorResponses },
    },
    post: {
      tags: ["Platform Billing"],
      summary: "Subscribe, cancel, or abandon plan checkout",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              required: ["action"],
              properties: {
                action: { type: "string" as const, enum: ["subscribe", "cancel", "abandon_checkout"] },
                planId: { type: "string" as const },
                paymentMethod: { type: "string" as const, enum: ["MOBILE", "CARD", "WALLET"] },
                phone: { type: "string" as const },
                paymentReference: { type: "string" as const },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "checkoutUrl, polling, or activated plan" },
        "402": { description: "Payment required / plan limit" },
        ...stdErrorResponses,
      },
    },
  },
  "/onboarding": {
    get: {
      tags: ["Onboarding"],
      summary: "Reseller setup guide progress (6 steps)",
      responses: { "200": { description: "Steps + completion state" } },
    },
    post: {
      tags: ["Onboarding"],
      summary: "Dismiss setup guide or refresh step",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                action: { type: "string" as const, enum: ["dismiss", "refresh"] },
              },
            },
          },
        },
      },
      responses: { "200": { description: "Updated" } },
    },
  },
  "/notices": {
    get: {
      tags: ["Notices"],
      summary: "In-app notices from platform",
      responses: { "200": { description: "Active notices" } },
    },
  },
  "/notices/{id}": {
    patch: {
      tags: ["Notices"],
      summary: "Dismiss notice",
      parameters: pathId(),
      responses: { "200": { description: "Dismissed" } },
    },
  },
  "/portal-setup-requests": {
    post: {
      tags: ["Portal Setup"],
      summary: "Request admin help with Omada portal configuration",
      requestBody: { content: { "application/json": { schema: { type: "object" as const } } } },
      responses: { "200": { description: "Request submitted" }, "402": { description: "Plan inactive" } },
    },
  },
  "/omada/sync-portal": {
    post: {
      tags: ["Omada"],
      summary: "Re-push external portal URL and open SSIDs to Omada",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: { siteId: { type: "string" as const } },
            },
          },
        },
      },
      responses: { "200": { description: "Sync result" }, ...stdErrorResponses },
    },
  },
  "/clients/kick": {
    post: {
      tags: ["Clients"],
      summary: "Force-disconnect client from WiFi (Omada unauth)",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                mac: { type: "string" as const },
                siteId: { type: "string" as const },
              },
            },
          },
        },
      },
      responses: { "200": { description: "Kick initiated" } },
    },
  },
  "/captive-portal/asset": {
    post: {
      tags: ["Captive Portal"],
      summary: "Upload captive portal logo or background (multipart)",
      requestBody: {
        content: {
          "multipart/form-data": {
            schema: {
              type: "object" as const,
              properties: {
                file: { type: "string" as const, format: "binary" },
                kind: { type: "string" as const, enum: ["logo", "background"] },
              },
            },
          },
        },
      },
      responses: { "200": { description: "Public URL of uploaded asset" } },
    },
  },
  "/radius": {
    get: {
      tags: ["RADIUS"],
      summary: "List RADIUS users / sessions for reseller",
      parameters: [
        { name: "mac", in: "query" as const, schema: { type: "string" as const } },
        { name: "active", in: "query" as const, schema: { type: "boolean" as const } },
      ],
      responses: { "200": { description: "RADIUS records" } },
    },
    post: {
      tags: ["RADIUS"],
      summary: "Grant, revoke, or expire RADIUS access",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                action: { type: "string" as const, enum: ["grant", "revoke", "expire"] },
                mac: { type: "string" as const },
                durationMinutes: { type: "integer" as const },
              },
            },
          },
        },
      },
      responses: { "200": { description: "Action result" } },
    },
  },
};

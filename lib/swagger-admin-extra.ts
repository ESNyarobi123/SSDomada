import { paginatedQuery, pathId, stdErrorResponses } from "./swagger-helpers";

/** Admin API paths not yet in lib/swagger.ts — merged at runtime. */
export const adminExtraPaths = {
  "/docs": {
    get: {
      tags: ["Meta"],
      summary: "OpenAPI JSON (this document)",
      security: [],
      responses: { "200": { description: "OpenAPI 3.0 spec" } },
    },
  },
  "/platform-plans": {
    get: {
      tags: ["Platform Plans"],
      summary: "List SSDomada reseller billing tiers",
      responses: { "200": { description: "Active plans" }, ...stdErrorResponses },
    },
    post: {
      tags: ["Platform Plans"],
      summary: "Create platform plan",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" as const } } },
      },
      responses: { "200": { description: "Plan created" }, ...stdErrorResponses },
    },
  },
  "/platform-plans/{id}": {
    get: {
      tags: ["Platform Plans"],
      summary: "Get platform plan",
      parameters: pathId(),
      responses: { "200": { description: "Plan detail" }, ...stdErrorResponses },
    },
    patch: {
      tags: ["Platform Plans"],
      summary: "Update platform plan",
      parameters: pathId(),
      requestBody: { content: { "application/json": { schema: { type: "object" as const } } } },
      responses: { "200": { description: "Updated" }, ...stdErrorResponses },
    },
    delete: {
      tags: ["Platform Plans"],
      summary: "Delete platform plan (if no subscriptions)",
      parameters: pathId(),
      responses: { "200": { description: "Deleted" }, "409": { description: "Plan in use" } },
    },
  },
  "/landing-page": {
    get: {
      tags: ["Landing Page CMS"],
      summary: "Get marketing landing page config",
      responses: { "200": { description: "Hero, footer, contact, SEO" } },
    },
    put: {
      tags: ["Landing Page CMS"],
      summary: "Update landing page config",
      requestBody: { content: { "application/json": { schema: { type: "object" as const } } } },
      responses: { "200": { description: "Saved" } },
    },
  },
  "/portal-setup-requests": {
    get: {
      tags: ["Portal Setup"],
      summary: "List reseller portal setup requests",
      parameters: [
        ...paginatedQuery(),
        { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["OPEN", "DONE", "DISMISSED"] } },
      ],
      responses: { "200": { description: "Request queue" } },
    },
  },
  "/portal-setup-requests/{id}": {
    patch: {
      tags: ["Portal Setup"],
      summary: "Update setup request (DONE / DISMISSED)",
      parameters: pathId(),
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: { status: { type: "string" as const, enum: ["DONE", "DISMISSED"] } },
            },
          },
        },
      },
      responses: { "200": { description: "Updated" } },
    },
  },
  "/wifi-subscriptions": {
    get: {
      tags: ["WiFi Subscriptions"],
      summary: "List end-user WiFi subscriptions (platform-wide)",
      parameters: paginatedQuery(),
      responses: { "200": { description: "Subscriptions" } },
    },
    post: {
      tags: ["WiFi Subscriptions"],
      summary: "Create WiFi subscription (admin)",
      requestBody: { content: { "application/json": { schema: { type: "object" as const } } } },
      responses: { "200": { description: "Created" } },
    },
  },
  "/wifi-subscriptions/{id}": {
    get: {
      tags: ["WiFi Subscriptions"],
      summary: "WiFi subscription detail",
      parameters: pathId(),
      responses: { "200": { description: "Detail" } },
    },
    patch: {
      tags: ["WiFi Subscriptions"],
      summary: "Update subscription",
      parameters: pathId(),
      responses: { "200": { description: "Updated" } },
    },
    delete: {
      tags: ["WiFi Subscriptions"],
      summary: "Delete subscription",
      parameters: pathId(),
      responses: { "200": { description: "Deleted" } },
    },
  },
  "/omada-health": {
    get: {
      tags: ["Omada Controller"],
      summary: "Omada controller connectivity diagnostic",
      description: "Requires Authorization: Bearer {CRON_SECRET} (not admin session).",
      security: [],
      parameters: [
        { name: "Authorization", in: "header" as const, schema: { type: "string" as const } },
      ],
      responses: { "200": { description: "Health snapshot" }, "401": { description: "Invalid CRON_SECRET" } },
    },
  },
  "/payments/reconcile": {
    post: {
      tags: ["Payments"],
      summary: "Reconcile stuck payment with Snippe",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: { paymentId: { type: "string" as const }, snippeReference: { type: "string" as const } },
            },
          },
        },
      },
      responses: { "200": { description: "Reconciled" } },
    },
  },
  "/resellers/{id}/impersonate": {
    post: {
      tags: ["Resellers"],
      summary: "Impersonate reseller (audited)",
      parameters: pathId(),
      responses: { "200": { description: "Returns reseller session token" } },
    },
  },
  "/resellers/{id}/notices": {
    post: {
      tags: ["Resellers"],
      summary: "Push in-app notice to reseller",
      parameters: pathId(),
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                title: { type: "string" as const },
                body: { type: "string" as const },
              },
            },
          },
        },
      },
      responses: { "200": { description: "Notice created" } },
    },
  },
  "/resellers/{id}/platform-plan": {
    patch: {
      tags: ["Resellers", "Platform Plans"],
      summary: "Adjust reseller platform subscription",
      parameters: pathId(),
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                planId: { type: "string" as const },
                status: { type: "string" as const, enum: ["TRIAL", "ACTIVE", "PAST_DUE", "EXPIRED", "CANCELLED"] },
                currentPeriodEnd: { type: "string" as const, format: "date-time" },
              },
            },
          },
        },
      },
      responses: { "200": { description: "Subscription updated" } },
    },
  },
};

/**
 * OpenAPI — Auth, Public, Customer, Legacy stubs, static assets.
 * Served at GET /api/docs/platform
 */
export const platformSwaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "SSDomada — Auth, Public & Misc API",
    version: "1.0.0",
    description:
      "Authentication, public marketing endpoints, end-user dashboard, legacy stubs, cron, webhooks, and static captive assets. Paths are absolute from site root.",
    contact: { name: "SSDomada Support" },
  },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Auth", description: "Login, register, session" },
    { name: "Public", description: "No auth — pricing & landing" },
    { name: "Customer", description: "End-user WiFi customer" },
    { name: "Legacy", description: "Deprecated or placeholder routes" },
    { name: "Assets", description: "Static files" },
    { name: "Meta", description: "Documentation" },
  ],
  paths: {
    "/api/docs/platform": {
      get: {
        tags: ["Meta"],
        summary: "OpenAPI JSON (this document)",
        responses: { "200": { description: "OpenAPI spec" } },
      },
    },
    "/api/v1/auth": {
      get: {
        tags: ["Auth"],
        summary: "Current session user",
        description: "Cookie ssdomada_session or Bearer token.",
        responses: {
          "200": { description: "User + reseller profile if applicable" },
          "401": { description: "Not logged in" },
        },
      },
      post: {
        tags: ["Auth"],
        summary: "Login, register, or logout",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["action"],
                properties: {
                  action: { type: "string" as const, enum: ["login", "register", "logout"] },
                  email: { type: "string" as const, format: "email" },
                  password: { type: "string" as const },
                  role: { type: "string" as const, enum: ["RESELLER", "END_USER"] },
                  name: { type: "string" as const },
                  phone: { type: "string" as const },
                  companyName: { type: "string" as const },
                  brandSlug: { type: "string" as const },
                  planSlug: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Token + user; sets httpOnly cookie" }, "401": { description: "Invalid credentials" } },
      },
      delete: {
        tags: ["Auth"],
        summary: "Logout (alias)",
        responses: { "200": { description: "Session cleared" } },
      },
    },
    "/api/v1/plans": {
      get: {
        tags: ["Public"],
        summary: "Public SSDomada reseller pricing tiers",
        security: [],
        responses: { "200": { description: "Active ResellerPlan list" } },
      },
    },
    "/api/v1/public/landing-page": {
      get: {
        tags: ["Public"],
        summary: "Marketing landing page CMS content",
        security: [],
        responses: { "200": { description: "Hero, CTA, footer, contact, social, SEO" } },
      },
    },
    "/api/v1/public/platform-stats": {
      get: {
        tags: ["Public"],
        summary: "Anonymous stats for landing page",
        security: [],
        responses: { "200": { description: "Aggregate counts" } },
      },
    },
    "/api/v1/customer/dashboard": {
      get: {
        tags: ["Customer"],
        summary: "End-user dashboard (subscriptions, spend)",
        responses: { "200": { description: "Customer dashboard data" }, "401": { description: "Unauthorized" } },
      },
    },
    "/api/public/captive/{resellerId}/{file}": {
      get: {
        tags: ["Assets"],
        summary: "Serve uploaded captive portal image",
        security: [],
        parameters: [
          { name: "resellerId", in: "path" as const, required: true, schema: { type: "string" as const } },
          { name: "file", in: "path" as const, required: true, schema: { type: "string" as const } },
        ],
        responses: { "200": { description: "Image file" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/captive-portal": {
      get: {
        tags: ["Legacy"],
        summary: "Deprecated — use /api/portal/{slug}",
        deprecated: true,
        responses: { "410": { description: "Gone" } },
      },
      post: {
        tags: ["Legacy"],
        summary: "Deprecated",
        deprecated: true,
        responses: { "410": { description: "Gone" } },
      },
    },
    "/api/auth": {
      get: { tags: ["Legacy"], summary: "Legacy stub", deprecated: true, responses: { "200": { description: "Stub message" } } },
    },
    "/api/payments": {
      get: { tags: ["Legacy"], summary: "Legacy stub", deprecated: true, responses: { "200": { description: "Stub message" } } },
    },
    "/api/resellers": {
      get: { tags: ["Legacy"], summary: "Legacy stub", deprecated: true, responses: { "200": { description: "Stub message" } } },
    },
    "/api/subscriptions": {
      get: { tags: ["Legacy"], summary: "Legacy stub", deprecated: true, responses: { "200": { description: "Stub message" } } },
    },
    "/api/upload": {
      post: { tags: ["Legacy"], summary: "Legacy stub", deprecated: true, responses: { "200": { description: "Stub message" } } },
    },
    "/api/omada/sites": {
      get: { tags: ["Legacy"], summary: "Legacy stub — use /api/v1/admin/omada/sites", deprecated: true, responses: { "200": { description: "Stub" } } },
    },
    "/api/omada/devices": {
      get: { tags: ["Legacy"], summary: "Legacy stub", deprecated: true, responses: { "200": { description: "Stub" } } },
    },
    "/api/omada/clients": {
      get: { tags: ["Legacy"], summary: "Legacy stub", deprecated: true, responses: { "200": { description: "Stub" } } },
    },
    "/api/omada/authorize": {
      post: { tags: ["Legacy"], summary: "Legacy stub", deprecated: true, responses: { "200": { description: "Stub" } } },
    },
    "/api/captive": {
      get: { tags: ["Legacy"], summary: "Legacy captive stub", deprecated: true, responses: { "200": { description: "Stub" } } },
    },
    "/api/webhooks": {
      post: { tags: ["Legacy"], summary: "Legacy webhook stub — use /api/webhooks/snippe", deprecated: true, responses: { "200": { description: "Stub" } } },
    },
    "/api/v1/devices": {
      get: { tags: ["Legacy"], summary: "Unimplemented v1 stub", deprecated: true, responses: { "501": { description: "Not implemented" } } },
      post: { tags: ["Legacy"], summary: "Unimplemented v1 stub", deprecated: true, responses: { "501": { description: "Not implemented" } } },
    },
    "/api/v1/sites": {
      get: { tags: ["Legacy"], summary: "Unimplemented — use /api/v1/reseller/sites", deprecated: true, responses: { "501": { description: "Not implemented" } } },
      post: { tags: ["Legacy"], summary: "Unimplemented", deprecated: true, responses: { "501": { description: "Not implemented" } } },
    },
    "/api/v1/resellers": {
      get: { tags: ["Legacy"], summary: "Unimplemented — use /api/v1/admin/resellers", deprecated: true, responses: { "501": { description: "Not implemented" } } },
      post: { tags: ["Legacy"], summary: "Unimplemented", deprecated: true, responses: { "501": { description: "Not implemented" } } },
    },
    "/api/v1/subscriptions": {
      get: { tags: ["Legacy"], summary: "Unimplemented", deprecated: true, responses: { "501": { description: "Not implemented" } } },
      post: { tags: ["Legacy"], summary: "Unimplemented", deprecated: true, responses: { "501": { description: "Not implemented" } } },
    },
    "/api/v1/payments": {
      get: { tags: ["Legacy"], summary: "Unimplemented", deprecated: true, responses: { "501": { description: "Not implemented" } } },
      post: { tags: ["Legacy"], summary: "Unimplemented", deprecated: true, responses: { "501": { description: "Not implemented" } } },
    },
    "/api/v1/omada": {
      get: { tags: ["Legacy"], summary: "Unimplemented — use admin/reseller Omada routes", deprecated: true, responses: { "501": { description: "Not implemented" } } },
      post: { tags: ["Legacy"], summary: "Unimplemented", deprecated: true, responses: { "501": { description: "Not implemented" } } },
    },
  },
};

/**
 * OpenAPI/Swagger specification for SSDomada Admin API
 */
export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "SSDomada WiFi Billing System — Admin API",
    version: "1.0.0",
    description: "Super Admin backend API for managing resellers, devices, payments, Omada controller, and system settings.",
    contact: { name: "SSDomada Support" },
  },
  servers: [
    { url: "/api/v1/admin", description: "Admin API v1" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        description: "Session token from authentication",
      },
    },
    schemas: {
      Error: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const, example: false },
          error: { type: "string" as const },
          code: { type: "string" as const },
        },
      },
      Pagination: {
        type: "object" as const,
        properties: {
          page: { type: "integer" as const },
          limit: { type: "integer" as const },
          total: { type: "integer" as const },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Get dashboard overview",
        description: "Returns comprehensive system stats: revenue (today/week/month/year), reseller counts, device status, active clients, pending withdrawals, recent activity.",
        responses: { "200": { description: "Dashboard data" } },
      },
    },
    "/resellers": {
      get: {
        tags: ["Resellers"],
        summary: "List all resellers",
        parameters: [
          { name: "page", in: "query" as const, schema: { type: "integer" as const, default: 1 } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const, default: 20 } },
          { name: "search", in: "query" as const, schema: { type: "string" as const }, description: "Search by name, email, brand slug" },
          { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["active", "suspended", "all"] } },
          { name: "sortBy", in: "query" as const, schema: { type: "string" as const, default: "createdAt" } },
          { name: "sortOrder", in: "query" as const, schema: { type: "string" as const, enum: ["asc", "desc"] } },
        ],
        responses: { "200": { description: "Paginated list of resellers with revenue data" } },
      },
      post: {
        tags: ["Resellers"],
        summary: "Create a new reseller",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["name", "email", "password", "companyName", "brandSlug"],
                properties: {
                  name: { type: "string" as const, example: "John Doe" },
                  email: { type: "string" as const, example: "john@example.com" },
                  password: { type: "string" as const, minLength: 8 },
                  companyName: { type: "string" as const, example: "Hotel WiFi TZ" },
                  brandSlug: { type: "string" as const, example: "hotel-wifi-tz" },
                  phone: { type: "string" as const },
                  address: { type: "string" as const },
                  commissionRate: { type: "number" as const, default: 0.10, description: "Platform commission (0-1)" },
                  currency: { type: "string" as const, default: "TZS" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Reseller created" },
          "409": { description: "Email or brand slug already exists" },
          "422": { description: "Validation error" },
        },
      },
    },
    "/resellers/{id}": {
      get: {
        tags: ["Resellers"],
        summary: "Get reseller details",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Reseller profile with sites, revenue, devices, packages" } },
      },
      patch: {
        tags: ["Resellers"],
        summary: "Update or suspend/activate reseller",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  action: { type: "string" as const, enum: ["suspend", "activate"], description: "Special actions" },
                  reason: { type: "string" as const, description: "Reason for suspension" },
                  companyName: { type: "string" as const },
                  brandSlug: { type: "string" as const },
                  commissionRate: { type: "number" as const },
                  isActive: { type: "boolean" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Reseller updated" } },
      },
      delete: {
        tags: ["Resellers"],
        summary: "Permanently delete reseller and all data",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Reseller deleted" } },
      },
    },
    "/devices": {
      get: {
        tags: ["Devices"],
        summary: "List all devices globally",
        parameters: [
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
          { name: "search", in: "query" as const, schema: { type: "string" as const }, description: "MAC, name, IP, model" },
          { name: "resellerId", in: "query" as const, schema: { type: "string" as const } },
          { name: "siteId", in: "query" as const, schema: { type: "string" as const } },
          { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["ONLINE", "OFFLINE", "PENDING"] } },
          { name: "type", in: "query" as const, schema: { type: "string" as const, enum: ["AP", "SWITCH", "GATEWAY", "OTHER"] } },
        ],
        responses: { "200": { description: "Devices list with status summary" } },
      },
    },
    "/devices/{id}": {
      get: { tags: ["Devices"], summary: "Get device details", parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }], responses: { "200": { description: "Device details" } } },
      patch: {
        tags: ["Devices"],
        summary: "Update device or forget (remove)",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        requestBody: { content: { "application/json": { schema: { type: "object" as const, properties: { action: { type: "string" as const, enum: ["forget"] }, name: { type: "string" as const }, type: { type: "string" as const, enum: ["AP", "SWITCH", "GATEWAY", "OTHER"] } } } } } },
        responses: { "200": { description: "Device updated or removed" } },
      },
    },
    "/payments": {
      get: {
        tags: ["Payments"],
        summary: "List all payments (Snippe collections)",
        parameters: [
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
          { name: "resellerId", in: "query" as const, schema: { type: "string" as const } },
          { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["PENDING", "COMPLETED", "FAILED", "EXPIRED"] } },
          { name: "paymentType", in: "query" as const, schema: { type: "string" as const, enum: ["MOBILE", "CARD", "SESSION", "QR"] } },
          { name: "startDate", in: "query" as const, schema: { type: "string" as const, format: "date-time" } },
          { name: "endDate", in: "query" as const, schema: { type: "string" as const, format: "date-time" } },
          { name: "search", in: "query" as const, schema: { type: "string" as const }, description: "Snippe ref, phone, email, name" },
        ],
        responses: { "200": { description: "Payments list with revenue summary" } },
      },
    },
    "/payouts": {
      get: {
        tags: ["Payouts & Withdrawals"],
        summary: "List withdrawal requests or processed payouts",
        parameters: [
          { name: "view", in: "query" as const, schema: { type: "string" as const, enum: ["withdrawals", "payouts"], default: "withdrawals" } },
          { name: "status", in: "query" as const, schema: { type: "string" as const } },
          { name: "resellerId", in: "query" as const, schema: { type: "string" as const } },
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
        ],
        responses: { "200": { description: "Withdrawals or payouts list" } },
      },
    },
    "/payouts/{id}": {
      get: { tags: ["Payouts & Withdrawals"], summary: "Get withdrawal details", parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }], responses: { "200": { description: "Withdrawal with payout details" } } },
      patch: {
        tags: ["Payouts & Withdrawals"],
        summary: "Approve, reject, or process withdrawal",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["action"],
                properties: {
                  action: { type: "string" as const, enum: ["approve", "reject", "process"], description: "approve → ready for payout, reject → refund wallet, process → trigger Snippe payout" },
                  adminNote: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Withdrawal status updated" } },
      },
    },
    "/subscriptions": {
      get: {
        tags: ["Subscriptions & Packages"],
        summary: "List packages or subscriptions",
        parameters: [
          { name: "view", in: "query" as const, schema: { type: "string" as const, enum: ["packages", "subscriptions"], default: "packages" } },
          { name: "resellerId", in: "query" as const, schema: { type: "string" as const } },
          { name: "status", in: "query" as const, schema: { type: "string" as const } },
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
        ],
        responses: { "200": { description: "Packages or subscriptions list" } },
      },
      post: {
        tags: ["Subscriptions & Packages"],
        summary: "Create a WiFi package for a reseller",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["resellerId", "name", "price", "duration", "durationMinutes"],
                properties: {
                  resellerId: { type: "string" as const },
                  name: { type: "string" as const, example: "1 Hour WiFi" },
                  price: { type: "integer" as const, example: 1000, description: "Price in TZS" },
                  duration: { type: "string" as const, enum: ["MINUTES_30", "HOUR_1", "HOURS_3", "HOURS_6", "HOURS_12", "HOURS_24", "DAYS_3", "DAYS_7", "DAYS_14", "DAYS_30"] },
                  durationMinutes: { type: "integer" as const, example: 60 },
                  dataLimitMb: { type: "integer" as const },
                  speedLimitUp: { type: "integer" as const, description: "Kbps" },
                  speedLimitDown: { type: "integer" as const, description: "Kbps" },
                  maxDevices: { type: "integer" as const, default: 1 },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Package created" } },
      },
    },
    "/subscriptions/{id}": {
      get: { tags: ["Subscriptions & Packages"], summary: "Get package details with subscription stats", parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }], responses: { "200": { description: "Package with revenue and subscriptions" } } },
      patch: {
        tags: ["Subscriptions & Packages"],
        summary: "Update or toggle package",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Package updated" } },
      },
      delete: { tags: ["Subscriptions & Packages"], summary: "Delete package (no active subscriptions)", parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }], responses: { "200": { description: "Package deleted" }, "409": { description: "Has active subscriptions" } } },
    },
    "/customers": {
      get: {
        tags: ["Customers"],
        summary: "List all WiFi customers (end users)",
        parameters: [
          { name: "search", in: "query" as const, schema: { type: "string" as const }, description: "Phone, email, name, MAC" },
          { name: "isActive", in: "query" as const, schema: { type: "boolean" as const } },
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
        ],
        responses: { "200": { description: "Customers with latest session, total spent, active subscription" } },
      },
    },
    "/customers/{id}": {
      get: { tags: ["Customers"], summary: "Get customer full profile", parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }], responses: { "200": { description: "Customer with subscriptions, payments, WiFi sessions" } } },
      patch: {
        tags: ["Customers"],
        summary: "Block or unblock customer",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        requestBody: { content: { "application/json": { schema: { type: "object" as const, properties: { action: { type: "string" as const, enum: ["block", "unblock"] }, reason: { type: "string" as const } } } } } },
        responses: { "200": { description: "Customer blocked/unblocked" } },
      },
    },
    "/omada/sites": {
      get: {
        tags: ["Omada Controller"],
        summary: "List Omada sites (DB + live from controller)",
        parameters: [{ name: "source", in: "query" as const, schema: { type: "string" as const, enum: ["db", "omada", "both"], default: "both" } }],
        responses: { "200": { description: "Sites with controller sync status" } },
      },
    },
    "/omada/devices": {
      get: {
        tags: ["Omada Controller"],
        summary: "List devices from Omada Controller for a site",
        parameters: [{ name: "siteId", in: "query" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Devices with live status, unregistered devices" } },
      },
      post: {
        tags: ["Omada Controller"],
        summary: "Sync device status from Omada Controller",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" as const, required: ["siteId"], properties: { siteId: { type: "string" as const } } } } } },
        responses: { "200": { description: "Sync completed" } },
      },
    },
    "/omada/clients": {
      get: {
        tags: ["Omada Controller"],
        summary: "List currently connected WiFi clients",
        parameters: [{ name: "siteId", in: "query" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Connected clients from Omada" } },
      },
    },
    "/analytics": {
      get: {
        tags: ["Analytics"],
        summary: "Revenue analytics, reseller performance, user growth",
        parameters: [
          { name: "period", in: "query" as const, schema: { type: "string" as const, enum: ["7d", "30d", "90d", "1y", "all"], default: "30d" } },
          { name: "type", in: "query" as const, schema: { type: "string" as const, enum: ["overview", "revenue", "resellers", "users"], default: "overview" } },
        ],
        responses: { "200": { description: "Analytics data based on type and period" } },
      },
    },
    "/settings": {
      get: {
        tags: ["Settings"],
        summary: "Get system settings or health check",
        parameters: [{ name: "section", in: "query" as const, schema: { type: "string" as const, enum: ["all", "general", "snippe", "omada", "health"], default: "all" } }],
        responses: { "200": { description: "System settings or health status" } },
      },
      put: {
        tags: ["Settings"],
        summary: "Create or update system settings",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["key", "value"],
                properties: {
                  key: { type: "string" as const, example: "general.platform_name" },
                  value: { type: "string" as const, example: "SSDomada WiFi" },
                  type: { type: "string" as const, enum: ["string", "number", "boolean", "json"], default: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Setting saved" } },
      },
    },
    "/audit-logs": {
      get: {
        tags: ["Audit Logs"],
        summary: "Browse audit trail",
        parameters: [
          { name: "action", in: "query" as const, schema: { type: "string" as const }, description: "e.g. reseller.created, withdrawal.approved" },
          { name: "entity", in: "query" as const, schema: { type: "string" as const }, description: "Reseller, Payment, Device, etc." },
          { name: "userId", in: "query" as const, schema: { type: "string" as const } },
          { name: "startDate", in: "query" as const, schema: { type: "string" as const, format: "date-time" } },
          { name: "endDate", in: "query" as const, schema: { type: "string" as const, format: "date-time" } },
          { name: "search", in: "query" as const, schema: { type: "string" as const } },
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
        ],
        responses: { "200": { description: "Audit logs with user info" } },
      },
    },
  },
};

/**
 * OpenAPI/Swagger specification for SSDomada Reseller API
 */
export const resellerSwaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "SSDomada WiFi Billing — Reseller API",
    version: "1.0.0",
    description:
      "Reseller backend API for managing devices, packages, clients, payments, captive portal, analytics, and settings. All data is tenant-scoped — a reseller can only access their own data.",
    contact: { name: "SSDomada Support" },
  },
  servers: [{ url: "/api/v1/reseller", description: "Reseller API v1" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        description: "Session token from reseller authentication",
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
    // ============================================================
    // DASHBOARD
    // ============================================================
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Reseller dashboard overview",
        description:
          "Revenue (today/week/month/all-time), active clients, device counts, wallet balance, pending withdrawals, popular packages.",
        responses: {
          "200": { description: "Dashboard data" },
          "401": { description: "Unauthorized" },
          "403": { description: "Not a reseller / suspended" },
        },
      },
    },

    // ============================================================
    // DEVICES
    // ============================================================
    "/devices": {
      get: {
        tags: ["Devices"],
        summary: "List reseller's devices",
        parameters: [
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
          { name: "siteId", in: "query" as const, schema: { type: "string" as const } },
          { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["ONLINE", "OFFLINE", "PENDING"] } },
          { name: "type", in: "query" as const, schema: { type: "string" as const, enum: ["AP", "SWITCH", "GATEWAY", "OTHER"] } },
          { name: "search", in: "query" as const, schema: { type: "string" as const }, description: "MAC, name, IP, model" },
        ],
        responses: { "200": { description: "Device list with status summary" } },
      },
      post: {
        tags: ["Devices"],
        summary: "Add a new device by MAC",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["name", "mac", "siteId"],
                properties: {
                  name: { type: "string" as const },
                  mac: { type: "string" as const, example: "AA:BB:CC:DD:EE:FF" },
                  siteId: { type: "string" as const },
                  type: { type: "string" as const, enum: ["AP", "SWITCH", "GATEWAY", "OTHER"] },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Device created" }, "409": { description: "MAC already exists" } },
      },
    },
    "/devices/{id}": {
      get: {
        tags: ["Devices"],
        summary: "Device detail with live Omada status",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Device detail + live data" } },
      },
      patch: {
        tags: ["Devices"],
        summary: "Update device or perform action (reboot/forget)",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  action: { type: "string" as const, enum: ["reboot", "forget"] },
                  name: { type: "string" as const },
                  type: { type: "string" as const },
                  siteId: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated / action performed" } },
      },
      delete: {
        tags: ["Devices"],
        summary: "Delete device",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Device deleted" } },
      },
    },
    "/devices/{id}/clients": {
      get: {
        tags: ["Devices"],
        summary: "Connected clients on a specific AP",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Live client list from Omada" } },
      },
      post: {
        tags: ["Devices"],
        summary: "Disconnect or block a client on an AP",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["action", "clientMac"],
                properties: {
                  action: { type: "string" as const, enum: ["disconnect", "block"] },
                  clientMac: { type: "string" as const },
                  reason: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Client action performed" } },
      },
    },

    // ============================================================
    // SSID MANAGEMENT
    // ============================================================
    "/ssids": {
      get: {
        tags: ["SSID Management"],
        summary: "List SSIDs across all sites",
        parameters: [{ name: "siteId", in: "query" as const, schema: { type: "string" as const } }],
        responses: { "200": { description: "SSID list" } },
      },
      post: {
        tags: ["SSID Management"],
        summary: "Create new SSID for a site",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["siteId", "ssidName"],
                properties: {
                  siteId: { type: "string" as const },
                  ssidName: { type: "string" as const, maxLength: 32 },
                  password: { type: "string" as const, description: "Null = open network (captive portal)" },
                  isHidden: { type: "boolean" as const },
                  band: { type: "string" as const, enum: ["2.4GHz", "5GHz", "both"] },
                  vlanId: { type: "integer" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "SSID created" } },
      },
    },
    "/ssids/{id}": {
      patch: {
        tags: ["SSID Management"],
        summary: "Edit SSID or toggle enable/disable",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "SSID updated" } },
      },
      delete: {
        tags: ["SSID Management"],
        summary: "Delete SSID",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "SSID deleted" } },
      },
    },

    // ============================================================
    // SITES
    // ============================================================
    "/sites": {
      get: {
        tags: ["Sites"],
        summary: "List reseller's sites (locations)",
        responses: { "200": { description: "Site list with device/session counts" } },
      },
      post: {
        tags: ["Sites"],
        summary: "Create a new site",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["name"],
                properties: {
                  name: { type: "string" as const },
                  location: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Site created" } },
      },
    },

    // ============================================================
    // PACKAGES
    // ============================================================
    "/packages": {
      get: {
        tags: ["Packages"],
        summary: "List WiFi packages with sales stats",
        parameters: [
          { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["active", "inactive", "all"] } },
        ],
        responses: { "200": { description: "Packages with revenue data" } },
      },
      post: {
        tags: ["Packages"],
        summary: "Create a new WiFi package",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["name", "price", "duration", "durationMinutes"],
                properties: {
                  name: { type: "string" as const },
                  description: { type: "string" as const },
                  price: { type: "number" as const, minimum: 100, description: "Price in TZS" },
                  duration: { type: "string" as const, enum: ["MINUTES_30", "HOUR_1", "HOURS_3", "HOURS_6", "HOURS_12", "HOURS_24", "DAYS_3", "DAYS_7", "DAYS_14", "DAYS_30", "DAYS_90", "DAYS_365", "LIFETIME", "UNLIMITED"] },
                  durationMinutes: { type: "integer" as const },
                  dataLimitMb: { type: "integer" as const },
                  speedLimitUp: { type: "integer" as const, description: "Kbps" },
                  speedLimitDown: { type: "integer" as const, description: "Kbps" },
                  maxDevices: { type: "integer" as const, default: 1 },
                  isFeatured: { type: "boolean" as const },
                  sortOrder: { type: "integer" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Package created" } },
      },
    },
    "/packages/{id}": {
      get: {
        tags: ["Packages"],
        summary: "Package detail with subscribers and revenue",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Package detail" } },
      },
      patch: {
        tags: ["Packages"],
        summary: "Update package, toggle active/featured",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  action: { type: "string" as const, enum: ["toggle", "feature"], description: "Toggle active or featured" },
                  name: { type: "string" as const },
                  price: { type: "number" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Package updated" } },
      },
      delete: {
        tags: ["Packages"],
        summary: "Delete package (fails if active subscriptions exist)",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Package deleted" }, "409": { description: "Active subscriptions exist" } },
      },
    },

    // ============================================================
    // CLIENTS
    // ============================================================
    "/clients": {
      get: {
        tags: ["Clients"],
        summary: "List all WiFi customers",
        parameters: [
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
          { name: "search", in: "query" as const, schema: { type: "string" as const }, description: "Phone, email, name, MAC" },
          { name: "format", in: "query" as const, schema: { type: "string" as const, enum: ["json", "csv"] }, description: "csv for export" },
        ],
        responses: { "200": { description: "Client list with spending data" } },
      },
      post: {
        tags: ["Clients"],
        summary: "Block a MAC address",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["mac"],
                properties: {
                  mac: { type: "string" as const, example: "AA:BB:CC:DD:EE:FF" },
                  reason: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "MAC blocked" } },
      },
    },
    "/clients/{id}": {
      get: {
        tags: ["Clients"],
        summary: "Full client profile with sessions, payments, blocked status",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        responses: { "200": { description: "Client profile" } },
      },
      patch: {
        tags: ["Clients"],
        summary: "Block or unblock a client MAC",
        parameters: [{ name: "id", in: "path" as const, required: true, schema: { type: "string" as const } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["action", "mac"],
                properties: {
                  action: { type: "string" as const, enum: ["block", "unblock"] },
                  mac: { type: "string" as const },
                  reason: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Client updated" } },
      },
    },
    "/clients/vouchers": {
      get: {
        tags: ["Vouchers"],
        summary: "List all voucher codes",
        parameters: [
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
          { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["used", "unused", "expired"] } },
        ],
        responses: { "200": { description: "Voucher list" } },
      },
      post: {
        tags: ["Vouchers"],
        summary: "Generate batch voucher codes for a package",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["packageId"],
                properties: {
                  packageId: { type: "string" as const },
                  quantity: { type: "integer" as const, minimum: 1, maximum: 100, default: 1 },
                  expiresAt: { type: "string" as const, format: "date-time" },
                  note: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Vouchers generated" } },
      },
    },

    // ============================================================
    // CAPTIVE PORTAL
    // ============================================================
    "/captive-portal": {
      get: {
        tags: ["Captive Portal"],
        summary: "Get captive portal config, packages, and preview URL",
        responses: { "200": { description: "Portal config with available templates" } },
      },
      put: {
        tags: ["Captive Portal"],
        summary: "Update captive portal branding",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  logo: { type: "string" as const, format: "uri", nullable: true },
                  bgImage: { type: "string" as const, format: "uri", nullable: true },
                  bgColor: { type: "string" as const, example: "#ffffff" },
                  primaryColor: { type: "string" as const, example: "#0070f3" },
                  accentColor: { type: "string" as const, example: "#00c853" },
                  companyName: { type: "string" as const },
                  welcomeText: { type: "string" as const },
                  termsUrl: { type: "string" as const, format: "uri", nullable: true },
                  termsText: { type: "string" as const },
                  template: { type: "string" as const, enum: ["default", "modern", "minimal", "dark"] },
                  redirectUrl: { type: "string" as const, format: "uri" },
                  showLogo: { type: "boolean" as const },
                  showSocial: { type: "boolean" as const },
                  socialLinks: {
                    type: "object" as const,
                    properties: {
                      facebook: { type: "string" as const },
                      instagram: { type: "string" as const },
                      twitter: { type: "string" as const },
                      whatsapp: { type: "string" as const },
                    },
                  },
                  customCss: { type: "string" as const },
                  customHtml: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Portal config updated" } },
      },
    },

    // ============================================================
    // PAYMENTS
    // ============================================================
    "/payments": {
      get: {
        tags: ["Payments"],
        summary: "All payments with revenue summary and chart",
        parameters: [
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
          { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["PENDING", "COMPLETED", "FAILED", "EXPIRED"] } },
          { name: "startDate", in: "query" as const, schema: { type: "string" as const, format: "date" } },
          { name: "endDate", in: "query" as const, schema: { type: "string" as const, format: "date" } },
          { name: "search", in: "query" as const, schema: { type: "string" as const }, description: "Phone, email, or reference" },
          { name: "view", in: "query" as const, schema: { type: "string" as const, enum: ["list", "chart"] } },
        ],
        responses: { "200": { description: "Payments with summary or chart data" } },
      },
    },

    // ============================================================
    // WITHDRAWALS
    // ============================================================
    "/withdrawals": {
      get: {
        tags: ["Withdrawals"],
        summary: "Withdrawal history and wallet balance",
        parameters: [
          { name: "page", in: "query" as const, schema: { type: "integer" as const } },
          { name: "limit", in: "query" as const, schema: { type: "integer" as const } },
          { name: "status", in: "query" as const, schema: { type: "string" as const, enum: ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED"] } },
        ],
        responses: { "200": { description: "Withdrawals with wallet info" } },
      },
      post: {
        tags: ["Withdrawals"],
        summary: "Request a withdrawal (Mobile Money or Bank)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["amount", "channel", "recipientName"],
                properties: {
                  amount: { type: "integer" as const, minimum: 1000, description: "Amount in TZS" },
                  channel: { type: "string" as const, enum: ["MOBILE", "BANK"] },
                  recipientPhone: { type: "string" as const, description: "Required for MOBILE" },
                  recipientAccount: { type: "string" as const, description: "Required for BANK" },
                  recipientBank: { type: "string" as const, description: "Required for BANK" },
                  recipientName: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Withdrawal request created" },
          "400": { description: "Insufficient balance" },
          "409": { description: "Pending withdrawal exists" },
        },
      },
    },

    // ============================================================
    // PROFILE
    // ============================================================
    "/profile": {
      get: {
        tags: ["Profile"],
        summary: "Reseller business profile and stats",
        responses: { "200": { description: "Full reseller profile" } },
      },
      patch: {
        tags: ["Profile"],
        summary: "Update business profile (name, logo, phone, etc.)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  companyName: { type: "string" as const },
                  phone: { type: "string" as const },
                  address: { type: "string" as const },
                  logo: { type: "string" as const, format: "uri", nullable: true },
                  description: { type: "string" as const },
                  name: { type: "string" as const, description: "Also updates user display name" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Profile updated" } },
      },
    },

    // ============================================================
    // ANALYTICS
    // ============================================================
    "/analytics": {
      get: {
        tags: ["Analytics"],
        summary: "Revenue reports, client growth, popular packages, usage, CSV export",
        parameters: [
          { name: "type", in: "query" as const, required: true, schema: { type: "string" as const, enum: ["revenue", "clients", "packages", "usage", "export"] } },
          { name: "period", in: "query" as const, schema: { type: "string" as const, enum: ["7d", "30d", "90d", "1y"], default: "30d" } },
        ],
        responses: {
          "200": { description: "Analytics data or CSV file" },
        },
      },
    },

    // ============================================================
    // SETTINGS
    // ============================================================
    "/settings": {
      get: {
        tags: ["Settings"],
        summary: "Get account settings, notifications, security info",
        responses: { "200": { description: "Settings data" } },
      },
      put: {
        tags: ["Settings"],
        summary: "Change password or update notifications",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["action"],
                properties: {
                  action: { type: "string" as const, enum: ["password", "notifications"] },
                  currentPassword: { type: "string" as const, description: "Required for password action" },
                  newPassword: { type: "string" as const },
                  confirmPassword: { type: "string" as const },
                  emailOnPayment: { type: "boolean" as const },
                  emailOnWithdrawal: { type: "boolean" as const },
                  emailOnNewClient: { type: "boolean" as const },
                  emailOnDeviceDown: { type: "boolean" as const },
                  smsOnPayment: { type: "boolean" as const },
                  smsOnWithdrawal: { type: "boolean" as const },
                  smsOnDeviceDown: { type: "boolean" as const },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Settings updated" } },
      },
    },
  },
};

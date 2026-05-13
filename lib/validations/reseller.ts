import { z } from "zod";

// ============================================================
// Pagination
// ============================================================

/** URLSearchParams.get() returns `null` when absent; treat like undefined so .default() applies. */
const emptyToUndef = (v: unknown) => (v === null || v === "" ? undefined : v);

export const paginationSchema = z.object({
  page: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).default(1)),
  limit: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(100).default(20)),
});

// ============================================================
// Packages
// ============================================================

export const createPackageSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
  price: z.number().min(100), // Minimum 100 TZS
  currency: z.string().default("TZS"),
  duration: z.enum([
    "MINUTES_30", "HOUR_1", "HOURS_3", "HOURS_6", "HOURS_12", "HOURS_24",
    "DAYS_3", "DAYS_7", "DAYS_14", "DAYS_30", "DAYS_90", "DAYS_365",
    "LIFETIME", "UNLIMITED",
  ]),
  durationMinutes: z.number().int().min(1),
  dataLimitMb: z.number().int().min(1).optional(),
  speedLimitUp: z.number().int().min(1).optional(),
  speedLimitDown: z.number().int().min(1).optional(),
  maxDevices: z.number().int().min(1).default(1),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const updatePackageSchema = createPackageSchema.partial();

// ============================================================
// Devices
// ============================================================

/** Omada `start-adopt` may require the AP’s current web UI credentials if they were changed from defaults. */
export const deviceAdoptCredentialsSchema = z
  .object({
    deviceUsername: z.string().min(1).max(64).optional(),
    devicePassword: z.string().min(1).max(128).optional(),
  })
  .refine(
    (d) => {
      const hasU = Boolean(d.deviceUsername?.trim());
      const hasP = Boolean(d.devicePassword);
      return (hasU && hasP) || (!hasU && !hasP);
    },
    {
      message: "Provide both deviceUsername and devicePassword for Omada adopt, or leave both empty to use server defaults (OMADA_DEVICE_*).",
      path: ["devicePassword"],
    }
  );

export const addDeviceSchema = z
  .object({
    name: z.string().min(1).max(100),
    mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "Invalid MAC address format (XX:XX:XX:XX:XX:XX)"),
    // Site primary keys may be fixed seed ids (e.g. seed-site-1) or Prisma cuids; ownership is enforced in the route.
    siteId: z.string().min(1).max(128),
    type: z.enum(["AP", "SWITCH", "GATEWAY", "OTHER"]).default("AP"),
    deviceUsername: z.string().min(1).max(64).optional(),
    devicePassword: z.string().min(1).max(128).optional(),
  })
  .superRefine((d, ctx) => {
    const r = deviceAdoptCredentialsSchema.safeParse({
      deviceUsername: d.deviceUsername,
      devicePassword: d.devicePassword,
    });
    if (!r.success) {
      for (const iss of r.error.issues) {
        ctx.addIssue({ ...iss, path: iss.path });
      }
    }
  });

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["AP", "SWITCH", "GATEWAY", "OTHER"]).optional(),
  siteId: z.string().min(1).max(128).optional(),
});

// ============================================================
// SSID Management
// ============================================================

export const createSsidSchema = z.object({
  siteId: z.string().cuid(),
  ssidName: z.string().min(1).max(32),
  password: z.string().min(8).max(63).optional(), // null = open network
  isHidden: z.boolean().default(false),
  band: z.enum(["2.4GHz", "5GHz", "both"]).default("2.4GHz"),
  vlanId: z.number().int().min(1).max(4094).optional(),
});

export const updateSsidSchema = createSsidSchema.partial().omit({ siteId: true });

// ============================================================
// Sites
// ============================================================

export const createSiteSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.string().max(200).optional(),
});

export const updateSiteSchema = createSiteSchema.partial();

// ============================================================
// Withdrawals
// ============================================================

export const requestWithdrawalSchema = z.object({
  amount: z.number().int().min(1000), // Minimum 1000 TZS
  channel: z.enum(["MOBILE", "BANK"]),
  recipientPhone: z.string().optional(),
  recipientAccount: z.string().optional(),
  recipientBank: z.string().optional(),
  recipientName: z.string().min(2).max(100),
}).refine(
  (data) => {
    if (data.channel === "MOBILE") return !!data.recipientPhone;
    if (data.channel === "BANK") return !!data.recipientAccount && !!data.recipientBank;
    return false;
  },
  { message: "Mobile channel requires recipientPhone; Bank channel requires recipientAccount and recipientBank" }
);

// ============================================================
// Captive Portal
// ============================================================

export const updateCaptivePortalSchema = z.object({
  logo: z.string().url().optional().nullable(),
  bgImage: z.string().url().optional().nullable(),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  companyName: z.string().max(100).optional(),
  welcomeText: z.string().max(300).optional(),
  termsUrl: z.string().url().optional().nullable(),
  termsText: z.string().max(5000).optional().nullable(),
  customCss: z.string().max(10000).optional().nullable(),
  customHtml: z.string().max(10000).optional().nullable(),
  template: z.enum(["default", "modern", "minimal", "dark"]).optional(),
  redirectUrl: z.string().url().optional().nullable(),
  showLogo: z.boolean().optional(),
  showSocial: z.boolean().optional(),
  socialLinks: z.object({
    facebook: z.string().url().optional().or(z.literal("")),
    instagram: z.string().url().optional().or(z.literal("")),
    twitter: z.string().url().optional().or(z.literal("")),
    whatsapp: z.string().optional(),
  }).optional(),
});

// ============================================================
// Vouchers
// ============================================================

export const createVoucherSchema = z.object({
  packageId: z.string().cuid(),
  quantity: z.number().int().min(1).max(100).default(1), // batch create
  expiresAt: z.string().datetime().optional(),
  note: z.string().max(200).optional(),
});

// ============================================================
// Block MAC
// ============================================================

export const blockMacSchema = z.object({
  mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "Invalid MAC address"),
  reason: z.string().max(200).optional(),
});

// ============================================================
// Profile
// ============================================================

export const updateProfileSchema = z.object({
  companyName: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  address: z.string().max(200).optional(),
  logo: z.string().url().optional().nullable(),
  description: z.string().max(500).optional(),
});

// ============================================================
// Change Password
// ============================================================

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// ============================================================
// Notification Preferences
// ============================================================

export const updateNotificationSchema = z.object({
  emailOnPayment: z.boolean().optional(),
  emailOnWithdrawal: z.boolean().optional(),
  emailOnNewClient: z.boolean().optional(),
  emailOnDeviceDown: z.boolean().optional(),
  smsOnPayment: z.boolean().optional(),
  smsOnWithdrawal: z.boolean().optional(),
  smsOnDeviceDown: z.boolean().optional(),
  emailAddress: z.string().email().optional().nullable(),
  smsPhone: z.string().optional().nullable(),
});

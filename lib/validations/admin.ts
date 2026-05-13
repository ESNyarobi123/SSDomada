import { z } from "zod";

// ============================================================
// Pagination & Filtering
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================================
// Reseller
// ============================================================

export const createResellerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2).max(100),
  brandSlug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  phone: z.string().optional(),
  address: z.string().optional(),
  commissionRate: z.number().min(0).max(1).default(0.10),
  currency: z.string().default("TZS"),
});

export const updateResellerSchema = z.object({
  companyName: z.string().min(2).max(100).optional(),
  brandSlug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
  logo: z.string().url().optional(),
  description: z.string().max(500).optional(),
});

/** Super-admin may update the reseller login profile alongside company fields. */
export const adminUpdateResellerUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional().nullable(),
});

// ============================================================
// Packages / Subscriptions
// ============================================================

export const createPackageSchema = z.object({
  resellerId: z.string().cuid(),
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
  price: z.number().int().min(100), // Minimum 100 TZS
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
  sortOrder: z.number().int().default(0),
});

export const updatePackageSchema = createPackageSchema.partial().omit({ resellerId: true });

// ============================================================
// Withdrawal / Payout
// ============================================================

export const processWithdrawalSchema = z.object({
  action: z.enum(["approve", "reject", "process"]),
  adminNote: z.string().max(500).optional(),
});

// ============================================================
// System Settings
// ============================================================

export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  type: z.enum(["string", "number", "boolean", "json"]).default("string"),
});

// ============================================================
// Device
// ============================================================

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["AP", "SWITCH", "GATEWAY", "OTHER"]).optional(),
  /** Super-admin override (e.g. mark as OFFLINE to reflect suspension in dashboard). */
  status: z.enum(["ONLINE", "OFFLINE", "PENDING"]).optional(),
});

// ============================================================
// Customer
// ============================================================

export const customerFilterSchema = z.object({
  search: z.string().optional(), // phone, email, or MAC
  resellerId: z.string().cuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

// ============================================================
// End-user WiFi subscription (admin)
// ============================================================

export const adminUpdateWifiSubscriptionSchema = z.object({
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED"]).optional(),
  expiresAt: z.string().datetime().optional(),
});

// ============================================================
// Reseller platform plan (SSDomada billing)
// ============================================================

export const adminUpdateResellerPlatformPlanSchema = z.object({
  planId: z.string().cuid().optional(),
  status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "EXPIRED", "CANCELLED"]).optional(),
  currentPeriodEnd: z.string().datetime().optional(),
});

export const adminCreateResellerNoticeSchema = z.object({
  title: z.string().max(160).optional(),
  body: z.string().min(1).max(8000),
});

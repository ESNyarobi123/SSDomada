export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED" | "REFUNDED";
export type PaymentType = "MOBILE" | "CARD" | "SESSION" | "QR";
export type PayoutStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";
export type PayoutChannel = "MOBILE" | "BANK";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "SUSPENDED";
export type PackageDuration =
  | "MINUTES_30" | "HOUR_1" | "HOURS_3" | "HOURS_6" | "HOURS_12" | "HOURS_24"
  | "DAYS_3" | "DAYS_7" | "DAYS_14" | "DAYS_30" | "DAYS_90" | "DAYS_365"
  | "LIFETIME" | "UNLIMITED";

// ============================================================
// Package
// ============================================================

export interface Package {
  id: string;
  resellerId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: PackageDuration;
  durationMinutes: number;
  dataLimitMb: number | null;
  speedLimitUp: number | null;
  speedLimitDown: number | null;
  maxDevices: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePackageInput {
  resellerId: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  duration: PackageDuration;
  durationMinutes: number;
  dataLimitMb?: number;
  speedLimitUp?: number;
  speedLimitDown?: number;
  maxDevices?: number;
  sortOrder?: number;
}

// ============================================================
// Subscription
// ============================================================

export interface Subscription {
  id: string;
  userId: string;
  packageId: string;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date;
  dataUsedMb: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Payment (Snippe Collection)
// ============================================================

export interface Payment {
  id: string;
  snippeReference: string;
  userId: string;
  resellerId: string;
  subscriptionId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentType: PaymentType;
  customerPhone: string | null;
  customerEmail: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown> | null;
  completedAt: Date | null;
  platformFee: number;
  resellerAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Payout (Snippe Disbursement)
// ============================================================

export interface Payout {
  id: string;
  snippeReference: string;
  resellerId: string;
  withdrawalId: string | null;
  amount: number;
  fee: number;
  total: number;
  channel: PayoutChannel;
  recipientPhone: string | null;
  recipientAccount: string | null;
  recipientBank: string | null;
  recipientName: string;
  status: PayoutStatus;
  narration: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown> | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// WiFi Session
// ============================================================

export interface WifiSession {
  id: string;
  userId: string;
  siteId: string;
  subscriptionId: string | null;
  clientMac: string;
  clientIp: string | null;
  startedAt: Date;
  endedAt: Date | null;
  dataUpMb: number;
  dataDownMb: number;
}

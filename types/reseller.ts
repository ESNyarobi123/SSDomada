export interface Reseller {
  id: string;
  userId: string;
  companyName: string;
  brandSlug: string;
  logo: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  omadaSiteId: string | null;
  commissionRate: number;
  walletBalance: number;
  totalEarnings: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateResellerInput {
  userId: string;
  companyName: string;
  brandSlug: string;
  logo?: string;
  description?: string;
  phone?: string;
  address?: string;
  commissionRate?: number;
  currency?: string;
}

export interface UpdateResellerInput {
  companyName?: string;
  brandSlug?: string;
  logo?: string;
  description?: string;
  phone?: string;
  address?: string;
  commissionRate?: number;
  isActive?: boolean;
}

export type WithdrawalStatus = "PENDING" | "APPROVED" | "PROCESSING" | "COMPLETED" | "REJECTED";

export interface Withdrawal {
  id: string;
  resellerId: string;
  amount: number;
  currency: string;
  status: WithdrawalStatus;
  method: string | null;
  accountDetails: Record<string, unknown> | null;
  processedAt: Date | null;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWithdrawalInput {
  resellerId: string;
  amount: number;
  currency?: string;
  method: string;
  accountDetails?: Record<string, unknown>;
}

export interface CaptivePortalConfig {
  id: string;
  resellerId: string;
  logo: string | null;
  bgImage: string | null;
  bgColor: string;
  primaryColor: string;
  accentColor: string;
  companyName: string | null;
  welcomeText: string | null;
  termsUrl: string | null;
  customCss: string | null;
  customHtml: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCaptivePortalInput {
  logo?: string;
  bgImage?: string;
  bgColor?: string;
  primaryColor?: string;
  accentColor?: string;
  companyName?: string;
  welcomeText?: string;
  termsUrl?: string;
  customCss?: string;
  customHtml?: string;
}

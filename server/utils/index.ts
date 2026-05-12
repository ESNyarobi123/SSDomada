/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Calculate platform fee and reseller amount from payment
 */
export function calculateRevenueSplit(
  amount: number,
  commissionRate: number
): { platformFee: number; resellerAmount: number } {
  const platformFee = Math.round(amount * commissionRate * 100) / 100;
  const resellerAmount = Math.round((amount - platformFee) * 100) / 100;
  return { platformFee, resellerAmount };
}

/**
 * Calculate subscription expiry date from duration in minutes
 */
export function calculateExpiryDate(durationMinutes: number): Date {
  return new Date(Date.now() + durationMinutes * 60 * 1000);
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = "TZS"): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Normalize MAC address to consistent format (XX:XX:XX:XX:XX:XX)
 */
export function normalizeMac(mac: string): string {
  return mac
    .replace(/[^a-fA-F0-9]/g, "")
    .match(/.{1,2}/g)
    ?.join(":")
    .toUpperCase() || mac;
}

import type { SnippeMobileProvider } from "@/server/services/snippe.service";

/** Detect Tanzanian mobile money provider from a local or international phone string. */
export function detectTanzaniaMobileProvider(phone: string): SnippeMobileProvider | undefined {
  const digits = phone.replace(/[^0-9]/g, "");
  const local = digits.slice(-9);
  if (local.length < 9) return undefined;
  const prefix = local.slice(0, 2);
  if (["68", "69", "78"].includes(prefix)) return "airtel";
  if (["74", "75", "76"].includes(prefix)) return "mpesa";
  if (["65", "67", "71"].includes(prefix)) return "mixx";
  if (["61", "62"].includes(prefix)) return "halotel";
  return undefined;
}

export function normalizeTanzaniaPhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "").trim();
}

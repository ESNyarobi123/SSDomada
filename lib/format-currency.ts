/** Format integer amounts as TZS (whole shillings). */
export function formatTzs(amount: number | null | undefined): string {
  const n = Math.round(Number(amount) || 0);
  return `TZS ${n.toLocaleString("en-TZ")}`;
}

export function formatTzsCompact(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  if (n >= 1_000_000) return `TZS ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `TZS ${(n / 1_000).toFixed(1)}k`;
  return `TZS ${Math.round(n).toLocaleString("en-TZ")}`;
}

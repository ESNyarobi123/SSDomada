/**
 * Captive portal images are stored under `public/uploads/captive/...`.
 * Serving via `/api/public/captive/...` avoids broken static delivery (standalone / reverse proxies).
 * Legacy DB values may still use `/uploads/captive/...` — map those to the API route.
 */
export function resolveCaptiveAssetUrl(href: string | null | undefined): string | null {
  if (href == null) return null;
  const t = href.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/api/public/captive/")) return t;
  if (t.startsWith("/uploads/captive/")) {
    return `/api/public/captive/${t.slice("/uploads/captive/".length)}`;
  }
  return t.startsWith("/") ? t : null;
}

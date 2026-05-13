/**
 * Public HTTPS origin (no trailing slash) used for Omada external portal URL,
 * payment return URLs, etc.
 *
 * `OMADA_PORTAL_PUBLIC_BASE_URL` overrides when the controller must reach the app
 * on a different host than `NEXT_PUBLIC_APP_URL` (e.g. split DNS / VPS hostname).
 */
export function getPortalPublicBaseUrl(): string {
  const raw =
    process.env.OMADA_PORTAL_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "";
  return raw.replace(/\/+$/, "");
}

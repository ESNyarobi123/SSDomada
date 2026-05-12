import { authFetch } from "@/lib/auth-client";

export type AdminListMeta = { page: number; limit: number; total: number };

/** Authenticated fetch for `/api/v1/admin/*` — requires SUPER_ADMIN session token. */
export async function adminJson<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; meta?: AdminListMeta; error?: string; code?: string }> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await authFetch(path, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    meta?: AdminListMeta;
    error?: string;
    code?: string;
  };
  if (!res.ok || json.success === false) {
    return { ok: false, error: json.error || res.statusText, code: json.code };
  }
  return { ok: true, data: json.data as T, meta: json.meta };
}

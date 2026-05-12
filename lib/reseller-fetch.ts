import { authFetch } from "@/lib/auth-client";

export type ResellerListMeta = { page: number; limit: number; total: number };

export async function resellerJson<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; meta?: ResellerListMeta; error?: string; code?: string }> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await authFetch(path, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    meta?: ResellerListMeta;
    error?: string;
    code?: string;
  };
  if (!res.ok || json.success === false) {
    return { ok: false, error: json.error || res.statusText, code: json.code };
  }
  return { ok: true, data: json.data as T, meta: json.meta };
}

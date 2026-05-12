const TOKEN_KEY = "ssdomada_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const t = getStoredToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  phone: string | null;
  reseller: { id: string; companyName: string; brandSlug: string } | null;
};

export async function fetchSession(): Promise<AuthUser | null> {
  const res = await authFetch("/api/v1/auth");
  const json = await res.json();
  if (!json.success) return null;
  return json.data?.user ?? null;
}

export function redirectAfterAuth(user: AuthUser): string {
  if (user.role === "SUPER_ADMIN") return "/super-admin/dashboard";
  if (user.role === "RESELLER") return "/reseller/dashboard";
  if (user.role === "END_USER") return "/customer/dashboard";
  return "/";
}

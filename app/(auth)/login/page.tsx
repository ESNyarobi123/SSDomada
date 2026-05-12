"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, ArrowRight, Sparkles } from "lucide-react";
import { setStoredToken, redirectAfterAuth, type AuthUser } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "login", email, password }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Login failed");
        setLoading(false);
        return;
      }
      const user = json.data.user as AuthUser;
      setStoredToken(json.data.token);
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : redirectAfterAuth(user);
      router.push(dest);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-onyx-900/50 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl shadow-black/40">
      {/* Top gold accent line */}
      <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent" aria-hidden />

      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold-20 bg-gold-5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gold mb-5">
          <Sparkles className="w-3.5 h-3.5" />
          Secure sign in
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Welcome back</h1>
        <p className="text-onyx-400 text-sm mt-3 leading-relaxed">
          Sign in to your reseller or customer dashboard.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 leading-snug">{error}</div>
        )}
        <div>
          <label htmlFor="login-email" className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">
            Email
          </label>
          <div className="relative group">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white placeholder:text-onyx-600 input-focus"
              placeholder="you@business.com"
            />
          </div>
        </div>
        <div>
          <label htmlFor="login-password" className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">
            Password
          </label>
          <div className="relative group">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white placeholder:text-onyx-600 input-focus"
              placeholder="Enter your password"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-bold text-onyx-950 shadow-lg shadow-gold/15 transition-all hover:bg-gold-400 hover:shadow-gold/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-55 disabled:pointer-events-none"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-center text-sm text-onyx-400">
        <p>
          New operator?{" "}
          <Link href="/register" className="font-semibold text-gold hover:underline">
            Create a reseller account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-onyx-900/60 p-12 text-onyx-400">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, User, Building2, Hash, Smartphone, ArrowRight, ArrowLeft, Store, UserCircle, Check, Eye, EyeOff } from "lucide-react";
import { setStoredToken, redirectAfterAuth, type AuthUser } from "@/lib/auth-client";

const STEPS = [
  { num: 1, label: "Identity", icon: User },
  { num: 2, label: "Security", icon: Lock },
  { num: 3, label: "Business", icon: Building2 },
] as const;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerMode = searchParams.get("mode") === "customer";
  const requestedPlanSlug = searchParams.get("plan")?.trim().toLowerCase() || "";

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const role = customerMode ? "END_USER" : "RESELLER";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        action: "register",
        role,
        name,
        email,
        password,
        phone: phone || undefined,
      };
      if (role === "RESELLER") {
        body.companyName = companyName;
        if (brandSlug.trim()) body.brandSlug = brandSlug.trim();
        if (requestedPlanSlug) body.planSlug = requestedPlanSlug;
      }
      const res = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        const msg = typeof json.error === "string" ? json.error : "Registration failed";
        setError(msg);
        setLoading(false);
        return;
      }
      const user = json.data.user as AuthUser;
      setStoredToken(json.data.token);
      if (role === "RESELLER") {
        const q = requestedPlanSlug ? `?plan=${encodeURIComponent(requestedPlanSlug)}` : "";
        router.push(`/reseller/plan${q}`);
      } else {
        router.push(redirectAfterAuth(user));
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function canGoNext(): boolean {
    if (step === 1) return name.trim().length >= 2 && email.trim().length > 0;
    if (step === 2) return password.length >= 8;
    return companyName.trim().length >= 2;
  }

  function goNext() {
    if (canGoNext() && step < 3) setStep(step + 1);
  }

  // ── Customer mode (single step) ──
  if (customerMode) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-onyx-900/50 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl shadow-black/40 relative overflow-hidden">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent" aria-hidden />
        <div className="mb-8">
          <Link href="/register" className="inline-flex items-center gap-2 text-xs font-semibold text-gold hover:underline mb-5">
            ← Reseller signup
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-20 bg-gold-5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gold mb-4">
            <UserCircle className="w-3.5 h-3.5" />
            WiFi customer
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Create customer account</h1>
          <p className="text-onyx-400 text-sm mt-3 leading-relaxed">
            Most people create an account automatically when they pay on a hotspot portal.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Full name</label>
            <div className="relative group">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white input-focus" placeholder="Your name" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Email</label>
            <div className="relative group">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white input-focus" placeholder="you@email.com" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Phone <span className="text-onyx-500 font-normal normal-case">(optional)</span></label>
            <div className="relative group">
              <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white input-focus" placeholder="+255…" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Password (min 8)</label>
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input type={showPw ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-11 py-3.5 text-[15px] text-white input-focus" placeholder="Choose a strong password" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-onyx-500 hover:text-gold transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-bold text-onyx-950 shadow-lg shadow-gold/15 transition-all hover:bg-gold-400 hover:shadow-gold/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-55">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create account<ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-onyx-400 border-t border-white/[0.06] pt-6">
          Already have an account? <Link href="/login" className="font-semibold text-gold hover:underline">Sign in</Link>
        </p>
      </div>
    );
  }

  // ── Reseller mode (3 steps) ──
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-onyx-900/50 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl shadow-black/40 relative overflow-hidden">
      <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent" aria-hidden />

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <button
              type="button"
              onClick={() => { if (s.num < step) setStep(s.num); }}
              className={`flex items-center gap-2.5 transition-all duration-300 ${s.num < step ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className={`flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold transition-all duration-300 ${
                step > s.num
                  ? "bg-gold text-onyx-950 shadow-md shadow-gold/20"
                  : step === s.num
                    ? "bg-gold-10 border-2 border-gold text-gold"
                    : "bg-white/5 text-onyx-500 border border-white/10"
              }`}>
                {step > s.num ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-semibold transition-colors hidden sm:inline ${step === s.num ? "text-gold" : step > s.num ? "text-gold/70" : "text-onyx-500"}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 sm:w-10 h-0.5 mx-2 rounded-full transition-colors duration-300 ${step > s.num ? "bg-gold" : "bg-white/10"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Identity ── */}
      <div className={`transition-all duration-400 ease-out ${step === 1 ? "relative opacity-100 translate-x-0" : "absolute inset-0 opacity-0 translate-x-16 pointer-events-none"}`} style={{ padding: "inherit" }}>
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Who are you?</h2>
          <p className="text-onyx-400 text-sm mt-2 leading-relaxed">Your name and email to identify your account.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); goNext(); }} className="space-y-5">
          {error && step === 1 && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Full name</label>
            <div className="relative group">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white input-focus" placeholder="John Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Email address</label>
            <div className="relative group">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white input-focus" placeholder="you@business.com" />
            </div>
          </div>
          <button type="submit" disabled={!canGoNext()} className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-bold text-onyx-950 shadow-lg shadow-gold/15 transition-all hover:bg-gold-400 hover:shadow-gold/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none">
            Next: Security
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </form>
      </div>

      {/* ── Step 2: Security ── */}
      <div className={`transition-all duration-400 ease-out ${step === 2 ? "relative opacity-100 translate-x-0" : "absolute inset-0 opacity-0 pointer-events-none"}`} style={{ padding: "inherit", ...(step < 2 ? { transform: "translateX(-16px)" } : step > 2 ? { transform: "translateX(16px)" } : {}) }}>
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Secure your account</h2>
          <p className="text-onyx-400 text-sm mt-2 leading-relaxed">Set a password and optionally add your phone number.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); goNext(); }} className="space-y-5">
          {error && step === 2 && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Password <span className="text-gold/60 font-normal normal-case">(min 8 chars)</span></label>
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input type={showPw ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-11 py-3.5 text-[15px] text-white input-focus" placeholder="Strong password" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-onyx-500 hover:text-gold transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="mt-2 flex gap-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${
                    password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) && level <= 4
                      ? "bg-green-400"
                      : password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) && level <= 3
                        ? "bg-gold"
                        : password.length >= 8 && level <= 2
                          ? "bg-gold-30"
                          : level <= 1 && password.length > 0
                            ? "bg-red-400"
                            : "bg-white/10"
                  }`} />
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Phone <span className="text-onyx-500 font-normal normal-case">(optional)</span></label>
            <div className="relative group">
              <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white input-focus" placeholder="+255…" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep(1)} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3.5 text-sm font-semibold text-onyx-300 hover:bg-white/5 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button type="submit" disabled={!canGoNext()} className="group flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-bold text-onyx-950 shadow-lg shadow-gold/15 transition-all hover:bg-gold-400 hover:shadow-gold/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none">
              Next: Business
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </form>
      </div>

      {/* ── Step 3: Business ── */}
      <div className={`transition-all duration-400 ease-out ${step === 3 ? "relative opacity-100 translate-x-0" : "absolute inset-0 opacity-0 -translate-x-16 pointer-events-none"}`} style={{ padding: "inherit" }}>
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-20 bg-gold-5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gold mb-4">
            <Store className="w-3.5 h-3.5" />
            Almost done!
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Your WiFi business</h2>
          <p className="text-onyx-400 text-sm mt-2 leading-relaxed">Name your business and set your portal URL. You can configure packages and Omada sites after signup.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          {error && step === 3 && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">Business / hotspot name</label>
            <div className="relative group">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white input-focus" placeholder="e.g. Kariakoo WiFi Hub" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-onyx-400 uppercase tracking-wider mb-2">
              Portal URL slug <span className="text-onyx-500 font-normal normal-case">(optional)</span>
            </label>
            <div className="relative group">
              <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onyx-500 group-focus-within:text-gold transition-colors" />
              <input value={brandSlug} onChange={(e) => setBrandSlug(e.target.value.replace(/\s+/g, "-").toLowerCase())} className="w-full rounded-xl border border-white/10 bg-onyx-950/80 pl-11 pr-4 py-3.5 text-[15px] text-white font-mono input-focus" placeholder="my-brand" />
            </div>
            <p className="mt-1.5 text-[11px] text-onyx-500 leading-relaxed">
              Your captive portal will live at <span className="text-gold/90">/portal/your-slug</span>. Leave empty and we&apos;ll generate one from your business name.
            </p>
          </div>

          {/* Summary preview */}
          <div className="rounded-xl border border-white/[0.06] bg-onyx-950/50 p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-onyx-500 mb-2">Account summary</p>
            <div className="flex justify-between text-sm"><span className="text-onyx-400">Name</span><span className="text-white font-medium">{name || "—"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-onyx-400">Email</span><span className="text-white font-medium">{email || "—"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-onyx-400">Phone</span><span className="text-white font-medium">{phone || "—"}</span></div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep(2)} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3.5 text-sm font-semibold text-onyx-300 hover:bg-white/5 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button type="submit" disabled={loading || !canGoNext()} className="group flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-bold text-onyx-950 shadow-lg shadow-gold/15 transition-all hover:bg-gold-400 hover:shadow-gold/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create reseller account<ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 space-y-3 border-t border-white/[0.06] pt-6 text-center text-sm">
        <p className="text-onyx-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-gold hover:underline">Sign in</Link>
        </p>
        {/* <p className="text-xs text-onyx-500 leading-relaxed">
           {" "}
          <Link href="/register?mode=customer" className="text-gold font-medium hover:underline">Customer signup →</Link>
        </p> */}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[380px] items-center justify-center rounded-3xl border border-white/10 bg-onyx-900/60 p-12">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

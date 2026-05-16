"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Crown, Sparkles, Zap, Loader2 } from "lucide-react";

type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: "MONTHLY" | "YEARLY" | "LIFETIME";
  trialDays: number;
  maxSites: number | null;
  maxDevices: number | null;
  maxActiveClients: number | null;
  customBranding: boolean;
  customDomain: boolean;
  smsNotifications: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  isFeatured: boolean;
};

function formatTzs(n: number) {
  if (n === 0) return "Free";
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(n);
}

function featuresOf(p: Plan) {
  const f: { label: string; ok: boolean }[] = [
    { label: p.maxSites == null ? "Unlimited sites" : `${p.maxSites} site${p.maxSites > 1 ? "s" : ""}`, ok: true },
    { label: p.maxDevices == null ? "Unlimited APs" : `${p.maxDevices} APs`, ok: true },
    { label: p.maxActiveClients == null ? "Unlimited active clients" : `${p.maxActiveClients} active clients`, ok: true },
    { label: "Custom branding", ok: p.customBranding },
    { label: "SMS notifications", ok: p.smsNotifications },
    { label: "Custom domain support", ok: p.customDomain },
    { label: "Priority support", ok: p.prioritySupport },
    { label: "API access", ok: p.apiAccess },
  ];
  return f;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/v1/plans");
        const j = await r.json();
        if (j.success) setPlans(j.data || []);
      } catch {
        // noop
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-onyx-950 via-onyx-900 to-onyx-950">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">Choose your plan</h1>
          <p className="text-lg text-onyx-300 max-w-2xl mx-auto">
            Pay only for what you need. Cancel anytime. Start with a free trial — no credit card required.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-gold animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-3xl p-7 border-2 transition-all ${
                  p.isFeatured
                    ? "border-gold bg-gradient-to-br from-gold/10 via-onyx-900 to-onyx-900 shadow-xl shadow-gold/10"
                    : "border-white/[0.08] bg-onyx-900/60 hover:border-gold-30"
                }`}
              >
                {p.isFeatured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-onyx-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Most popular
                  </div>
                )}
                <h2 className="text-2xl font-black text-white mb-1">{p.name}</h2>
                {p.description && <p className="text-sm text-onyx-400 mb-5">{p.description}</p>}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-gold">{formatTzs(p.price)}</span>
                    {p.price > 0 && <span className="text-sm text-onyx-400">/ {p.interval.toLowerCase()}</span>}
                  </div>
                  {p.trialDays > 0 && (
                    <div className="text-xs text-emerald-400 mt-1 font-bold">{p.trialDays}-day free trial</div>
                  )}
                </div>
                <ul className="space-y-2.5 mb-7">
                  {featuresOf(p).map((f, idx) => (
                    <li
                      key={idx}
                      className={`flex items-center gap-2 text-sm ${
                        f.ok ? "text-onyx-200" : "text-onyx-600 line-through"
                      }`}
                    >
                      <Check className={`w-4 h-4 shrink-0 ${f.ok ? "text-emerald-400" : "text-onyx-700"}`} />
                      {f.label}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/register?plan=${p.slug}`}
                  className={`block w-full text-center rounded-xl py-3 font-black text-sm transition-all ${
                    p.isFeatured
                      ? "bg-gold text-onyx-950 shadow-lg shadow-gold/30 hover:bg-gold-400"
                      : "bg-white/[0.04] text-white border border-white/[0.08] hover:bg-white/[0.08]"
                  }`}
                >
                  {p.price === 0 ? "Start free" : "Get started"}
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-12 text-sm text-onyx-400">
          Already have an account?{" "}
          <Link href="/login" className="text-gold font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

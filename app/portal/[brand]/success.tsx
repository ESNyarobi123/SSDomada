"use client";

import { use, useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function SuccessPage({ params, searchParams }: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { brand } = use(params);
  const sp = use(searchParams);
  const sessionId = sp.session || sp.sessionId;

  useEffect(() => {
    // Wait a moment then redirect back to portal — webhook may still be processing
    const t = setTimeout(() => {
      const url = sessionId ? `/portal/${brand}?session=${sessionId}` : `/portal/${brand}`;
      window.location.replace(url);
    }, 1500);
    return () => clearTimeout(t);
  }, [brand, sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-onyx-950 via-onyx-900 to-onyx-950 px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Payment Received</h1>
        <p className="text-onyx-300 mb-6">Activating your WiFi access…</p>
        <Loader2 className="w-6 h-6 text-gold animate-spin mx-auto" />
      </div>
    </div>
  );
}

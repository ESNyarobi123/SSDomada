"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function PortalSuccessClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const brand = (params?.brand as string) || "";
  const sessionId = searchParams.get("session") || searchParams.get("sessionId") || "";

  useEffect(() => {
    if (!brand) return;
    const t = setTimeout(() => {
      const url = sessionId ? `/portal/${brand}?session=${encodeURIComponent(sessionId)}` : `/portal/${brand}`;
      window.location.replace(url);
    }, 1500);
    return () => clearTimeout(t);
  }, [brand, sessionId]);

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-onyx-950 px-6">
        <p className="text-onyx-400">Invalid link.</p>
      </div>
    );
  }

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

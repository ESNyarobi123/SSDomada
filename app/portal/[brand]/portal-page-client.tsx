"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Wifi, CheckCircle2, Loader2, ShieldCheck, Smartphone, Clock, Zap, ArrowLeft, ChevronRight } from "lucide-react";
import { resolveCaptiveAssetUrl } from "@/lib/portal-assets";

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: string;
  durationMinutes: number;
  dataLimitMb: number | null;
  speedLimitDown: number | null;
  speedLimitUp: number | null;
  maxDevices: number;
  isFeatured: boolean;
};

type PortalData = {
  portal: {
    companyName: string;
    logo: string | null;
    bgImage: string | null;
    bgColor: string;
    primaryColor: string;
    accentColor: string;
    welcomeText: string;
    termsUrl: string | null;
    template: string;
    showLogo: boolean;
  };
  packages: Pkg[];
  session: { id: string; clientMac: string; status: string } | null;
  client: { mac: string; isAuthorized: boolean; remainingSeconds: number };
};

function formatTzs(n: number) {
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(n);
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.round(mins / 60)} hr`;
  return `${Math.round(mins / 1440)} day${mins >= 2880 ? "s" : ""}`;
}

function formatRemaining(s: number) {
  if (s <= 0) return "Expired";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// Omada External Portal v2 redirect parameters. Every key the controller
// might send must be forwarded to /api/portal/[slug] so the server can
// authorize the client against Omada once payment completes.
const OMADA_FORWARD_KEYS = [
  "clientMac",
  "client_mac",
  "clientIp",
  "client_ip",
  "apMac",
  "ap_mac",
  "ssid",
  "ssidName",
  "nasId",
  "nas_id",
  "radioId",
  "radio_id",
  "site",
  "t",
  "url",
  "redirectUrl",
  "redirect_url",
  "preview",
] as const;

export default function PortalPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const brand = (params?.brand as string) || "";
  const queryKey = OMADA_FORWARD_KEYS.map((k) => `${k}=${searchParams.get(k) ?? ""}`).join("&");

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "redirecting" | "polling" | "success" | "failed">("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!brand) return;
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(`/api/portal/${brand}`, window.location.origin);
        OMADA_FORWARD_KEYS.forEach((k) => {
          const v = searchParams.get(k);
          if (v) url.searchParams.set(k, v);
        });
        const r = await fetch(url.toString());
        const j = await r.json();
        if (cancelled) return;
        if (!j.success) {
          setErr(j.error || "Portal unavailable");
        } else {
          setData(j.data);
          setRemainingSeconds(j.data.client.remainingSeconds || 0);
          if (j.data.client.isAuthorized) setPaymentStatus("success");
        }
      } catch {
        if (!cancelled) setErr("Failed to connect");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brand, queryKey]);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const t = setInterval(() => setRemainingSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [remainingSeconds]);

  useEffect(() => {
    if (paymentStatus !== "polling" || !data?.session) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/portal/${brand}/status?sessionId=${data.session!.id}`);
        const j = await r.json();
        if (j.success && j.data?.status === "AUTHORIZED") {
          setPaymentStatus("success");
          setRemainingSeconds(j.data.remainingSeconds || 0);
          clearInterval(t);
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(t);
  }, [paymentStatus, brand, data?.session]);

  const submitPayment = useCallback(async () => {
    if (!selected || !data?.session) return;
    if (!phone.match(/^[0-9+\-\s]{9,}$/)) {
      setErr("Enter a valid phone number");
      return;
    }
    setErr(null);
    setPaying(true);
    try {
      const r = await fetch(`/api/portal/${brand}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.session.id,
          packageId: selected,
          phone: phone.replace(/\s/g, ""),
          paymentMethod: "MOBILE",
        }),
      });
      const j = await r.json();
      if (!j.success) {
        setErr(j.error || "Payment failed to start");
        setPaying(false);
        return;
      }
      if (j.data?.checkoutUrl) {
        setPaymentStatus("redirecting");
        window.location.href = j.data.checkoutUrl;
      } else {
        setPaymentStatus("polling");
      }
    } catch {
      setErr("Network error");
    } finally {
      setPaying(false);
    }
  }, [selected, data, phone, brand]);

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-onyx-950 px-6">
        <p className="text-onyx-400">Invalid portal link.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-onyx-950 via-onyx-900 to-onyx-950">
        <Loader2 className="w-10 h-10 animate-spin text-gold" />
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-onyx-950 px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <Wifi className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Portal Unavailable</h1>
          <p className="text-onyx-400">{err}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { portal, packages, client } = data;
  const isPreview = searchParams.get("preview") === "true";
  const canPay = Boolean(data.session);

  const logoSrc = resolveCaptiveAssetUrl(portal.logo);
  const bgSrc = resolveCaptiveAssetUrl(portal.bgImage);

  const bgStyle: React.CSSProperties = {
    backgroundColor: portal.bgColor || "#0a0a0a",
    backgroundImage: bgSrc ? `url('${bgSrc}')` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  if (paymentStatus === "success" || client.isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={bgStyle}>
        <div className="max-w-md w-full bg-onyx-900/85 backdrop-blur-xl rounded-3xl border border-emerald-500/30 p-8 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">You're Online!</h1>
          <p className="text-onyx-300 mb-6">
            Connected via <strong className="text-emerald-300">{portal.companyName}</strong>
          </p>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <div className="text-xs uppercase tracking-wider text-onyx-400 mb-1">Time remaining</div>
            <div className="text-3xl font-black text-gold tabular-nums">{formatRemaining(remainingSeconds)}</div>
          </div>
          {data.session?.clientMac && <div className="text-xs text-onyx-500 font-mono">Device: {data.session.clientMac}</div>}
        </div>
      </div>
    );
  }

  if (paymentStatus === "polling") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={bgStyle}>
        <div className="max-w-md w-full bg-onyx-900/85 backdrop-blur-xl rounded-3xl border border-gold-30 p-8 text-center shadow-2xl">
          <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white mb-2">Confirm on Your Phone</h2>
          <p className="text-onyx-300 mb-4">
            A payment prompt has been sent to <strong className="text-gold">{phone}</strong>. Enter your mobile money PIN to complete.
          </p>
          <p className="text-xs text-onyx-500">Waiting for confirmation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={bgStyle}>
      <div className="min-h-screen bg-gradient-to-b from-onyx-950/92 via-onyx-900/88 to-onyx-950/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-6 sm:py-8 pb-10">
          {/* Header */}
          <div className="text-center mb-6">
            {portal.showLogo && logoSrc ? (
              <img
                src={logoSrc}
                alt={portal.companyName}
                className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] mx-auto rounded-xl mb-3 object-contain bg-white/[0.06] border border-white/10 p-1"
              />
            ) : (
              <div className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] mx-auto rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center mb-3">
                <Wifi className="w-8 h-8 text-gold" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">{portal.companyName}</h1>
            {portal.welcomeText ? <p className="text-sm text-onyx-400 mt-1.5 leading-snug px-1">{portal.welcomeText}</p> : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-6">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-emerald-400/95 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
              <ShieldCheck className="w-3 h-3 shrink-0" /> Secure
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-sky-400/95 bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded-md">
              <Zap className="w-3 h-3 shrink-0" /> Instant
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-gold bg-gold/10 border border-gold/20 px-2 py-1 rounded-md">
              <Smartphone className="w-3 h-3 shrink-0" /> Mobile money
            </span>
          </div>

          {!selected ? (
            <>
              <p className="text-center text-[11px] font-bold uppercase tracking-wider text-onyx-500 mb-2">Choose a package</p>
              <div className="flex flex-col gap-2">
                {packages.length === 0 && (
                  <div className="text-center py-10 text-sm text-onyx-400 rounded-xl border border-white/[0.06] bg-onyx-900/40">
                    No packages available right now.
                  </div>
                )}
                {packages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelected(p.id);
                      setErr(null);
                    }}
                    className="group w-full text-left rounded-xl border border-white/[0.08] bg-onyx-900/55 hover:border-gold/35 hover:bg-onyx-900/75 transition-all px-3.5 py-3 flex items-center gap-3 active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{p.name}</span>
                        {p.isFeatured ? (
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-wide bg-gold text-onyx-950 px-1.5 py-0.5 rounded">
                            Hot
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-onyx-400">
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> {formatDuration(p.durationMinutes)}
                        </span>
                        {p.speedLimitDown ? <span>{Math.round(p.speedLimitDown / 1000)} Mbps</span> : null}
                        {p.dataLimitMb ? (
                          <span>{p.dataLimitMb >= 1024 ? `${(p.dataLimitMb / 1024).toFixed(1)} GB` : `${p.dataLimitMb} MB`}</span>
                        ) : null}
                        <span>
                          {p.maxDevices} {p.maxDevices === 1 ? "device" : "devices"}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className="text-sm font-black text-gold tabular-nums">{formatTzs(p.price)}</span>
                      <ChevronRight className="w-4 h-4 text-onyx-500 group-hover:text-gold transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-gold/25 bg-onyx-900/90 backdrop-blur-xl p-4 sm:p-5 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setErr(null);
                  setPhone("");
                }}
                className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-onyx-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to packages
              </button>

              {(() => {
                const p = packages.find((x) => x.id === selected);
                if (!p) return null;
                return (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 mb-4">
                    <div className="text-[10px] uppercase tracking-wider text-onyx-500 font-bold">Selected</div>
                    <div className="text-sm font-bold text-white">{p.name}</div>
                    <div className="text-lg font-black text-gold mt-0.5">{formatTzs(p.price)}</div>
                  </div>
                );
              })()}

              <h2 className="text-base font-black text-white mb-1">Pay with mobile money</h2>
              <p className="text-xs text-onyx-500 mb-3">Enter the number that receives the payment prompt.</p>
              {!canPay ? (
                <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/95 leading-relaxed">
                  {isPreview
                    ? "Preview only. When guests connect over your Wi‑Fi, they can complete payment here."
                    : "No device session yet — open this portal from your Omada Wi‑Fi network to pay."}
                </div>
              ) : null}
              {err ? <div className="mb-3 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-200">{err}</div> : null}
              <label className="block text-[10px] font-bold uppercase tracking-wider text-onyx-500 mb-1">Phone number</label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full rounded-xl border border-gold/20 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-onyx-600 focus:border-gold focus:ring-2 focus:ring-gold/15 outline-none transition-all mb-3"
                disabled={paying}
              />
              <button
                type="button"
                onClick={submitPayment}
                disabled={paying || !phone.trim() || !canPay}
                className="w-full rounded-xl bg-gold text-onyx-950 px-4 py-3 text-sm font-black shadow-lg shadow-gold/25 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Pay{" "}
                    {formatTzs(packages.find((p) => p.id === selected)?.price || 0)}
                  </>
                )}
              </button>
              <p className="text-[10px] text-onyx-600 text-center mt-3 leading-relaxed">
                Snippe · M-Pesa, Airtel Money, Mixx, Halotel
              </p>
            </div>
          )}

          {portal.termsUrl && !selected ? (
            <div className="text-center mt-8 text-[10px] text-onyx-600 px-2">
              By continuing you agree to our{" "}
              <a href={portal.termsUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2">
                terms
              </a>
              .
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

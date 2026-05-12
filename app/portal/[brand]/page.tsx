"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Wifi, CheckCircle2, Loader2, ShieldCheck, Smartphone, Clock, Zap } from "lucide-react";

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

export default function BrandPortalPage({ params, searchParams }: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { brand } = use(params);
  const sp = use(searchParams);

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "redirecting" | "polling" | "success" | "failed">("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Load portal config + packages
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(`/api/portal/${brand}`, window.location.origin);
        // Forward Omada query params if present (clientMac, apMac, ssid, url, nasId)
        ["clientMac", "client_mac", "apMac", "ap_mac", "ssid", "nasId", "nas_id", "url"].forEach((k) => {
          if (sp[k]) url.searchParams.set(k, sp[k] as string);
        });
        const r = await fetch(url.toString());
        const j = await r.json();
        if (!j.success) {
          setErr(j.error || "Portal unavailable");
        } else {
          setData(j.data);
          setRemainingSeconds(j.data.client.remainingSeconds || 0);
          if (j.data.client.isAuthorized) setPaymentStatus("success");
        }
      } catch (e) {
        setErr("Failed to connect");
      } finally {
        setLoading(false);
      }
    })();
  }, [brand]);

  // Countdown for authorized session
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const t = setInterval(() => setRemainingSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [remainingSeconds]);

  // Poll for payment status when in PAYING state
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
        // Open in same tab — Snippe will redirect back via return_url
        window.location.href = j.data.checkoutUrl;
      } else {
        // STK push initiated, poll status
        setPaymentStatus("polling");
      }
    } catch (e) {
      setErr("Network error");
    } finally {
      setPaying(false);
    }
  }, [selected, data, phone, brand]);

  const featured = useMemo(() => data?.packages.find((p) => p.isFeatured), [data]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-onyx-950 via-onyx-900 to-onyx-950">
        <Loader2 className="w-10 h-10 animate-spin text-gold" />
      </div>
    );
  }

  // ── Error ──
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

  // Theme overrides from reseller's portal config
  const bgStyle: React.CSSProperties = {
    backgroundColor: portal.bgColor || "#0a0a0a",
    backgroundImage: portal.bgImage ? `url(${portal.bgImage})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  // ── Already authorized ──
  if (paymentStatus === "success" || client.isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={bgStyle}>
        <div className="max-w-md w-full bg-onyx-900/85 backdrop-blur-xl rounded-3xl border border-emerald-500/30 p-8 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">You're Online!</h1>
          <p className="text-onyx-300 mb-6">Connected via <strong className="text-emerald-300">{portal.companyName}</strong></p>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <div className="text-xs uppercase tracking-wider text-onyx-400 mb-1">Time remaining</div>
            <div className="text-3xl font-black text-gold tabular-nums">{formatRemaining(remainingSeconds)}</div>
          </div>
          {data.session?.clientMac && (
            <div className="text-xs text-onyx-500 font-mono">Device: {data.session.clientMac}</div>
          )}
        </div>
      </div>
    );
  }

  // ── Polling state ──
  if (paymentStatus === "polling") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={bgStyle}>
        <div className="max-w-md w-full bg-onyx-900/85 backdrop-blur-xl rounded-3xl border border-gold-30 p-8 text-center shadow-2xl">
          <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white mb-2">Confirm on Your Phone</h2>
          <p className="text-onyx-300 mb-4">A payment prompt has been sent to <strong className="text-gold">{phone}</strong>. Enter your mobile money PIN to complete.</p>
          <p className="text-xs text-onyx-500">Waiting for confirmation…</p>
        </div>
      </div>
    );
  }

  // ── Main portal ──
  return (
    <div className="min-h-screen" style={bgStyle}>
      <div className="min-h-screen bg-gradient-to-br from-onyx-950/85 via-onyx-900/80 to-onyx-950/85 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
          {/* ── Header ── */}
          <div className="text-center mb-8">
            {portal.showLogo && portal.logo ? (
              <img src={portal.logo} alt={portal.companyName} className="w-20 h-20 mx-auto rounded-2xl mb-4 object-cover" />
            ) : (
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center mb-4">
                <Wifi className="w-9 h-9 text-gold" />
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{portal.companyName}</h1>
            <p className="text-onyx-300">{portal.welcomeText}</p>
          </div>

          {/* ── Trust badges ── */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure payment
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-lg">
              <Zap className="w-3.5 h-3.5" /> Instant activation
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold bg-gold/10 border border-gold/20 px-3 py-1.5 rounded-lg">
              <Smartphone className="w-3.5 h-3.5" /> Mobile money
            </span>
          </div>

          {/* ── Packages ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {packages.length === 0 && (
              <div className="md:col-span-3 text-center py-12 text-onyx-400">No packages available at the moment.</div>
            )}
            {packages.map((p) => {
              const isSelected = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`text-left rounded-2xl p-5 border-2 transition-all relative ${
                    isSelected
                      ? "border-gold bg-gold/10 shadow-lg shadow-gold/10 scale-[1.02]"
                      : "border-white/[0.08] bg-onyx-900/60 hover:border-gold-30 hover:bg-onyx-900/80"
                  }`}
                >
                  {p.isFeatured && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gold text-onyx-950 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                      Best value
                    </span>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-lg font-black text-white">{p.name}</div>
                      <div className="text-xs text-onyx-400 inline-flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {formatDuration(p.durationMinutes)}
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-gold shrink-0" />}
                  </div>
                  <div className="text-2xl font-black text-gold mb-2">{formatTzs(p.price)}</div>
                  {p.description && <p className="text-xs text-onyx-300 mb-2 line-clamp-2">{p.description}</p>}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {p.speedLimitDown && (
                      <span className="bg-sky-500/10 text-sky-300 px-2 py-0.5 rounded">{Math.round(p.speedLimitDown / 1000)} Mbps</span>
                    )}
                    {p.dataLimitMb && (
                      <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded">{p.dataLimitMb >= 1024 ? `${(p.dataLimitMb/1024).toFixed(1)}GB` : `${p.dataLimitMb}MB`}</span>
                    )}
                    <span className="bg-white/[0.04] text-onyx-300 px-2 py-0.5 rounded">{p.maxDevices} {p.maxDevices === 1 ? "device" : "devices"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Payment form ── */}
          {selected && (
            <div className="bg-onyx-900/85 backdrop-blur-xl rounded-3xl border border-gold-30 p-6 shadow-2xl">
              <h2 className="text-xl font-black text-white mb-4">Pay with Mobile Money</h2>
              {err && (
                <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-200">{err}</div>
              )}
              <label className="block text-xs font-bold uppercase tracking-wider text-onyx-400 mb-1.5">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full rounded-xl border border-gold-10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-onyx-500 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition-all mb-4"
                disabled={paying}
              />
              <button
                type="button"
                onClick={submitPayment}
                disabled={paying || !phone}
                className="w-full rounded-xl bg-gold text-onyx-950 px-6 py-3.5 font-black text-base shadow-lg shadow-gold/30 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" /> Pay {formatTzs(packages.find((p) => p.id === selected)?.price || 0)}
                  </>
                )}
              </button>
              <p className="text-[11px] text-onyx-500 text-center mt-3">
                Powered by Snippe · M-Pesa, Airtel Money, Mixx, Halotel
              </p>
            </div>
          )}

          {/* ── Footer ── */}
          {portal.termsUrl && (
            <div className="text-center mt-8 text-xs text-onyx-500">
              By paying you agree to our{" "}
              <a href={portal.termsUrl} target="_blank" rel="noopener" className="text-gold underline">
                terms of service
              </a>
              .
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

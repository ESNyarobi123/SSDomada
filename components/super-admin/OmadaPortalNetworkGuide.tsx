"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  Inbox,
  Globe2,
  ShieldCheck,
  Router,
  Wifi,
  ExternalLink,
  BookOpen,
} from "lucide-react";

function appHostname(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return "ssdomada.site";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname;
  } catch {
    return "ssdomada.site";
  }
}

function snippeHostHint(): string {
  const raw = process.env.NEXT_PUBLIC_SNIPPE_API_URL?.trim() || process.env.NEXT_PUBLIC_SNIPPE_HOST?.trim();
  if (!raw) return "api.snippe.co.tz";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname;
  } catch {
    return "api.snippe.co.tz";
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-onyx-200 hover:bg-white/10 transition-colors"
      aria-label={label}
    >
      {ok ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gold/80" />}
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex shrink-0 flex-col items-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-30 bg-gold/10 text-sm font-black text-gold shadow-sm shadow-gold/10">
          {n}
        </div>
        <div className="mt-1 w-px flex-1 min-h-[1rem] bg-gradient-to-b from-gold-30/50 to-transparent" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pb-8 last:pb-0">
        <h3 className="font-bold text-white text-base">{title}</h3>
        <div className="mt-2 space-y-2 text-sm text-onyx-300 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function OmadaPortalNetworkGuide() {
  const host = useMemo(() => appHostname(), []);
  const snippeHost = useMemo(() => snippeHostHint(), []);

  const preAuthLines = useMemo(
    () => [
      `# SSDomada app (portal + API)`,
      host,
      `www.${host}`,
      ``,
      `# Snippe (payments — add any extra checkout/CDN hosts from Snippe dashboard)`,
      snippeHost,
      ``,
      `# OS captive detection (keep unless you know your network does not need them)`,
      `captive.apple.com`,
      `www.apple.com`,
      `connectivitycheck.gstatic.com`,
      `clients3.google.com`,
      `www.msftconnecttest.com`,
      `dns.msftncsi.com`,
    ],
    [host, snippeHost]
  );

  const preAuthBlock = preAuthLines.join("\n");

  const portalExample = `https://${host}/portal/{brandSlug}`;

  return (
    <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-onyx-950/40 to-transparent p-5 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 mb-1">
            <Router className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Network &amp; captive portal</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Omada manual setup playbook</h2>
          <p className="mt-2 text-sm text-onyx-400 max-w-3xl">
            Use this after you open a reseller&apos;s{" "}
            <Link href="/super-admin/portal-requests" className="text-gold hover:underline font-semibold">
              Portal setup request
            </Link>
            . Goal: guest Wi‑Fi shows <strong className="text-onyx-200">Sign in to network</strong>, the phone opens the browser to SSDomada, the user pays (if required), then Omada marks them online.
          </p>
        </div>
        <Link
          href="/super-admin/portal-requests"
          className="inline-flex items-center gap-2 shrink-0 rounded-xl bg-sky-500/20 border border-sky-400/30 px-4 py-2.5 text-sm font-bold text-sky-100 hover:bg-sky-500/30 transition-colors"
        >
          <Inbox className="w-4 h-4" />
          Open requests queue
        </Link>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/25 p-4 flex flex-wrap items-center gap-3 text-xs text-onyx-400">
        <BookOpen className="w-4 h-4 text-gold shrink-0" />
        <span>
          Full reference with vendor links: <code className="text-gold/90 bg-white/5 px-1 rounded">docs/captive-preauth-allowlist.md</code> in the repo.
        </span>
      </div>

      <div className="space-y-0">
        <Step n={1} title="Pick the reseller case from Portal setup requests">
          <p>Expand a card and note <strong className="text-white">company</strong>, <strong className="text-white">Omada site id</strong>, <strong className="text-white">SSID</strong>, and <strong className="text-white">devices</strong>. In Omada Controller, switch to that same site before changing anything.</p>
        </Step>

        <Step n={2} title="WLAN / SSID (guest network)">
          <p>Ensure there is an <strong className="text-white">open</strong> (no WPA password) guest SSID on that site, bound to the hotspot / portal profile you will configure. Closed WPA networks will not show the captive flow the same way.</p>
        </Step>

        <Step n={3} title="External portal URL (Omada → Portal / Hotspot)">
          <p>Set type to <strong className="text-white">External portal</strong> (wording varies by Omada version). External URL must be reachable from the internet over HTTPS, for example:</p>
          <div className="flex flex-wrap items-center gap-2 mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-gold/95">
            <span className="break-all">{portalExample}</span>
            <CopyButton text={portalExample} label="Copy portal URL pattern" />
          </div>
          <p className="text-xs text-onyx-500 mt-1">Replace {"{brandSlug}"} with the value from the request card (e.g. sky-net-solution).</p>
        </Step>

        <Step n={4} title="Access control → Pre-Authentication Access">
          <p>
            In Omada go to something like <strong className="text-white">Authentication → Portal → Access Control</strong> or{" "}
            <strong className="text-white">Pre-Authentication Access</strong>. Add each hostname (or URL rule your build supports) so{" "}
            <strong className="text-white">before login</strong> the phone can reach Apple/Google/Microsoft connectivity checks, your app, and Snippe. Without this, users may stay &quot;connected&quot; but never get the sign-in sheet or payments may fail.
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-200/90 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Suggested hostnames (one per line)
              </div>
              <pre className="text-[11px] leading-relaxed text-onyx-300 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto scrollable-no-scrollbar border border-white/5 rounded-lg p-3 bg-black/30">
                {preAuthBlock}
              </pre>
            </div>
            <CopyButton text={preAuthBlock} label="Copy pre-auth host list" />
          </div>
          <p className="text-xs text-onyx-500 mt-2">
            Edit the first lines if your production domain differs. Add any extra Snippe hosts from their documentation.
          </p>
        </Step>

        <Step n={5} title="Hotspot Operator account (REQUIRED for auto sign-in)">
          <p>
            After a customer pays, SSDomada must call <code className="text-gold/90">POST /portal/auth</code> on the Omada
            Controller to flip the device from <strong className="text-white">Sign in to network</strong> to{" "}
            <strong className="text-white">Connected</strong>. That API needs a Hotspot Operator login.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-onyx-300 text-xs mt-2">
            <li>
              Omada Controller →{" "}
              <strong className="text-white">Site Settings → Authentication → Hotspot → Operators</strong>.
            </li>
            <li>
              Create a dedicated operator (e.g. <code className="text-gold/90">ssdomada-portal</code>) with a strong password. Do NOT reuse the Controller admin login.
            </li>
            <li>Grant access to <strong className="text-white">all sites</strong> the SSDomada deployment manages.</li>
            <li>
              Set these env vars on the SSDomada server and restart the app / redeploy Docker:
              <pre className="mt-2 text-[11px] font-mono leading-relaxed text-onyx-300 whitespace-pre-wrap border border-white/5 rounded-lg p-3 bg-black/30">
{`OMADA_URL="https://<your-controller>:<port>"
OMADA_HOTSPOT_USERNAME="ssdomada-portal"
OMADA_HOTSPOT_PASSWORD="<long random password>"
# Only for self-signed controllers in dev:
# OMADA_HOTSPOT_TLS_INSECURE="true"`}
              </pre>
            </li>
          </ol>
          <p className="text-xs text-onyx-500 mt-2">
            Without these, RADIUS will still record the session but Omada won&apos;t release the captive portal hold — the customer sees a successful payment but the phone keeps saying <em>Sign in to network</em>.
          </p>
        </Step>

        <Step n={6} title="Save, provision, and test">
          <p>Apply / save in Omada and wait for AP provisioning. On a phone: forget the Wi‑Fi → connect again → you should see <strong className="text-white">Sign in to network</strong> or the portal opens automatically. Complete a test payment if Snippe is live.</p>
          <ul className="list-disc pl-5 space-y-1 text-onyx-400 text-xs mt-2">
            <li>If the portal never opens: revisit Step 4 (pre-auth list).</li>
            <li>If the portal opens but payments fail: add missing payment hostnames to pre-auth.</li>
            <li>If payment succeeds but Wi‑Fi keeps showing &quot;Sign in to network&quot;: re-check Step 5 (Hotspot Operator).</li>
            <li>Optional API sync (when Open API works): <code className="text-gold/80">POST /api/v1/reseller/omada/sync-portal</code> — pre-auth remains manual in Omada.</li>
          </ul>
        </Step>
      </div>

      <div className="flex flex-wrap gap-3 pt-2 border-t border-white/[0.06]">
        <a
          href={`https://${host}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-onyx-200 hover:bg-white/5"
        >
          <Globe2 className="w-3.5 h-3.5 text-sky-400" />
          Open live app ({host})
        </a>
        <a
          href={`https://${host}/portal`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-onyx-200 hover:bg-white/5"
        >
          <Wifi className="w-3.5 h-3.5 text-gold" />
          Portal index
        </a>
        <a
          href="https://support.omadanetworks.com/en/document/13080/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-onyx-200 hover:bg-white/5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          TP-Link external portal guide
        </a>
      </div>
    </div>
  );
}

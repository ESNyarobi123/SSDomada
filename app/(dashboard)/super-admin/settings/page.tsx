"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Shield, Settings, Heart, Key, FlaskConical } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { RESELLER_PLAN_PAYWALL_SETTING_KEY } from "@/lib/platform-settings";

function maskValue(key: string, raw: string): string {
  const lower = key.toLowerCase();
  if (/(secret|password|token|key|credential|authorization)/i.test(lower) && raw.length > 8) {
    return `${raw.slice(0, 3)}…${raw.slice(-2)} (${raw.length} chars)`;
  }
  return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, { value: unknown; type: string; updatedAt?: string }>>({});
  const [health, setHealth] = useState<{
    checks: Record<string, { status: string; message?: string; latency?: number }>;
    timestamp: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [paywallSaving, setPaywallSaving] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    const [s, h] = await Promise.all([
      adminJson<{ settings: typeof settings }>("/api/v1/admin/settings?section=all"),
      adminJson<{
        section: string;
        checks: Record<string, { status: string; message?: string; latency?: number }>;
        stats: Record<string, number>;
        timestamp: string;
      }>("/api/v1/admin/settings?section=health"),
    ]);
    if (!s.ok) setErr(s.error || "Failed settings");
    else setSettings(s.data!.settings || {});
    if (h.ok && h.data) setHealth({ checks: h.data.checks, timestamp: h.data.timestamp });
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const paywallSetting = settings[RESELLER_PLAN_PAYWALL_SETTING_KEY];
  /** Missing row matches server default: paywall enforced. */
  const paywallEnforced = paywallSetting === undefined ? true : Boolean(paywallSetting.value);

  async function savePaywallEnforced(next: boolean) {
    setPaywallSaving(true);
    setErr(null);
    const r = await adminJson("/api/v1/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        key: RESELLER_PLAN_PAYWALL_SETTING_KEY,
        value: next ? "true" : "false",
        type: "boolean",
      }),
    });
    setPaywallSaving(false);
    if (!r.ok) {
      setErr(r.error || "Failed to update reseller plan gate");
      return;
    }
    await load();
  }

  const entries = Object.entries(settings)
    .filter(([k]) => k !== RESELLER_PLAN_PAYWALL_SETTING_KEY)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white md:text-4xl">System settings</h1>
          <p className="mt-1 text-onyx-400">
            Platform toggles and stored keys (sensitive values masked). Turn the reseller plan gate back on before production.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <Key className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Settings</span>
          </div>
          <div className="text-2xl font-black text-white">{entries.length}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Heart className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Health checks</span>
          </div>
          <div className="text-2xl font-black text-white">{health ? Object.keys(health.checks).length : 0}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
              <Settings className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Masked keys</span>
          </div>
          <div className="text-2xl font-black text-white">{entries.filter(([k]) => /(secret|password|token|key|credential|authorization)/i.test(k)).length}</div>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Reseller plan gate (QA) ── */}
      {!loading && (
        <div
          className={`rounded-2xl border p-5 ${
            paywallEnforced
              ? "border-gold-10 bg-gradient-to-br from-gold-5/15 via-transparent to-transparent"
              : "border-amber-500/35 bg-amber-500/10"
          }`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                <FlaskConical className={`h-5 w-5 ${paywallEnforced ? "text-gold" : "text-amber-300"}`} />
              </div>
              <div>
                <h2 className="font-bold text-white">Reseller plan gate</h2>
                <p className="mt-1 max-w-xl text-sm text-onyx-400">
                  When off, resellers can add sites and devices without an active Starter/Growth subscription or plan
                  limits. Use only for testing; turn on again before launch.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${paywallEnforced ? "text-emerald-400" : "text-amber-300"}`}>
                {paywallEnforced ? "Enforced" : "Bypassed"}
              </span>
              <button
                type="button"
                disabled={paywallSaving}
                onClick={() => void savePaywallEnforced(!paywallEnforced)}
                className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer rounded-full border transition-colors disabled:opacity-50 ${
                  paywallEnforced ? "border-emerald-500/40 bg-emerald-500/15" : "border-amber-400/50 bg-amber-500/25"
                }`}
                aria-pressed={!paywallEnforced}
                aria-label={paywallEnforced ? "Disable reseller plan gate" : "Enable reseller plan gate"}
              >
                <span
                  className={`pointer-events-none absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                    paywallEnforced ? "left-1 translate-x-0" : "left-1 translate-x-7"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Health card ── */}
      {health && (
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-gold">
            <Shield className="h-5 w-5" />
            Live health
          </h2>
          <p className="mb-3 text-xs text-onyx-400">{health.timestamp}</p>
          <ul className="space-y-2 text-sm">
            {Object.entries(health.checks).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2 border-b border-white/[0.06] py-2">
                <span className="text-onyx-300">{k}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                  v.status === "healthy" || v.status === "connected"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${v.status === "healthy" || v.status === "connected" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {v.status}
                  {v.latency != null ? ` · ${v.latency}ms` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Settings table ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-onyx-400">
                <th className="px-5 py-3 font-semibold">Key</th>
                <th className="px-5 py-3 font-semibold">Value</th>
                <th className="px-5 py-3 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {entries.map(([key, obj]) => (
                <tr key={key} className="hover:bg-gold-5/20 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gold">{key}</td>
                  <td className="max-w-md truncate px-5 py-3 font-mono text-xs text-onyx-300" title={String(obj.value)}>
                    {maskValue(key, String(obj.value))}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center text-xs bg-white/[0.04] px-2.5 py-1 rounded-lg text-onyx-300">{obj.type}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && <p className="px-5 py-8 text-center text-onyx-500">No settings rows in database.</p>}
        </div>
      )}
    </div>
  );
}

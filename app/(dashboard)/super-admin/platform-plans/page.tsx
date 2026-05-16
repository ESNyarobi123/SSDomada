"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Layers,
  ExternalLink,
  X,
} from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatTzs } from "@/lib/format-currency";

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  trialDays: number;
  maxSites: number | null;
  maxDevices: number | null;
  maxActiveClients: number | null;
  maxStaff: number | null;
  customBranding: boolean;
  customDomain: boolean;
  smsNotifications: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  _count: { subscriptions: number };
};

function limitOrNull(label: string, v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${label} must be a whole number greater than 0, or empty for unlimited.`);
  }
  return n;
}

function wholeNumber(label: string, v: string, min: number, max?: number): number {
  const t = v.trim();
  if (t === "") {
    throw new Error(`${label} is required.`);
  }
  const n = Number(t);
  if (!Number.isInteger(n) || n < min || (max != null && n > max)) {
    throw new Error(`${label} must be a whole number${max != null ? ` between ${min} and ${max}` : ` >= ${min}`}.`);
  }
  return n;
}

export default function AdminPlatformPlansPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | PlanRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams({ page: String(meta.page), limit: String(meta.limit) });
    const r = await adminJson<{ plans: PlanRow[] }>(`/api/v1/admin/platform-plans?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setPlans(r.data!.plans);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white md:text-4xl flex items-center gap-3">
            <Layers className="h-8 w-8 text-gold" />
            Reseller platform plans
          </h1>
          <p className="mt-1 text-onyx-400 max-w-2xl">
            Tiers SSDomada charges resellers for using the platform (sites, devices, limits). Resellers see these on{" "}
            <Link href="/pricing" className="text-gold hover:underline inline-flex items-center gap-1">
              /pricing <ExternalLink className="w-3 h-3" />
            </Link>{" "}
            and subscribe under <span className="text-onyx-200">Billing</span> in their console. Assign a plan per reseller from{" "}
            <Link href="/super-admin/resellers" className="text-gold hover:underline">
              Resellers → detail → Platform plan
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setModal("create")}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-onyx-950 hover:bg-gold-400"
          >
            <Plus className="h-4 w-4" />
            New plan
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gold-10 bg-gradient-to-br from-gold-5/20 via-transparent to-transparent">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-onyx-400">
                <th className="px-5 py-3 font-semibold">Plan</th>
                <th className="px-5 py-3 font-semibold">Price</th>
                <th className="px-5 py-3 font-semibold">Interval</th>
                <th className="px-5 py-3 font-semibold">Limits</th>
                <th className="px-5 py-3 text-right font-semibold">Resellers</th>
                <th className="px-5 py-3 font-semibold">State</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-gold-5/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{p.name}</div>
                    <div className="text-xs font-mono text-onyx-500">{p.slug}</div>
                    {p.description && <div className="text-xs text-onyx-400 mt-0.5 line-clamp-2">{p.description}</div>}
                  </td>
                  <td className="px-5 py-3 font-bold text-gold">{formatTzs(p.price)}</td>
                  <td className="px-5 py-3 text-onyx-300">{p.interval}</td>
                  <td className="px-5 py-3 text-xs text-onyx-400">
                    Sites {p.maxSites ?? "∞"} · APs {p.maxDevices ?? "∞"} · Clients {p.maxActiveClients ?? "∞"}
                  </td>
                  <td className="px-5 py-3 text-right text-white font-bold">{p._count.subscriptions}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.isActive ? (
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/25">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/25">
                          Off
                        </span>
                      )}
                      {p.isFeatured && (
                        <span className="rounded-md bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold border border-gold/25">
                          Featured
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setModal(p)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete plan “${p.name}”? Only allowed if no reseller uses it.`)) return;
                        const res = await authFetch(`/api/v1/admin/platform-plans/${p.id}`, { method: "DELETE" });
                        const j = await res.json();
                        if (!res.ok) alert(j.error || "Failed");
                        else void load();
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-400 hover:underline"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {plans.length === 0 && <div className="px-5 py-12 text-center text-onyx-500">No plans yet. Create one or run seed.</div>}
        </div>
      )}

      {modal && (
        <PlanModal
          mode={modal === "create" ? "create" : "edit"}
          initial={modal === "create" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function PlanModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial: PlanRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [price, setPrice] = useState(String(initial?.price ?? 0));
  const [currency, setCurrency] = useState(initial?.currency || "TZS");
  const [interval, setInterval] = useState(initial?.interval || "MONTHLY");
  const [trialDays, setTrialDays] = useState(String(initial?.trialDays ?? 0));
  const [maxSites, setMaxSites] = useState(initial?.maxSites != null ? String(initial.maxSites) : "");
  const [maxDevices, setMaxDevices] = useState(initial?.maxDevices != null ? String(initial.maxDevices) : "");
  const [maxActiveClients, setMaxActiveClients] = useState(initial?.maxActiveClients != null ? String(initial.maxActiveClients) : "");
  const [maxStaff, setMaxStaff] = useState(initial?.maxStaff != null ? String(initial.maxStaff) : "");
  const [customBranding, setCustomBranding] = useState(initial?.customBranding ?? false);
  const [customDomain, setCustomDomain] = useState(initial?.customDomain ?? false);
  const [smsNotifications, setSmsNotifications] = useState(initial?.smsNotifications ?? false);
  const [prioritySupport, setPrioritySupport] = useState(initial?.prioritySupport ?? false);
  const [apiAccess, setApiAccess] = useState(initial?.apiAccess ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let payload: Record<string, unknown>;
    try {
      payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || null,
        price: wholeNumber("Price", price, 0),
        currency: currency.trim() || "TZS",
        interval,
        trialDays: wholeNumber("Trial days", trialDays, 0, 730),
        maxSites: limitOrNull("Max sites", maxSites),
        maxDevices: limitOrNull("Max devices", maxDevices),
        maxActiveClients: limitOrNull("Max active clients", maxActiveClients),
        maxStaff: limitOrNull("Max staff", maxStaff),
        customBranding,
        customDomain,
        smsNotifications,
        prioritySupport,
        apiAccess,
        isActive,
        isFeatured,
        sortOrder: wholeNumber("Sort order", sortOrder, -100000),
      };
    } catch (er: unknown) {
      alert(er instanceof Error ? er.message : "Invalid numbers");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await authFetch("/api/v1/admin/platform-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Failed");
      } else if (initial) {
        const res = await authFetch(`/api/v1/admin/platform-plans/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Failed");
      }
      onSaved();
    } catch (er: unknown) {
      alert(er instanceof Error ? er.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-xl my-8 rounded-2xl border border-gold-10 bg-onyx-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{mode === "create" ? "New platform plan" : "Edit platform plan"}</h2>
          <button type="button" onClick={onClose} className="p-2 text-onyx-400 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 text-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-onyx-400">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-onyx-400">Slug (unique)</span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 font-mono text-white"
                pattern="[a-z0-9-]+"
              />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-onyx-400">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white min-h-[64px]"
            />
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="space-y-1 block">
              <span className="text-onyx-400">Price (TZS)</span>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-onyx-400">Currency</span>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-onyx-400">Interval</span>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              >
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
                <option value="LIFETIME">LIFETIME</option>
              </select>
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-onyx-400">Trial days</span>
            <input
              type="number"
              min={0}
              max={730}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            />
          </label>
          <p className="text-[10px] text-onyx-500">Leave limits empty for unlimited (null in database).</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-onyx-400">Max sites</span>
              <input
                type="number"
                min={1}
                step={1}
                value={maxSites}
                onChange={(e) => setMaxSites(e.target.value)}
                placeholder="empty = ∞"
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-onyx-400">Max devices</span>
              <input
                type="number"
                min={1}
                step={1}
                value={maxDevices}
                onChange={(e) => setMaxDevices(e.target.value)}
                placeholder="empty = ∞"
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-onyx-400">Max active clients</span>
              <input
                type="number"
                min={1}
                step={1}
                value={maxActiveClients}
                onChange={(e) => setMaxActiveClients(e.target.value)}
                placeholder="empty = ∞"
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-onyx-400">Max staff</span>
              <input
                type="number"
                min={1}
                step={1}
                value={maxStaff}
                onChange={(e) => setMaxStaff(e.target.value)}
                placeholder="empty = ∞"
                className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["Custom branding", customBranding, setCustomBranding],
              ["Custom domain support", customDomain, setCustomDomain],
              ["SMS notifications", smsNotifications, setSmsNotifications],
              ["Priority support", prioritySupport, setPrioritySupport],
              ["API access", apiAccess, setApiAccess],
              ["Active listing", isActive, setIsActive],
              ["Featured on /pricing", isFeatured, setIsFeatured],
            ].map(([label, val, set]) => (
              <label key={label as string} className="flex items-center gap-2 text-onyx-300 cursor-pointer">
                <input type="checkbox" checked={val as boolean} onChange={(e) => (set as (v: boolean) => void)(e.target.checked)} />
                {label as string}
              </label>
            ))}
          </div>
          <label className="space-y-1 block">
            <span className="text-onyx-400">Sort order</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-onyx-950 px-3 py-2 text-white"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-onyx-300">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-gold px-4 py-2 font-bold text-onyx-950 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

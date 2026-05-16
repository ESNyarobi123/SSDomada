"use client";

import Link from "next/link";
import { Crown, Clock, Zap, AlertTriangle } from "lucide-react";
import { enabledFeatureLabels } from "@/lib/reseller-plan-features";
import type { PlanFeatureKey } from "@/lib/reseller-plan-features";

export type ResellerBillingSidebar = {
  access: { ok: boolean; code?: string; message?: string };
  period: {
    status: string;
    planName: string | null;
    daysRemaining: number | null;
    label: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  features: Record<PlanFeatureKey, boolean> | null;
};

export function ResellerPlanSidebar({
  billing,
  collapsed,
}: {
  billing: ResellerBillingSidebar | null;
  collapsed?: boolean;
}) {
  const active = billing?.access.ok;
  const period = billing?.period;
  const feats = enabledFeatureLabels(billing?.features);
  const href = active ? "/reseller/plan?manage=1" : "/reseller/plan";

  if (collapsed) {
    return (
      <Link
        href={href}
        title={period?.planName || "SSDomada plan"}
        className={`flex justify-center py-2.5 mx-auto w-11 rounded-xl border transition-colors ${
          active ? "border-gold-20 bg-gold-10 text-gold" : "border-red-500/25 bg-red-500/10 text-red-300"
        }`}
      >
        {active ? <Crown className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`block rounded-xl border p-3 transition-all ${
        active
          ? "border-gold-20 bg-gradient-to-br from-gold-5/40 to-transparent hover:border-gold-30"
          : "border-red-500/25 bg-red-500/10 hover:border-red-500/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? "bg-gold-10" : "bg-red-500/15"}`}
        >
          {active ? <Crown className="w-3.5 h-3.5 text-gold" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-onyx-500">SSDomada plan</div>
          <div className="text-sm font-bold text-white truncate">{period?.planName || "Choose a plan"}</div>
        </div>
      </div>
      {period ? (
        <div className="flex items-center gap-1.5 text-[11px] mb-2">
          <Clock className="w-3 h-3 shrink-0 text-onyx-500" />
          <span className={active ? "text-onyx-300" : "text-red-200"}>{period.label}</span>
        </div>
      ) : (
        <p className="text-[11px] text-red-200 mb-2">Start a trial or subscribe to unlock your dashboard.</p>
      )}
      {active && feats.length > 0 ? (
        <ul className="space-y-1">
          {feats.slice(0, 4).map((f) => (
            <li key={f} className="flex items-center gap-1.5 text-[10px] text-onyx-400">
              <Zap className="w-2.5 h-2.5 text-gold shrink-0" />
              <span className="truncate">{f}</span>
            </li>
          ))}
          {feats.length > 4 ? <li className="text-[10px] text-gold-600-op">+{feats.length - 4} more</li> : null}
        </ul>
      ) : null}
      {!active && billing?.access.message ? (
        <p className="text-[10px] text-red-200/90 mt-1 leading-snug">{billing.access.message}</p>
      ) : null}
      <div className="mt-2 text-[10px] font-bold text-gold uppercase tracking-wider">
        {active ? "Manage plan →" : "Activate now →"}
      </div>
    </Link>
  );
}

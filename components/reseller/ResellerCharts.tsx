"use client";

import type { ReactNode } from "react";
import { formatTzsCompact } from "@/lib/format-currency";

export type HistItem = { label: string; value: number; title?: string };

/** Vertical histogram — values must be ≥ 0. Uses real data only (caller supplies from API). */
export function Histogram({
  items,
  formatValue = (n) => formatTzsCompact(n),
  barHeightPx = 128,
  variant = "gold",
}: {
  items: HistItem[];
  formatValue?: (n: number) => string;
  barHeightPx?: number;
  variant?: "gold" | "emerald" | "sky" | "violet";
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const grad =
    variant === "emerald"
      ? "from-emerald-900/50 via-emerald-500/70 to-emerald-400"
      : variant === "sky"
        ? "from-sky-900/50 via-sky-500/70 to-sky-400"
        : variant === "violet"
          ? "from-violet-900/50 via-violet-500/70 to-violet-400"
          : "from-amber-900/40 via-gold/80 to-gold";

  if (items.length === 0) {
    return <p className="text-sm text-onyx-500 py-8 text-center">No data for this range.</p>;
  }

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="flex items-end justify-stretch gap-1 min-w-min px-1" style={{ minHeight: barHeightPx + 40 }}>
        {items.map((item) => {
          const pct = Math.max(4, (item.value / max) * 100);
          return (
            <div key={item.label} className="flex flex-col items-center gap-1.5 flex-1 min-w-[8px] max-w-[28px]">
              <div
                className="w-full flex flex-col items-center justify-end rounded-t-md"
                style={{ height: barHeightPx }}
              >
                <div
                  className={`w-full max-w-[22px] rounded-t-md bg-gradient-to-t ${grad} shadow-[0_0_18px_rgba(255,215,0,0.12)] ring-1 ring-white/10 transition-transform hover:scale-[1.02] origin-bottom`}
                  style={{ height: `${pct}%` }}
                  title={item.title ?? `${item.label}: ${formatValue(item.value)}`}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] font-medium text-onyx-500 text-center leading-tight max-w-full truncate px-0.5">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Horizontal ranked bars (e.g. package revenue from API). */
export function RankedBars({
  rows,
  formatValue = (n) => formatTzsCompact(n),
  maxRows = 8,
}: {
  rows: { name: string; value: number; hint?: string }[];
  formatValue?: (n: number) => string;
  maxRows?: number;
}) {
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, maxRows);
  const max = Math.max(...sorted.map((r) => r.value), 1);
  if (sorted.length === 0) {
    return <p className="text-sm text-onyx-500 py-4">No rows to compare.</p>;
  }
  return (
    <ul className="space-y-3">
      {sorted.map((r) => (
        <li key={r.name}>
          <div className="flex justify-between text-xs mb-1 gap-2">
            <span className="text-onyx-200 truncate font-medium" title={r.name}>
              {r.name}
            </span>
            <span className="text-gold font-bold shrink-0 tabular-nums" title={r.hint}>
              {formatValue(r.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden ring-1 ring-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold/30 via-gold to-amber-300 transition-all duration-500"
              style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Stacked proportion strip (e.g. device online / offline / pending from API summary). */
export function StackedStrip({
  segments,
}: {
  segments: { key: string; value: number; className: string; label: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden ring-1 ring-white/10">
        {segments.map((seg) => (
          <div
            key={seg.key}
            style={{ width: `${(seg.value / total) * 100}%` }}
            className={seg.className}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-onyx-400">
        {segments.map((seg) => (
          <span key={seg.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${seg.className}`} />
            {seg.label} <span className="text-white font-semibold">{seg.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChartPanel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-onyx-900/80 to-onyx-950/90 p-5 sm:p-6 shadow-xl shadow-black/20 ring-1 ring-gold/10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-onyx-500 mt-1 max-w-xl">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function AccountPageShell({
  children,
  maxWidth = "max-w-6xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return <div className={`space-y-6 ${maxWidth} mx-auto`}>{children}</div>;
}

export function AccountPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{title}</h1>
        <p className="text-onyx-400 mt-1 max-w-2xl">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function AccountAlert({
  variant,
  children,
}: {
  variant: "error" | "success";
  children: ReactNode;
}) {
  const styles =
    variant === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  const Icon = variant === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

export function AccountSection({
  id,
  title,
  description,
  icon,
  accent = "gold",
  children,
  footer,
}: {
  id?: string;
  title: string;
  description?: string;
  icon: ReactNode;
  accent?: "gold" | "sky" | "emerald" | "amber" | "red";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const accentMap = {
    gold: {
      border: "border-gold-15",
      bg: "from-gold-5/40 via-onyx-900/40 to-transparent",
      icon: "bg-gold-10 text-gold",
      line: "via-gold-25",
    },
    sky: {
      border: "border-sky-500/15",
      bg: "from-sky-500/5 via-onyx-900/40 to-transparent",
      icon: "bg-sky-500/10 text-sky-400",
      line: "via-sky-500/25",
    },
    emerald: {
      border: "border-emerald-500/15",
      bg: "from-emerald-500/5 via-onyx-900/40 to-transparent",
      icon: "bg-emerald-500/10 text-emerald-400",
      line: "via-emerald-500/25",
    },
    amber: {
      border: "border-amber-500/15",
      bg: "from-amber-500/5 via-onyx-900/40 to-transparent",
      icon: "bg-amber-500/10 text-amber-400",
      line: "via-amber-500/25",
    },
    red: {
      border: "border-red-500/15",
      bg: "from-red-500/5 via-onyx-900/40 to-transparent",
      icon: "bg-red-500/10 text-red-400",
      line: "via-red-500/25",
    },
  }[accent];

  return (
    <section
      id={id}
      className={`scroll-mt-28 rounded-2xl border ${accentMap.border} bg-gradient-to-br ${accentMap.bg} overflow-hidden`}
    >
      <div className={`h-px bg-gradient-to-r from-transparent ${accentMap.line} to-transparent`} />
      <div className="p-5 md:p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentMap.icon}`}>
            {icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{title}</h2>
            {description ? <p className="text-sm text-onyx-400 mt-0.5">{description}</p> : null}
          </div>
        </div>
        {children}
        {footer ? <div className="mt-5 pt-5 border-t border-white/[0.06]">{footer}</div> : null}
      </div>
    </section>
  );
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-gold-600-op">{children}</span>
      {hint ? <span className="block text-[11px] font-normal normal-case text-onyx-500 mt-0.5">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors disabled:opacity-45 disabled:cursor-not-allowed";

export function AccountInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className || ""}`} />;
}

export function AccountTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputClass} resize-y min-h-[88px] ${props.className || ""}`}
    />
  );
}

export function AccountPrimaryButton({
  children,
  loading,
  type = "button",
  onClick,
  disabled,
}: {
  children: ReactNode;
  loading?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 hover:shadow-gold/30 disabled:opacity-50 transition-all"
    >
      {children}
    </button>
  );
}

export function AccountSecondaryButton({
  children,
  href,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-gold-20 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function StatPill({
  label,
  value,
  icon,
  variant = "default",
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  variant?: "gold" | "default";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        variant === "gold"
          ? "border-gold-15 bg-gradient-to-br from-gold-5/40 to-transparent"
          : "border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            variant === "gold" ? "bg-gold-10 text-gold" : "bg-white/[0.06] text-onyx-300"
          }`}
        >
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">{label}</span>
      </div>
      <div className="text-xl font-black text-white">{value}</div>
    </div>
  );
}

export function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit == null || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const atCap = limit != null && used >= limit;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">{label}</span>
        <span className={`text-xs font-bold ${atCap ? "text-amber-400" : "text-white"}`}>
          {used} / {limit == null ? "∞" : limit}
        </span>
      </div>
      {limit != null && (
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${atCap ? "bg-amber-400" : "bg-gold"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
      } ${checked ? "border-gold-25 bg-gold-5/25" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}
    >
      <div className="min-w-0">
        <span className={`text-sm font-semibold block ${checked ? "text-white" : "text-onyx-300"}`}>{label}</span>
        {description ? <span className="text-xs text-onyx-500 mt-0.5 block">{description}</span> : null}
      </div>
      <div
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${checked ? "bg-gold" : "bg-white/10"}`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-all ${
            checked ? "left-[22px] bg-onyx-950" : "left-0.5 bg-onyx-400"
          }`}
        />
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
      </div>
    </label>
  );
}

export function SettingsNav({
  items,
  active,
  onSelect,
}: {
  items: { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      className="flex flex-row flex-wrap gap-2 p-2 rounded-2xl border border-gold-15 bg-gradient-to-br from-gold-5/25 via-onyx-900/60 to-onyx-950 w-full overflow-x-auto"
      aria-label="Settings sections"
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
              isActive
                ? "bg-gold text-onyx-950 shadow-md shadow-gold/25"
                : "text-onyx-300 hover:text-white hover:bg-white/5"
            }`}
          >
            {item.icon ? (
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-onyx-950/15 text-onyx-950" : "bg-white/[0.06] text-gold"
                }`}
              >
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users,
  Package,
  CreditCard,
  Banknote,
  Router,
  MapPin,
  Radio,
  Inbox,
  BarChart3,
  ScrollText,
  SlidersHorizontal,
  LogOut,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Layers,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { fetchSession, redirectAfterAuth, setStoredToken } from "@/lib/auth-client";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const sections: { title: string; items: NavItem[] }[] = [
  { title: "Control", items: [{ href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Business",
    items: [
      { href: "/super-admin/resellers", label: "Resellers", icon: Store },
      { href: "/super-admin/platform-plans", label: "Reseller plans", icon: Layers },
      { href: "/super-admin/customers", label: "Customers", icon: Users },
      { href: "/super-admin/subscriptions", label: "Subscriptions", icon: Package },
      { href: "/super-admin/payments", label: "Payments", icon: CreditCard },
      { href: "/super-admin/payouts", label: "Withdrawals & payouts", icon: Banknote },
    ],
  },
  {
    title: "Network",
    items: [
      { href: "/super-admin/devices", label: "All devices", icon: Router },
      { href: "/super-admin/sites", label: "Omada sites", icon: MapPin },
      { href: "/super-admin/omada-devices", label: "Live site devices", icon: Radio },
      { href: "/super-admin/portal-requests", label: "Portal setup requests", icon: Inbox },
    ],
  },
  {
    title: "Security & ops",
    items: [
      { href: "/super-admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/super-admin/audit-logs", label: "Audit logs", icon: ScrollText },
      { href: "/super-admin/settings", label: "System settings", icon: SlidersHorizontal },
    ],
  },
];

function navActive(pathname: string, href: string) {
  if (href === "/super-admin/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIDEBAR_KEY = "superadmin_sidebar_collapsed";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await fetchSession();
      if (cancelled) return;
      if (!u) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (u.role !== "SUPER_ADMIN") {
        router.replace(redirectAfterAuth(u));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function logout() {
    await fetch("/api/v1/auth", { method: "DELETE", credentials: "include" });
    setStoredToken(null);
    router.push("/login");
    router.refresh();
  }

  function NavLinks({ narrow, onNavigate }: { narrow?: boolean; onNavigate?: () => void }) {
    return (
      <div className={narrow ? "space-y-1" : "space-y-5"}>
        {sections.map((section, si) => (
          <div key={section.title}>
            {narrow ? (
              si > 0 ? <div className="h-2 shrink-0" aria-hidden /> : null
            ) : (
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-rose-200/45 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-rose-500/30 to-transparent" />
                <span className="shrink-0">{section.title}</span>
                <div className="h-px flex-1 bg-gradient-to-l from-rose-500/30 to-transparent" />
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = navActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={narrow ? label : undefined}
                    onClick={onNavigate}
                    className={`group flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                      narrow ? "justify-center px-0 py-2.5 mx-auto w-11" : "relative gap-3 px-3 py-2.5"
                    } ${
                      active
                        ? "bg-rose-500/15 text-rose-50 border border-rose-500/35 shadow-[0_0_20px_rgba(244,63,94,0.12)]"
                        : "text-onyx-300 hover:bg-white/[0.05] hover:text-white border border-transparent"
                    }`}
                  >
                    {active && !narrow && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-rose-400 shadow-[0_0_8px_rgba(244,114,182,0.5)]" aria-hidden />
                    )}
                    <Icon className={`w-4 h-4 shrink-0 transition-opacity ${active ? "text-rose-200" : "opacity-80 group-hover:opacity-100"}`} />
                    {!narrow && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 overflow-hidden bg-onyx-950 text-white">
      <aside
        className={`hidden lg:flex h-full min-h-0 shrink-0 flex-col border-r border-white/[0.06] bg-gradient-to-b from-onyx-900/70 via-onyx-950/90 to-onyx-950 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? "w-[4.25rem] xl:w-[4.5rem]" : "w-64 xl:w-72"
        }`}
      >
        <div
          className={`shrink-0 border-b border-white/[0.06] ${
            collapsed ? "flex flex-col items-center gap-2 p-3" : "flex items-center gap-2 p-4 pr-3"
          } bg-black/15`}
        >
          {collapsed ? (
            <>
              <Link href="/super-admin/dashboard" className="flex justify-center rounded-xl p-1 hover:bg-white/5" title="SSDomada Super Admin">
                <Image src="/images/SSDomada.png" alt="" width={36} height={36} className="rounded-lg" />
              </Link>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/35 text-rose-100 hover:bg-rose-500/15 transition-colors"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <Link href="/super-admin/dashboard" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 -m-1 hover:bg-white/5">
                <Image src="/images/SSDomada.png" alt="" width={40} height={40} className="shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wide text-rose-100/90">Super Admin</div>
                  <div className="text-[10px] text-onyx-500">Control center</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-onyx-400 hover:bg-rose-500/15 hover:text-rose-100 border border-transparent hover:border-rose-500/25 transition-all"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        <div
          className={`shrink-0 mx-3 mt-2 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-950/25 px-3 py-2 text-[10px] text-rose-100/85 ${
            collapsed ? "mx-2 justify-center px-2" : ""
          }`}
          title="All admin routes require SUPER_ADMIN. Actions are audit-logged."
        >
          <Shield className={`w-3.5 h-3.5 shrink-0 text-rose-300 ${collapsed ? "" : ""}`} />
          {!collapsed && <span className="leading-tight">Secured session · role verified per request</span>}
        </div>

        <nav className="min-h-0 flex-1 scrollable-no-scrollbar overflow-x-hidden overflow-y-auto px-2 pt-3 pb-1">
          <NavLinks narrow={collapsed} />
        </nav>

        <div className="shrink-0 border-t border-white/[0.06] bg-black/15 p-2">
          <button
            type="button"
            onClick={() => void logout()}
            title={collapsed ? "Sign out" : undefined}
            className={`flex w-full items-center rounded-xl text-sm font-medium text-onyx-400 transition-colors hover:bg-red-500/10 hover:text-red-200 ${
              collapsed ? "mx-auto w-11 justify-center py-2.5" : "gap-3 px-3 py-2.5"
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-onyx-900/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Link href="/super-admin/dashboard" className="flex items-center gap-2">
            <Image src="/images/SSDomada.png" alt="" width={36} height={36} className="rounded-lg" />
            <span className="text-sm font-bold text-rose-100">Super Admin</span>
          </Link>
          <button type="button" className="p-2 text-rose-200" aria-label="Menu" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>
        {mobileOpen && (
          <div className="max-h-[70vh] scrollable-no-scrollbar overflow-y-auto overflow-x-hidden border-b border-rose-950/40 bg-onyx-900/95 backdrop-blur-xl px-4 py-4 lg:hidden">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              className="mt-3 flex w-full items-center gap-2 border-t border-white/10 py-3 text-left text-sm font-medium text-red-300"
              onClick={() => {
                setMobileOpen(false);
                void logout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
        <main className="min-h-0 flex-1 scrollable-no-scrollbar overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

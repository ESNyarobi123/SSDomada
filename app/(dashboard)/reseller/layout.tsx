"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Router,
  Building2,
  Wifi,
  Package,
  Users,
  Wallet,
  Banknote,
  Globe,
  LogOut,
  Menu,
  X,
  BarChart3,
  UserCircle,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  Megaphone,
  XCircle,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import Image from "next/image";
import { setStoredToken, fetchSession, redirectAfterAuth, authFetch } from "@/lib/auth-client";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ href: "/reseller/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Network",
    items: [
      { href: "/reseller/devices", label: "Devices & APs", icon: Router },
      { href: "/reseller/sites", label: "Sites", icon: Building2 },
      { href: "/reseller/ssids", label: "SSID manager", icon: Wifi },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/reseller/packages", label: "Packages", icon: Package },
      { href: "/reseller/clients", label: "Clients", icon: Users },
      { href: "/reseller/captive-portal", label: "Captive portal", icon: Globe },
      { href: "/reseller/revenue", label: "Revenue", icon: Wallet },
      { href: "/reseller/withdrawals", label: "Withdrawals", icon: Banknote },
    ],
  },
  {
    title: "Insights",
    items: [{ href: "/reseller/analytics", label: "Reports & analytics", icon: BarChart3 }],
  },
  {
    title: "Account",
    items: [
      { href: "/reseller/profile", label: "Profile & brand", icon: UserCircle },
      { href: "/reseller/settings", label: "Settings", icon: SlidersHorizontal },
    ],
  },
];

function navActive(pathname: string, href: string) {
  if (href === "/reseller/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const IMPERSONATION_ACTIVE_KEY = "ssdomada_impersonation_active";
const IMPERSONATION_BACKUP_TOKEN_KEY = "ssdomada_impersonation_backup_token";
const IMPERSONATION_RETURN_PATH_KEY = "ssdomada_impersonation_return_path";

type DashboardNotice = { id: string; title: string | null; body: string; createdAt: string };

const SIDEBAR_COLLAPSED_KEY = "reseller_sidebar_collapsed";

export default function ResellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [impersonationBar, setImpersonationBar] = useState(false);
  const [notices, setNotices] = useState<DashboardNotice[]>([]);

  useLayoutEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      setImpersonationBar(sessionStorage.getItem(IMPERSONATION_ACTIVE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await authFetch("/api/v1/reseller/notices");
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: DashboardNotice[] };
      if (cancelled || !json.success || !json.data?.length) return;
      setNotices(json.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function exitImpersonation() {
    try {
      const backup = sessionStorage.getItem(IMPERSONATION_BACKUP_TOKEN_KEY);
      const returnPath = sessionStorage.getItem(IMPERSONATION_RETURN_PATH_KEY) || "/super-admin/resellers";
      if (backup) setStoredToken(backup);
      sessionStorage.removeItem(IMPERSONATION_ACTIVE_KEY);
      sessionStorage.removeItem(IMPERSONATION_BACKUP_TOKEN_KEY);
      sessionStorage.removeItem(IMPERSONATION_RETURN_PATH_KEY);
      router.replace(returnPath);
    } catch {
      router.replace("/super-admin/resellers");
    }
  }

  async function dismissNotice(noticeId: string) {
    const res = await authFetch(`/api/v1/reseller/notices/${noticeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await fetchSession();
      if (cancelled) return;
      if (!u) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (u.role !== "RESELLER") {
        router.replace(redirectAfterAuth(u));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
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

  function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
    return (
      <div className={collapsed ? "space-y-1" : "space-y-5"}>
        {sections.map((section, si) => (
          <div key={section.title}>
            {collapsed ? (
              si > 0 ? <div className="h-2 shrink-0" aria-hidden /> : null
            ) : (
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-gold-20-op flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-gold-10 to-transparent" />
                <span className="shrink-0">{section.title}</span>
                <div className="h-px flex-1 bg-gradient-to-l from-gold-10 to-transparent" />
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = navActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    onClick={onNavigate}
                    className={`group flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                      collapsed ? "justify-center px-0 py-2.5 mx-auto w-11" : "gap-3 px-3 py-2.5"
                    } ${
                      active
                        ? "bg-gold-10 text-gold border border-gold-20 shadow-[0_0_20px_rgba(255,215,0,0.08)] relative"
                        : "text-onyx-300 hover:bg-white/[0.04] hover:text-white border border-transparent"
                    }`}
                  >
                    {active && !collapsed && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gold" />
                    )}
                    <Icon className={`w-4 h-4 shrink-0 transition-colors duration-200 ${active ? "text-gold" : "opacity-70 group-hover:opacity-100 group-hover:text-gold-50-op"}`} />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const collapsed = sidebarCollapsed;

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 overflow-hidden bg-onyx-950 text-white">
      <aside
        className={`hidden lg:flex h-full min-h-0 flex-col border-r border-white/[0.06] bg-gradient-to-b from-onyx-900/60 via-onyx-950/80 to-onyx-950 backdrop-blur-xl shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? "w-[4.25rem] xl:w-[4.5rem]" : "w-64 xl:w-72"
        }`}
      >
        <div className={`${collapsed ? "p-3 flex flex-col items-center gap-2" : "p-4 pr-3"} border-b border-white/[0.04]`}>
          {collapsed ? (
            <>
              <Link href="/reseller/dashboard" className="flex justify-center rounded-xl p-1 hover:bg-white/5 transition-colors" title="SSDomada · Reseller">
                <Image src="/images/SSDomada.png" alt="SSDomada" width={36} height={36} className="rounded-lg" />
              </Link>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-gold hover:bg-gold-10 border border-gold-20/50 transition-colors"
                aria-expanded={false}
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-5 h-5" strokeWidth={2} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/reseller/dashboard" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 -m-1 hover:bg-white/5 transition-colors">
                <div className="relative">
                  <Image src="/images/SSDomada.png" alt="" width={40} height={40} className="rounded-lg shrink-0" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-onyx-950 gold-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-gradient text-sm leading-tight">SSDomada</div>
                  <div className="text-[10px] text-onyx-500 uppercase tracking-wider">Reseller console</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-onyx-400 hover:text-gold hover:bg-gold-10 border border-transparent hover:border-gold-20/40 transition-all"
                aria-expanded
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-x-hidden overflow-y-auto p-2 pt-3 custom-scrollbar">
          <NavLinks collapsed={collapsed} />
        </nav>
        <div className="p-2 border-t border-white/[0.04]">
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Sign out" : undefined}
            className={`group flex w-full items-center rounded-xl text-sm font-medium text-onyx-400 hover:bg-red-500/10 hover:text-red-300 transition-colors ${
              collapsed ? "justify-center py-2.5 mx-auto w-11" : "gap-3 px-3 py-2.5"
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0 group-hover:text-red-400 transition-colors" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="lg:hidden flex shrink-0 items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-onyx-900/90 backdrop-blur-xl z-40">
          <Link href="/reseller/dashboard" className="flex items-center gap-2">
            <Image src="/images/SSDomada.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-gradient text-sm">Reseller</span>
          </Link>
          <button type="button" onClick={() => setOpen(!open)} className="p-2 text-gold hover:bg-gold-10 rounded-lg transition-colors" aria-label="Menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>
        {open && (
          <div className="lg:hidden fixed inset-0 top-[52px] z-30 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <div className="border-b border-white/[0.06] bg-onyx-900/95 backdrop-blur-xl px-4 py-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <NavLinks collapsed={false} onNavigate={() => setOpen(false)} />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
                className="flex items-center gap-3 py-3 text-red-300 w-full text-left text-sm font-medium mt-2 border-t border-white/10"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
        {impersonationBar && (
          <div className="shrink-0 border-b border-amber-500/35 bg-amber-500/15 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-sm text-amber-100 min-w-0">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
              <span className="leading-snug">
                You are signed in with this reseller&apos;s session for support. Use <strong className="text-white">Return to admin</strong> to restore your
                super-admin session.
              </span>
            </div>
            <button
              type="button"
              onClick={() => exitImpersonation()}
              className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 border border-white/15"
            >
              Return to admin
            </button>
          </div>
        )}
        {notices.length > 0 && (
          <div className="shrink-0 space-y-2 border-b border-gold-20/30 bg-gold-5/10 px-3 py-3">
            {notices.map((n) => (
              <div
                key={n.id}
                className="flex gap-3 rounded-xl border border-gold-20/40 bg-onyx-950/60 p-3 text-sm text-onyx-200"
              >
                <Megaphone className="w-4 h-4 shrink-0 text-gold mt-0.5" />
                <div className="min-w-0 flex-1">
                  {n.title ? <div className="font-bold text-gold mb-0.5">{n.title}</div> : null}
                  <p className="whitespace-pre-wrap text-onyx-200 leading-relaxed">{n.body}</p>
                  <div className="mt-1 text-[10px] text-onyx-500 uppercase tracking-wider">
                    From SSDomada admin · {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void dismissNotice(n.id)}
                  className="shrink-0 self-start rounded-lg p-1.5 text-onyx-400 hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss notice"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 md:p-8 custom-scrollbar page-enter">{children}</main>
      </div>
    </div>
  );
}

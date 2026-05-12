"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { setStoredToken, fetchSession, redirectAfterAuth } from "@/lib/auth-client";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await fetchSession();
      if (cancelled) return;
      if (!u) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (u.role !== "END_USER") {
        router.replace(redirectAfterAuth(u));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function logout() {
    await fetch("/api/v1/auth", { method: "DELETE", credentials: "include" });
    setStoredToken(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-onyx-950 text-white flex flex-col">
      <header className="border-b border-gold-10 bg-onyx-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/customer/dashboard" className="flex items-center gap-3">
            <Image src="/images/SSDomada.png" alt="" width={40} height={40} className="rounded-lg" />
            <div>
              <div className="font-extrabold text-gradient text-sm">SSDomada</div>
              <div className="text-[10px] text-onyx-500 uppercase tracking-wider">My account</div>
            </div>
          </Link>
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href="/customer/dashboard"
              className={`flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname === "/customer/dashboard" ? "bg-gold-10 text-gold" : "text-onyx-300 hover:text-white"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-2 text-sm text-onyx-400 hover:text-red-300 px-3 py-2"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
          <button type="button" className="sm:hidden p-2 text-gold" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {open && (
          <div className="sm:hidden border-t border-white/5 px-4 py-3 space-y-2">
            <Link href="/customer/dashboard" onClick={() => setOpen(false)} className="block py-2 text-onyx-200">
              Dashboard
            </Link>
            <button type="button" onClick={() => { setOpen(false); void logout(); }} className="block py-2 text-red-300 w-full text-left">
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">{children}</main>
    </div>
  );
}

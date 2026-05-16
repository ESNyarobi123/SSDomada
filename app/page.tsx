"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Wifi,
  Shield,
  Zap,
  Users,
  CreditCard,
  BarChart3,
  Monitor,
  Clock,
  ArrowRight,
  CheckCircle2,
  Star,
  ChevronDown,
  ChevronRight,
  Globe,
  Smartphone,
  Radio,
  Settings,
  TrendingUp,
  DollarSign,
  Headphones,
  Mail,
  MapPin,
  Phone,
  Play,
  Sparkles,
  BadgeCheck,
  Repeat,
  Lock,
  Activity,
  Layers,
  Wallet,
  Eye,
  FileText,
  Loader2,
  Router,
  Send,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  LandingLocaleProvider,
  LandingLanguageSwitch,
  useLandingLocale,
} from "@/components/landing-locale";
import { useLandingPageConfig } from "@/components/landing/LandingPageSettingsProvider";
import {
  enabledFooterLinks,
  enabledSocialLinks,
  pickLocalized,
  SOCIAL_PLATFORM_LABELS,
} from "@/lib/landing-page-settings";
import { OmadaHardwareCarousel } from "@/components/landing/OmadaHardwareCarousel";
import {
  formatPlatformPlanPrice,
  platformPlanFeatureRows,
  type PublicResellerPlan,
} from "@/lib/reseller-plan-features";

// ============================================================
// SCROLL ANIMATION HOOK
// ============================================================
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

// ============================================================
// ANIMATED COUNTER
// ============================================================
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useInView();
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const duration = 2000;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isVisible, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ============================================================
// NAVBAR
// ============================================================
function Navbar() {
  const { t: tBase } = useLandingLocale();
  const { t, config } = useLandingPageConfig();
  const brandName = config?.brand.name ?? "SSDomada";
  const brandLogo = config?.brand.logoUrl || "/images/SSDomada.png";
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const navLinkClass =
    "relative rounded-xl px-3 py-2 text-sm font-medium text-onyx-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap";
  const navLinkActiveHover =
    "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:w-0 after:bg-gold after:transition-all hover:after:w-2/3";

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-onyx-950/95 backdrop-blur-2xl shadow-lg shadow-black/40"
          : "bg-onyx-950/50 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 md:gap-3.5 group shrink-0 min-w-0">
          <div className="relative shrink-0">
            {brandLogo.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogo}
                alt={brandName}
                width={64}
                height={64}
                className="rounded-2xl w-12 h-12 md:w-14 md:h-14 object-cover transition-transform group-hover:scale-105 ring-1 ring-white/10"
              />
            ) : (
              <Image
                src={brandLogo}
                alt={brandName}
                width={64}
                height={64}
                className="rounded-2xl w-12 h-12 md:w-14 md:h-14 transition-transform group-hover:scale-105 ring-1 ring-white/10"
              />
            )}
            <div className="absolute inset-0 rounded-2xl bg-gold-20 opacity-0 group-hover:opacity-100 transition-opacity blur-md scale-110 pointer-events-none" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xl md:text-2xl font-extrabold text-gradient tracking-tight leading-tight truncate">{brandName}</span>
            <span className="text-[10px] md:text-[11px] font-semibold uppercase tracking-widest text-onyx-500 hidden sm:block">
              {tBase.nav.tagline}
            </span>
          </div>
        </Link>

        {/* Desktop: sections (anchors) vs full pages */}
        <div className="hidden lg:flex flex-1 justify-center min-w-0 px-2">
          <div className="flex items-center gap-2 xl:gap-3 max-w-4xl">
            <span className="sr-only">{t.nav.sectionsLabel}</span>
            <div className="flex items-center gap-0.5 rounded-2xl border border-white/10 bg-onyx-900/70 backdrop-blur-xl p-1 shadow-inner shadow-black/30 overflow-x-auto max-w-[min(100%,52rem)] [scrollbar-width:thin]">
              {t.nav.sectionLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`${navLinkClass} ${navLinkActiveHover}`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <LandingLanguageSwitch />
          <div className="hidden lg:flex items-center gap-2 xl:gap-3">
            <Link
              href="/login"
              className="px-6 py-2.5 text-sm font-bold text-onyx-950 bg-gold hover:bg-gold-400 rounded-full transition-all hover:shadow-lg hover:shadow-gold-20 hover:scale-[1.02] active:scale-[0.98]"
            >
              {t.nav.getStarted}
            </Link>
          </div>
          <button
            type="button"
            className="lg:hidden text-white p-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <div className="space-y-2 w-7">
              <span className={`block w-7 h-0.5 bg-gold transition-all ${menuOpen ? "rotate-45 translate-y-2.5" : ""}`} />
              <span className={`block w-7 h-0.5 bg-gold transition-all ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block w-7 h-0.5 bg-gold transition-all ${menuOpen ? "-rotate-45 -translate-y-2.5" : ""}`} />
            </div>
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="lg:hidden bg-onyx-950/95 backdrop-blur-xl border-t border-gold-10 px-4 sm:px-6 py-5 max-h-[min(85vh,32rem)] overflow-y-auto shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-onyx-500 mb-2">{t.nav.sectionsLabel}</p>
          <div className="space-y-1">
            {t.nav.sectionLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block rounded-xl px-3 py-2.5 text-onyx-100 hover:text-gold hover:bg-white/5 text-base font-medium"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="border-t border-white/10 mt-4 pt-4">
            <Link
              href="/login"
              className="block text-center py-3.5 text-base bg-gold text-onyx-950 rounded-full font-bold"
              onClick={() => setMenuOpen(false)}
            >
              {t.nav.getStarted}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ============================================================
// HERO SECTION
// ============================================================
function HeroSection() {
  const { t } = useLandingPageConfig();
  const [live, setLive] = useState<{
    activeResellers: number;
    liveWifiPackages: number;
    activeWifiSubscriptions: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/public/platform-stats")
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: typeof live }) => {
        if (!cancelled && j?.success && j.data) setLive(j.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    {
      key: `resellers-${live?.activeResellers ?? "fallback"}`,
      value: live ? Math.max(live.activeResellers, 1) : 500,
      suffix: "+",
      label: t.hero.stats[0].label,
      icon: Users,
    },
    {
      key: `wifi-${live?.activeWifiSubscriptions ?? "fallback"}`,
      value: live ? Math.max(live.activeWifiSubscriptions, 1) : 10000,
      suffix: "+",
      label: t.hero.stats[1].label,
      icon: Wifi,
    },
    {
      key: "uptime",
      value: 99,
      suffix: ".9%",
      label: t.hero.stats[2].label,
      icon: Activity,
    },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated bg */}
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,215,0,0.04) 0%, transparent 70%)" }} />
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(53,56,57,0.3) 0%, transparent 70%)" }} />

      {/* ── 3D Floating Elements ── */}

      {/* Morphing gold blob — left */}
      <div className="absolute top-1/4 -left-20 w-[300px] h-[300px] animate-morph opacity-20" style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,215,0,0.05))", filter: "blur(40px)" }} />

      {/* Morphing gold blob — right */}
      <div className="absolute bottom-1/4 -right-20 w-[250px] h-[250px] animate-morph opacity-15" style={{ background: "linear-gradient(225deg, rgba(255,215,0,0.25), rgba(255,215,0,0.03))", filter: "blur(40px)", animationDelay: "4s" }} />

      {/* 3D Rotating cube — top right */}
      <div className="absolute top-20 right-[10%] perspective-2000 hidden lg:block">
        <div className="w-24 h-24 preserve-3d animate-rotate-3d" style={{ animationDuration: "25s" }}>
          <div className="absolute w-24 h-24 face-front rounded-2xl border border-gold-20/30 bg-gold-5/20 backdrop-blur-sm" />
          <div className="absolute w-24 h-24 face-back rounded-2xl border border-gold-20/30 bg-gold-5/10" />
          <div className="absolute w-24 h-24 face-right rounded-2xl border border-gold-20/30 bg-gold-5/15 backdrop-blur-sm" />
          <div className="absolute w-24 h-24 face-left rounded-2xl border border-gold-20/30 bg-gold-5/10" />
          <div className="absolute w-24 h-24 face-top rounded-2xl border border-gold-20/30 bg-gold-5/20 backdrop-blur-sm" />
          <div className="absolute w-24 h-24 face-bottom rounded-2xl border border-gold-20/30 bg-gold-5/10" />
        </div>
      </div>

      {/* 3D Orbiting ring — bottom left */}
      <div className="absolute bottom-32 left-[8%] perspective-1500 hidden lg:block">
        <div className="w-32 h-32 preserve-3d animate-orbit" style={{ animationDuration: "15s" }}>
          <div className="absolute w-32 h-32 rounded-full border-2 border-gold-20/40" style={{ transform: "rotateX(65deg)" }} />
          <div className="absolute w-32 h-32 rounded-full border border-gold-10/20" style={{ transform: "rotateX(65deg) rotateZ(60deg)" }} />
          <div className="absolute w-32 h-32 rounded-full border border-gold-10/20" style={{ transform: "rotateX(65deg) rotateZ(120deg)" }} />
          {/* Orbiting dot */}
          <div className="absolute w-3 h-3 rounded-full bg-gold animate-glow-3d" style={{ top: "0%", left: "50%", transform: "translateX(-50%)" }} />
        </div>
      </div>

      {/* Floating 3D sphere — mid right */}
      <div className="absolute top-[45%] right-[5%] hidden lg:block animate-float-3d">
        <div className="w-16 h-16 rounded-full animate-glow-3d" style={{ background: "radial-gradient(circle at 35% 35%, rgba(255,215,0,0.3), rgba(255,215,0,0.05) 60%, transparent 80%)" }} />
      </div>

      {/* Small floating 3D diamond — top left */}
      <div className="absolute top-[30%] left-[5%] hidden lg:block animate-float-3d" style={{ animationDelay: "2s" }}>
        <div className="w-8 h-8 animate-spin-y" style={{ animationDuration: "12s" }}>
          <div className="w-8 h-8 border border-gold-20/30 bg-gold-5/20 backdrop-blur-sm" style={{ transform: "rotate(45deg)", borderRadius: "4px" }} />
        </div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-gold" style={{
            width: Math.random() * 3 + 1 + "px",
            height: Math.random() * 3 + 1 + "px",
            left: Math.random() * 100 + "%",
            top: Math.random() * 100 + "%",
            opacity: Math.random() * 0.4 + 0.1,
            animation: `float ${Math.random() * 6 + 4}s ease-in-out ${Math.random() * 3}s infinite`,
          }} />
        ))}
      </div>
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(255,215,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.5) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 text-center pt-28 md:pt-32 pb-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-gold-30 bg-gold-5 text-gold text-sm font-medium mb-8 backdrop-blur-sm glass-3d">
          <Sparkles className="w-4 h-4" />
          <span>{t.hero.poweredBy}</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black leading-[1.05] mb-8 tracking-tight">
          <span className="block text-white">{t.hero.h1[0]}</span>
          <span className="block text-white">{t.hero.h1[1]}</span>
          <span className="block text-gradient">{t.hero.h1[2]}</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-onyx-300 max-w-2xl mx-auto mb-12 leading-relaxed">
          {t.hero.sub}
          <br className="hidden md:block" />
          <span className="text-gold">{t.hero.subHighlight}</span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-20">
          <Link href="/login" className="group relative px-10 py-5 bg-gold hover:bg-gold-400 text-onyx-950 font-bold rounded-2xl text-lg transition-all hover:shadow-2xl hover:shadow-gold-30 hover:scale-105 active:scale-95 flex items-center gap-3">
            <span>{t.hero.ctaPrimary}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 rounded-2xl bg-gold opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
          </Link>
          <a href="#demo" className="group px-10 py-5 border-2 border-gold-30 text-gold hover:bg-gold-10 hover:border-gold-50 font-semibold rounded-2xl text-lg transition-all flex items-center gap-3 backdrop-blur-sm glass-3d">
            <Play className="w-5 h-5" />
            <span>{t.hero.ctaSecondary}</span>
          </a>
        </div>

        {/* Stats — glassmorphism 3D cards */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto perspective-1000">
          {stats.map((stat) => (
            <div
              key={stat.key}
              className="group p-5 rounded-2xl glass-3d tilt-card hover:scale-[1.03] transition-all duration-300"
            >
              <stat.icon className="w-5 h-5 text-gold mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-2xl md:text-3xl font-black text-gold">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs text-onyx-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <span className="text-xs text-onyx-500 uppercase tracking-widest">{t.hero.scroll}</span>
        <div className="w-6 h-10 rounded-full border-2 border-gold-30 flex items-start justify-center p-1.5">
          <div className="w-1.5 h-2.5 bg-gold rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}

// ============================================================
// BENEFITS / WHY US — Bento Grid
// ============================================================
function BenefitsSection() {
  const { t } = useLandingLocale();
  const { ref, isVisible } = useInView();
  const benefits = t.benefits.items.map((b, i) => ({
    ...b,
    icon: [Clock, TrendingUp, Monitor, Globe, DollarSign, Shield][i],
    accent: "from-gold-10 to-transparent",
  }));

  return (
    <section id="benefits" className="py-32 relative scroll-mt-24 md:scroll-mt-28" ref={ref}>
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className={`text-center mb-20 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-30 bg-gold-5 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" /> {t.benefits.badge}
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5">
            {t.benefits.title} <span className="text-gradient">{t.benefits.titleGrad}</span>
          </h2>
          <p className="text-onyx-300 max-w-xl mx-auto text-lg">{t.benefits.sub}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 perspective-1000">
          {benefits.map((b, i) => (
            <div key={b.title} className={`group relative p-7 rounded-3xl glass-3d tilt-card transition-all duration-500 hover:scale-[1.02] ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-14 h-14 rounded-2xl bg-gold-10 flex items-center justify-center mb-5 group-hover:bg-gold-20 group-hover:scale-110 transition-all duration-300 animate-glow-3d">
                <b.icon className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-gold transition-colors">{b.title}</h3>
              <p className="text-onyx-300 leading-relaxed">{b.desc}</p>
              <div className="mt-5 flex items-center gap-1.5 text-gold text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                <span>{t.benefits.learnMore}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// HOW IT WORKS — Timeline
// ============================================================
function HowItWorksSection() {
  const { t } = useLandingLocale();
  const { ref, isVisible } = useInView();
  const stepIcons = [Users, CreditCard, Router, Globe, Send, Wallet];
  const steps = t.howItWorks.steps.map((s, i) => ({
    ...s,
    icon: stepIcons[i] ?? Users,
  }));

  return (
    <section id="how-it-works" className="py-32 relative scroll-mt-24 md:scroll-mt-28" ref={ref}>
      <div className="absolute inset-0 bg-onyx-950" />
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(rgba(255,215,0,0.5) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <div className={`text-center mb-20 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-30 bg-gold-5 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
            <Repeat className="w-3.5 h-3.5" /> {t.howItWorks.badge}
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5">
            {t.howItWorks.title} <span className="text-gradient">{t.howItWorks.titleGrad}</span>
          </h2>
          <p className="text-onyx-300 max-w-xl mx-auto text-lg">{t.howItWorks.sub}</p>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-gold-30 via-gold-10 to-transparent" />

          {steps.map((s, i) => (
            <div key={s.num} className={`relative flex items-start gap-8 mb-16 last:mb-0 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 200}ms` }}>
              {/* Timeline dot */}
              <div className="absolute left-8 md:left-1/2 -translate-x-1/2 z-10">
                <div className="w-16 h-16 rounded-full bg-onyx-950 border-2 border-gold flex items-center justify-center shadow-lg shadow-gold-10">
                  <s.icon className="w-7 h-7 text-gold" />
                </div>
              </div>

              {/* Content - alternate sides on desktop */}
              <div className={`ml-24 md:ml-0 md:w-1/2 ${i % 2 === 0 ? "md:pr-16 md:text-right" : "md:pl-16 md:ml-auto"}`}>
                <div className="p-6 rounded-2xl glass-3d tilt-card transition-all duration-300 hover:scale-[1.02]">
                  <span className="text-5xl font-black text-gold-20-op">{s.num}</span>
                  <h3 className="text-xl font-bold mt-2 mb-3 text-white">{s.title}</h3>
                  <p className="text-onyx-300 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FEATURES — Showcase Grid
// ============================================================
function FeaturesSection() {
  const { t } = useLandingLocale();
  const { ref, isVisible } = useInView();
  const icons = [Globe, Smartphone, CreditCard, Settings, Eye, Clock, BarChart3, Wallet];
  const features = t.features.items.map((f, i) => ({ ...f, icon: icons[i] }));

  return (
    <section id="features" className="py-32 relative scroll-mt-24 md:scroll-mt-28" ref={ref}>
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className={`text-center mb-20 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-30 bg-gold-5 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
            <Layers className="w-3.5 h-3.5" /> {t.features.badge}
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5">
            {t.features.title} <span className="text-gradient">{t.features.titleGrad}</span>
          </h2>
          <p className="text-onyx-300 max-w-xl mx-auto text-lg">{t.features.sub}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 perspective-1000">
          {features.map((f, i) => (
            <div key={f.title} className={`group relative p-7 rounded-3xl glass-3d tilt-card transition-all duration-500 hover:scale-[1.03] ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gold-10 flex items-center justify-center group-hover:bg-gold-20 group-hover:scale-110 transition-all duration-300">
                  <f.icon className="w-6 h-6 text-gold" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold bg-gold-10 px-2.5 py-1 rounded-full">{f.tag}</span>
              </div>
              <h3 className="text-lg font-bold mb-2 text-white group-hover:text-gold transition-colors">{f.title}</h3>
              <p className="text-onyx-300 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// PRICING — live plans from GET /api/v1/plans (same source as /pricing)
// ============================================================
function planIntervalSuffix(interval: string) {
  if (interval === "MONTHLY") return "/mo";
  if (interval === "YEARLY") return "/yr";
  return "";
}

function planCardIcon(p: PublicResellerPlan) {
  if (p.price <= 0) return Zap;
  if (p.isFeatured) return BadgeCheck;
  return Lock;
}

function PricingSection() {
  const { t } = useLandingLocale();
  const { ref, isVisible } = useInView();
  const [plans, setPlans] = useState<PublicResellerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/plans")
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: PublicResellerPlan[] }) => {
        if (cancelled) return;
        if (j?.success && Array.isArray(j.data)) {
          setPlans(j.data);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ctaFor = (p: PublicResellerPlan) => (p.price <= 0 ? t.pricing.ctaFree : t.pricing.ctaPaid);
  const gridCols =
    plans.length <= 1
      ? "md:grid-cols-1 max-w-md"
      : plans.length === 2
        ? "md:grid-cols-2 max-w-4xl"
        : "md:grid-cols-3 max-w-6xl";

  return (
    <section id="pricing" className="py-32 relative scroll-mt-24 md:scroll-mt-28" ref={ref}>
      <div className="absolute inset-0 bg-onyx-950" />
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(rgba(255,215,0,0.5) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className={`text-center mb-20 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-30 bg-gold-5 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
            <DollarSign className="w-3.5 h-3.5" /> {t.pricing.badge}
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5">
            {t.pricing.title} <span className="text-gradient">{t.pricing.titleGrad}</span>
          </h2>
          <p className="text-onyx-300 max-w-xl mx-auto text-lg">{t.pricing.sub}</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 text-gold animate-spin" />
            <p className="text-onyx-400 text-sm">{t.pricing.loadingPlans}</p>
          </div>
        ) : loadError || plans.length === 0 ? (
          <p className="text-center text-onyx-400 py-12">{t.pricing.plansLoadError}</p>
        ) : (
          <div className={`grid gap-6 mx-auto items-start perspective-1000 ${gridCols}`}>
            {plans.map((p, i) => {
              const Icon = planCardIcon(p);
              const featured = Boolean(p.isFeatured);
              const priceLabel = formatPlatformPlanPrice(p.price);
              const period = p.price > 0 ? planIntervalSuffix(p.interval) : "";
              const features = platformPlanFeatureRows(p).filter((f) => f.ok);

              return (
            <div key={p.id} className={`relative rounded-3xl tilt-card transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"} ${
              featured
                ? "glass-3d border-2 border-gold-50 shadow-2xl shadow-gold-10 md:scale-110 md:z-10"
                : "glass-3d border border-white/[0.08]"
            }`} style={{ transitionDelay: `${i * 150}ms` }}>
              {featured && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-6 py-2 bg-gold text-onyx-950 text-xs font-black rounded-full shadow-lg shadow-gold-20 uppercase tracking-wider">
                  {t.pricing.mostPopular}
                </div>
              )}
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${featured ? "bg-gold-20" : "bg-gold-10"}`}>
                    <Icon className="w-5 h-5 text-gold" />
                  </div>
                  <h3 className="text-2xl font-black">{p.name}</h3>
                </div>
                {p.description && <p className="text-onyx-400 text-sm mb-6">{p.description}</p>}
                <div className={p.trialDays > 0 ? "mb-2" : "mb-8"}>
                  <span className="text-5xl font-black text-gradient">{priceLabel}</span>
                  {period && <span className="text-onyx-400 text-sm ml-1">{period}</span>}
                </div>
                {p.trialDays > 0 && (
                  <p className="text-xs text-emerald-400 font-semibold mb-6">
                    {t.pricing.trialDays.replace("{days}", String(p.trialDays))}
                  </p>
                )}
                <ul className="space-y-3.5 mb-10">
                  {features.map((f) => (
                    <li key={f.label} className="flex items-center gap-3 text-sm text-onyx-200">
                      <CheckCircle2 className="w-4.5 h-4.5 text-gold flex-shrink-0" />
                      {f.label}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/register?plan=${encodeURIComponent(p.slug)}`}
                  className={`block text-center py-4 rounded-2xl font-bold text-base transition-all hover:scale-[1.02] active:scale-95 ${
                    featured
                      ? "bg-gold hover:bg-gold-400 text-onyx-950 hover:shadow-lg hover:shadow-gold-20"
                      : "border-2 border-gold-30 text-gold hover:bg-gold-10 hover:border-gold-50"
                  }`}
                >
                  {ctaFor(p)}
                </Link>
              </div>
            </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// TESTIMONIALS
// ============================================================
function TestimonialsSection() {
  const { t } = useLandingLocale();
  const { ref, isVisible } = useInView();
  const testimonials = t.testimonials.items;

  return (
    <section id="testimonials" className="py-32 relative scroll-mt-24 md:scroll-mt-28" ref={ref}>
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className={`text-center mb-20 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-30 bg-gold-5 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
            <Star className="w-3.5 h-3.5" /> {t.testimonials.badge}
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5">
            {t.testimonials.title} <span className="text-gradient">{t.testimonials.titleGrad}</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 perspective-1000">
          {testimonials.map((test, i) => (
            <div key={test.name} className={`group relative p-8 rounded-3xl glass-3d tilt-card transition-all duration-500 hover:scale-[1.02] ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 150}ms` }}>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex gap-1 mb-5">
                {Array.from({ length: test.stars }).map((_, j) => (
                  <Star key={j} className="w-5 h-5 fill-gold text-gold" />
                ))}
              </div>
              <p className="text-onyx-200 leading-relaxed mb-8 text-[15px]">&ldquo;{test.text}&rdquo;</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gold-20 flex items-center justify-center text-gold font-black text-lg">
                  {test.name[0]}
                </div>
                <div>
                  <div className="font-bold text-white">{test.name}</div>
                  <div className="text-sm text-onyx-400">{test.role} — {test.location}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// DEMO SECTION
// ============================================================
function DemoSection() {
  const { t } = useLandingLocale();
  const { ref, isVisible } = useInView();
  const pkgs = t.demo.packages;

  return (
    <section id="demo" className="py-32 relative scroll-mt-24 md:scroll-mt-28" ref={ref}>
      <div className="absolute inset-0 bg-onyx-950" />
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-30 bg-gold-5 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
            <Play className="w-3.5 h-3.5" /> {t.demo.badge}
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5">
            {t.demo.title} <span className="text-gradient">{t.demo.titleGrad}</span>
          </h2>
          <p className="text-onyx-300 max-w-xl mx-auto text-lg">{t.demo.sub}</p>
        </div>

        {/* Phone mockup */}
        <div className={`transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}>
          <div className="max-w-sm mx-auto">
            {/* Phone frame */}
            <div className="rounded-[3rem] border-4 border-onyx-800 bg-onyx-900 p-3 shadow-2xl shadow-gold-10">
              {/* Notch */}
              <div className="rounded-[2.5rem] overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
                {/* Status bar */}
                <div className="flex items-center justify-between px-6 py-2 text-[10px] text-white/60">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <Wifi className="w-3 h-3" />
                    <span>100%</span>
                  </div>
                </div>

                {/* Portal content */}
                <div className="px-6 pb-8 pt-4 text-center">
                  <Image src="/images/SSDomada.png" alt="Portal" width={50} height={50} className="mx-auto rounded-xl mb-4" />
                  <h3 className="text-xl font-bold text-white mb-1">{t.demo.portalTitle}</h3>
                  <p className="text-blue-200 text-xs mb-6">{t.demo.portalWelcome}</p>

                  <div className="space-y-2.5">
                    {pkgs.map((pkg) => (
                      <div key={pkg.name} className={`flex items-center justify-between p-3.5 rounded-xl transition-all cursor-pointer ${
                        pkg.featured ? "bg-gold-20 border border-gold-40" : "bg-white/5 border border-white/10 hover:border-gold-30"
                      }`}>
                        <div className="text-left">
                          <div className="text-xs font-semibold text-white">{pkg.name}</div>
                          {pkg.featured && <span className="text-[10px] text-gold font-bold">POPULAR</span>}
                        </div>
                        <div className="text-xs font-bold text-gold">{pkg.price}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-blue-200">{t.demo.payNote}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-onyx-400 text-sm mt-8">{t.demo.footnote}</p>
      </div>
    </section>
  );
}

// ============================================================
// FAQ
// ============================================================
function FAQSection() {
  const { t } = useLandingLocale();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { ref, isVisible } = useInView();
  const faqs = t.faq.items;

  return (
    <section id="faq" className="py-32 relative scroll-mt-24 md:scroll-mt-28" ref={ref}>
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 max-w-3xl mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-30 bg-gold-5 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
            <Shield className="w-3.5 h-3.5" /> {t.faq.badge}
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5">
            {t.faq.title} <span className="text-gradient">{t.faq.titleGrad}</span>
          </h2>
        </div>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className={`rounded-2xl border border-white/5 overflow-hidden transition-all duration-500 hover:border-gold-20 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <button
                type="button"
                className="w-full flex items-center justify-between p-6 text-left group"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="text-base font-semibold text-white pr-6 group-hover:text-gold transition-colors">{faq.q}</span>
                <div className={`w-8 h-8 rounded-full bg-gold-10 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${openIndex === i ? "rotate-180 bg-gold-20" : ""}`}>
                  <ChevronDown className="w-4 h-4 text-gold" />
                </div>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${openIndex === i ? "max-h-96" : "max-h-0"}`}>
                <div className="px-6 pb-6 text-onyx-300 leading-relaxed border-t border-white/5 pt-4">
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CTA SECTION
// ============================================================
function CTASection() {
  const { t, config } = useLandingPageConfig();
  const contactEmail = config?.cta.contactEmail ?? "support@ssdomada.com";
  const brandLogo = config?.brand.logoUrl || "/images/SSDomada.png";
  const brandName = config?.brand.name ?? "SSDomada";
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-onyx-950" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(255,215,0,0.08) 0%, transparent 70%)" }} />
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 rounded-2xl bg-gold-20 blur-3xl scale-200 animate-glow" />
          {brandLogo.startsWith("http") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogo} alt={brandName} width={90} height={90} className="relative rounded-2xl object-cover" />
          ) : (
            <Image src={brandLogo} alt={brandName} width={90} height={90} className="relative rounded-2xl" />
          )}
        </div>
        <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
          {t.cta.title} <span className="text-gradient">{t.cta.titleLine2}</span>
        </h2>
        <p className="text-onyx-300 max-w-xl mx-auto mb-10 text-lg">
          {t.cta.sub}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <a href="#pricing" className="group relative px-10 py-5 bg-gold hover:bg-gold-400 text-onyx-950 font-bold rounded-2xl text-lg transition-all hover:shadow-2xl hover:shadow-gold-30 hover:scale-105 active:scale-95 flex items-center gap-3">
            <span>{t.cta.primary}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <a href={`mailto:${contactEmail}`} className="px-10 py-5 border-2 border-gold-30 text-gold hover:bg-gold-10 hover:border-gold-50 font-semibold rounded-2xl text-lg transition-all flex items-center gap-3">
            <Mail className="w-5 h-5" />
            <span>{t.cta.secondary}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FOOTER
// ============================================================
function Footer() {
  const { locale } = useLandingLocale();
  const { t, config } = useLandingPageConfig();
  const brandName = config?.brand.name ?? "SSDomada";
  const brandLogo = config?.brand.logoUrl || "/images/SSDomada.png";
  const contact = config?.footer.contact;
  const social = config ? enabledSocialLinks(config.footer.social) : [];
  const companyLinks = config ? enabledFooterLinks(config.footer.companyLinks, locale) : [];
  const legalLinks = config ? enabledFooterLinks(config.footer.legalLinks, locale) : [];
  const year = config?.footer.copyrightYear ?? new Date().getFullYear();
  const rights =
    config?.footer.rightsText
      ? pickLocalized(config.footer.rightsText, locale)
      : "All rights reserved.";
  return (
    <footer className="border-t border-gold-10 bg-onyx-950 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              {brandLogo.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogo} alt={brandName} width={40} height={40} className="rounded-xl object-cover" />
              ) : (
                <Image src={brandLogo} alt={brandName} width={40} height={40} className="rounded-xl" />
              )}
              <span className="text-xl font-extrabold text-gradient">{brandName}</span>
            </div>
            <p className="text-onyx-400 text-sm leading-relaxed mb-6">
              {t.footer.blurb}
            </p>
            {social.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {social.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.label}
                    className="w-9 h-9 rounded-lg bg-onyx-800 flex items-center justify-center text-onyx-400 hover:bg-gold-10 hover:text-gold transition-all text-xs font-bold"
                  >
                    {s.label.trim() || SOCIAL_PLATFORM_LABELS[s.platform]}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-bold text-gold mb-5 uppercase tracking-wider">{t.footer.product}</h4>
            <ul className="space-y-3 text-sm text-onyx-400">
              {t.footer.productLinks.map((l) => (
                <li key={l.href + l.label}><a href={l.href} className="hover:text-gold transition-colors hover:pl-1">{l.label}</a></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-bold text-gold mb-5 uppercase tracking-wider">{t.footer.company}</h4>
            <ul className="space-y-3 text-sm text-onyx-400">
              {companyLinks.map((l) => (
                <li key={l.href + l.label}>
                  <a href={l.href} className="hover:text-gold transition-colors hover:pl-1">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold text-gold mb-5 uppercase tracking-wider">{t.footer.contact}</h4>
            <ul className="space-y-4 text-sm text-onyx-400">
              {contact?.email && (
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gold-60-op shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:text-gold transition-colors">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact?.phone && (
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gold-60-op shrink-0" />
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-gold transition-colors">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact?.location && (
                <li className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gold-60-op shrink-0" />
                  {pickLocalized(contact.location, locale)}
                </li>
              )}
              {contact?.supportNote && (
                <li className="flex items-center gap-3">
                  <Headphones className="w-4 h-4 text-gold-60-op shrink-0" />
                  {pickLocalized(contact.supportNote, locale)}
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-onyx-500">
            &copy; {year} {brandName}. {rights}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-onyx-500">
            {legalLinks.map((l) => (
              <a key={l.href + l.label} href={l.href} className="hover:text-gold transition-colors">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function HomePage() {
  return (
    <LandingLocaleProvider>
      <main className="overflow-x-hidden">
        <Navbar />
        <HeroSection />
        <section id="hardware" className="scroll-mt-24 md:scroll-mt-28 relative">
          <OmadaHardwareCarousel />
        </section>
        <BenefitsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
        <DemoSection />
        <FAQSection />
        <CTASection />
        <Footer />
      </main>
    </LandingLocaleProvider>
  );
}

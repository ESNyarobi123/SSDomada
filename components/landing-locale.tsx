"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { landingCopy, type LandingCopy, type Locale } from "@/lib/landing-i18n";
import { LandingPageSettingsProvider } from "@/components/landing/LandingPageSettingsProvider";

type LandingContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  /** Base i18n only — prefer `useLandingPageConfig().t` inside the landing page for CMS merges. */
  t: LandingCopy;
};

const LandingLocaleContext = createContext<LandingContextValue | null>(null);

export function LandingLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const t = useMemo(() => landingCopy(locale), [locale]);
  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === "en" ? "sw" : "en"));
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, t, toggleLocale]
  );

  return (
    <LandingLocaleContext.Provider value={value}>
      <LandingPageSettingsProvider>{children}</LandingPageSettingsProvider>
    </LandingLocaleContext.Provider>
  );
}

export function useLandingLocale() {
  const ctx = useContext(LandingLocaleContext);
  if (!ctx) {
    throw new Error("useLandingLocale must be used within LandingLocaleProvider");
  }
  return ctx;
}

export function LandingLanguageSwitch({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLandingLocale();
  return (
    <div
      className={`flex rounded-full border border-gold-30 p-1 bg-onyx-900/80 shrink-0 ${className}`}
      role="group"
      aria-label={t.languageSwitch.aria}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`min-w-[2.75rem] px-4 py-2 text-sm font-bold rounded-full transition-colors ${
          locale === "en"
            ? "bg-gold text-onyx-950 shadow-sm"
            : "text-onyx-300 hover:text-white"
        }`}
      >
        {t.languageSwitch.enShort}
      </button>
      <button
        type="button"
        onClick={() => setLocale("sw")}
        className={`min-w-[2.75rem] px-4 py-2 text-sm font-bold rounded-full transition-colors ${
          locale === "sw"
            ? "bg-gold text-onyx-950 shadow-sm"
            : "text-onyx-300 hover:text-white"
        }`}
      >
        {t.languageSwitch.swShort}
      </button>
    </div>
  );
}

"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { OMADA_HARDWARE_IMAGES } from "@/lib/landing-i18n";
import { useLandingLocale } from "@/components/landing-locale";

const AUTO_MS = 6000;

export function OmadaHardwareCarousel() {
  const { t } = useLandingLocale();
  const slides = t.hardware.slides;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const len = slides.length;

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => (i + dir + len) % len);
    },
    [len]
  );

  useEffect(() => {
    if (paused || len <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % len);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [paused, len]);

  const src = OMADA_HARDWARE_IMAGES[index];

  return (
    <section
      id="hardware"
      className="py-24 md:py-32 relative scroll-mt-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 bg-onyx-950" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,215,0,0.45) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-30 bg-gold-5 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
            {t.hardware.badge}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 tracking-tight">
            <span className="text-white">{t.hardware.title} </span>
            <span className="text-gradient">{t.hardware.titleGrad}</span>
          </h2>
          <p className="text-onyx-300 max-w-2xl mx-auto text-lg leading-relaxed">
            {t.hardware.subtitle}
          </p>
        </div>

        <div className="rounded-[2rem] border border-gold-20 bg-gradient-to-b from-onyx-900/80 to-onyx-950 p-4 md:p-6 shadow-2xl shadow-gold-10 hover-gold-glow transition-shadow duration-500">
          <div className="relative aspect-[4/3] md:aspect-[16/10] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-onyx-800/50 to-onyx-950 ring-1 ring-white/5">
            <Image
              key={src}
              src={src}
              alt={slides[index]?.title ?? "Omada access point"}
              fill
              className="object-contain p-4 md:p-8 transition-opacity duration-500"
              sizes="(max-width: 768px) 100vw, 1152px"
              priority={index === 0}
            />

            <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-onyx-950 via-onyx-950/95 to-transparent pt-16 pb-5 px-5 md:px-8">
              <p className="text-gold text-xs font-bold uppercase tracking-widest mb-1">
                TP-Link Omada
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-white leading-snug mb-2">
                {slides[index]?.title}
              </h3>
              <p className="text-sm md:text-base text-onyx-300 max-w-3xl leading-relaxed">
                {slides[index]?.desc}
              </p>
            </div>

            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 z-30 h-11 w-11 md:h-12 md:w-12 rounded-full border border-gold-30 bg-onyx-950/90 text-gold backdrop-blur-sm flex items-center justify-center hover:bg-gold-10 hover:border-gold-50 transition-all"
              aria-label={t.hardware.prev}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 z-30 h-11 w-11 md:h-12 md:w-12 rounded-full border border-gold-30 bg-onyx-950/90 text-gold backdrop-blur-sm flex items-center justify-center hover:bg-gold-10 hover:border-gold-50 transition-all"
              aria-label={t.hardware.next}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="flex justify-center gap-2 mt-6">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === index ? "w-8 bg-gold" : "w-2 bg-onyx-600 hover:bg-onyx-400"
                }`}
                aria-label={t.hardware.dotLabel(i + 1)}
                aria-current={i === index}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

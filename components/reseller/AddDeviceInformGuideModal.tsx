"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Copy, Check, Router, X, Sparkles } from "lucide-react";
import {
  ADD_DEVICE_INFORM_GUIDE_STEPS,
  CONTROLLER_INFORM_HOST,
  guideImageSrc,
} from "@/lib/add-device-inform-guide";

export function AddDeviceInformGuideModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const steps = ADD_DEVICE_INFORM_GUIDE_STEPS;
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step]!;

  function resetAndClose() {
    setStep(0);
    setConfirmed(false);
    onClose();
  }

  function finish() {
    if (!confirmed) return;
    setStep(0);
    setConfirmed(false);
    onComplete();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-device-guide-title"
    >
      <div className="w-full max-w-2xl max-h-[94vh] flex flex-col rounded-3xl border border-gold-20 bg-gradient-to-b from-onyx-900 via-onyx-950 to-onyx-950 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gold/15 border border-gold/25 flex items-center justify-center shrink-0">
              <Router className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gold mb-1">
                <Sparkles className="w-3 h-3" />
                Kabla ya kuongeza AP
              </div>
              <h2 id="add-device-guide-title" className="text-lg font-black text-white leading-tight">
                Weka Controller Inform URL
              </h2>
              <p className="text-xs text-onyx-400 mt-0.5">
                Hatua {step + 1} ya {steps.length} — lazima AP ijue controller ya SSDomada
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="shrink-0 rounded-xl p-2 text-onyx-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Funga"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center gap-1.5 px-5 py-3">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-gold" : i < step ? "w-3 bg-gold/40" : "w-3 bg-white/10"
              }`}
              aria-label={`Hatua ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-4">
          <h3 className="text-base font-bold text-white mb-1">{current.title}</h3>
          <p className="text-sm text-onyx-300 leading-relaxed mb-4">{current.description}</p>

          {(step === 5 || step === 6) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold-20 bg-gold/5 px-3 py-2.5">
              <span className="text-xs text-onyx-400">Inform URL:</span>
              <code className="text-sm font-mono font-bold text-gold">{CONTROLLER_INFORM_HOST}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(CONTROLLER_INFORM_HOST).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-onyx-200 hover:bg-white/10"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Imenakiliwa" : "Nakili"}
              </button>
            </div>
          )}

          <div className="relative rounded-2xl border border-white/[0.08] bg-onyx-950 overflow-hidden shadow-inner">
            <div className="relative w-full aspect-[16/10] bg-onyx-900">
              <Image
                src={guideImageSrc(current.imagePath)}
                alt={current.title}
                fill
                className="object-contain object-top"
                sizes="(max-width: 768px) 100vw, 672px"
                priority={step === 0}
              />
            </div>
          </div>

          {isLast && (
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 accent-gold"
              />
              <span className="text-sm text-emerald-100 leading-relaxed">
                Nimeweka <strong className="text-white">{CONTROLLER_INFORM_HOST}</strong> kwenye Controller Settings na
                nimebonyeza <strong className="text-white">Save</strong> kwenye AP yangu.
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-white/[0.06] bg-onyx-950/80">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-onyx-300 hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Nyuma
          </button>

          {!isLast ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="inline-flex items-center gap-1 rounded-xl bg-gold px-5 py-2.5 text-sm font-black text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 transition-colors"
            >
              Ifuatayo
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!confirmed}
              onClick={finish}
              className="inline-flex items-center gap-1 rounded-xl bg-gold px-5 py-2.5 text-sm font-black text-onyx-950 shadow-lg shadow-gold/20 hover:bg-gold-400 disabled:opacity-50 transition-colors"
            >
              Nimekamilisha — ongeza device
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

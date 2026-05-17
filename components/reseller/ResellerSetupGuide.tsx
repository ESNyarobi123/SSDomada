"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ArrowRight,
  Send,
  Clock,
  PartyPopper,
  ListChecks,
} from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";
import { SETUP_GUIDE_REFRESH_EVENT, notifySetupGuideRefresh } from "@/lib/reseller-setup-guide-events";
import { SETUP_GUIDE_STEPS, type SetupGuideStepId } from "@/lib/reseller-setup-guide";

type GuidePayload = {
  steps: { id: SetupGuideStepId; number: number; completed: boolean }[];
  completedCount: number;
  totalSteps: number;
  currentStepId: SetupGuideStepId | null;
  prepComplete: boolean;
  portalRequest: { id: string; status: string; createdAt: string } | null;
  adminApproved: boolean;
  dismissed: boolean;
  wizardActive: boolean;
  awaitingAdmin: boolean;
};

function stepMeta(id: SetupGuideStepId) {
  return SETUP_GUIDE_STEPS.find((s) => s.id === id)!;
}

function stepHrefBase(href: string) {
  return href.split("#")[0];
}

export function ResellerSetupGuide({ locale = "en" }: { locale?: "en" | "sw" }) {
  const pathname = usePathname();
  const router = useRouter();
  const onDashboard = pathname === "/reseller/dashboard";
  const [guide, setGuide] = useState<GuidePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const prevGuideRef = useRef<GuidePayload | null>(null);
  const initialModalShownRef = useRef(false);

  const load = useCallback(async () => {
    const r = await resellerJson<{ guide: GuidePayload }>("/api/v1/reseller/onboarding");
    if (r.ok && r.data?.guide) {
      setGuide(r.data.guide);
      return r.data.guide;
    }
    setLoading(false);
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const onRefresh = () => {
      void load();
    };
    window.addEventListener(SETUP_GUIDE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(SETUP_GUIDE_REFRESH_EVENT, onRefresh);
  }, [load]);

  useEffect(() => {
    if (!guide?.wizardActive) return;
    const id = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(id);
  }, [guide?.wizardActive, load]);

  const currentStep = useMemo(() => {
    if (!guide?.currentStepId) return null;
    return stepMeta(guide.currentStepId);
  }, [guide?.currentStepId]);

  const onCurrentStepPage = useMemo(() => {
    if (!currentStep) return false;
    const base = stepHrefBase(currentStep.href);
    return pathname === base || pathname.startsWith(`${base}/`);
  }, [currentStep, pathname]);

  useEffect(() => {
    if (loading || !guide?.wizardActive) {
      if (!guide?.wizardActive) setModalOpen(false);
      return;
    }

    const prev = prevGuideRef.current;
    let shouldOpen = false;

    if (!initialModalShownRef.current) {
      shouldOpen = true;
      initialModalShownRef.current = true;
    } else if (prev) {
      if (guide.completedCount > prev.completedCount) shouldOpen = true;
      if (guide.awaitingAdmin && !prev.awaitingAdmin) shouldOpen = true;
      if (guide.adminApproved && !prev.adminApproved) shouldOpen = true;
      if (guide.currentStepId !== prev.currentStepId && guide.currentStepId != null) {
        shouldOpen = true;
      }
    }

    if (shouldOpen) setModalOpen(true);
    prevGuideRef.current = guide;
  }, [guide, loading]);

  async function dismissGuide() {
    await resellerJson("/api/v1/reseller/onboarding", {
      method: "POST",
      body: JSON.stringify({ action: "dismiss" }),
    });
    await load();
    setModalOpen(false);
  }

  function remindLater() {
    setModalOpen(false);
  }

  async function sendToAdmin() {
    setSending(true);
    setErr(null);
    const r = await resellerJson<{ message?: string }>("/api/v1/reseller/portal-setup-requests", {
      method: "POST",
      body: JSON.stringify({}),
    });
    setSending(false);
    if (!r.ok) {
      setErr(r.error || "Could not send request");
      return;
    }
    notifySetupGuideRefresh();
    setModalOpen(true);
  }

  if (loading || !guide?.wizardActive) return null;

  const sw = locale === "sw";

  return (
    <>
      {onDashboard && (
        <section className="rounded-2xl border border-gold-25 bg-gradient-to-br from-gold-5/40 via-onyx-900/80 to-onyx-950 p-5 md:p-6 shadow-lg shadow-gold/5 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-15">
                <ListChecks className="h-6 w-6 text-gold" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  {sw ? "Mwongozo wa kuanzisha WiFi yako" : "Get your WiFi live"}
                </h2>
                <p className="text-sm text-onyx-400 mt-0.5 max-w-xl">
                  {sw
                    ? `Hatua ${guide.completedCount} kati ya ${guide.totalSteps} — fuata mpangilio huu kabla ya kupokea malipo ya wageni.`
                    : `Step ${guide.completedCount} of ${guide.totalSteps} — follow this order before you start earning from guests.`}
                </p>
              </div>
            </div>
            <div className="text-sm font-bold text-gold whitespace-nowrap">
              {Math.round((guide.completedCount / guide.totalSteps) * 100)}%
            </div>
          </div>
          <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SETUP_GUIDE_STEPS.map((step) => {
              const st = guide.steps.find((s) => s.id === step.id);
              const done = st?.completed ?? false;
              const current = guide.currentStepId === step.id;
              return (
                <li
                  key={step.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                    current
                      ? "border-gold-40 bg-gold-10/30"
                      : done
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className={`h-5 w-5 shrink-0 ${current ? "text-gold" : "text-onyx-500"}`} />
                  )}
                  <div className="min-w-0">
                    <span className={`font-semibold ${done ? "text-onyx-400 line-through" : "text-white"}`}>
                      {sw ? step.titleSw : step.titleEn}
                    </span>
                    {current && !done && (
                      <Link
                        href={step.href}
                        className="mt-1 block text-xs font-semibold text-gold hover:underline"
                      >
                        {sw ? step.actionSw : step.actionEn} →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-gold-20 bg-onyx-950 shadow-2xl p-6 md:p-8"
          >
            {guide.adminApproved ? (
              <>
                <PartyPopper className="h-10 w-10 text-gold mb-4" />
                <h3 className="text-2xl font-black text-white mb-2">
                  {sw ? "Mfumo uko tayari!" : "You're all set!"}
                </h3>
                <p className="text-onyx-300 text-sm leading-relaxed mb-6">
                  {sw
                    ? "Admin amethibitisha usanidi wa controller. Wageni wanaweza kuunganisha na kulipa kupitia portal yako."
                    : "An admin verified your controller setup. Guests can connect and pay through your portal."}
                </p>
                <button
                  type="button"
                  onClick={() => void dismissGuide()}
                  className="w-full rounded-xl bg-gold py-3.5 font-bold text-onyx-950 hover:bg-gold-400"
                >
                  {sw ? "Anza kutumia dashibodi" : "Start using the dashboard"}
                </button>
              </>
            ) : guide.awaitingAdmin ? (
              <>
                <Clock className="h-10 w-10 text-gold mb-4" />
                <h3 className="text-2xl font-black text-white mb-2">
                  {sw ? "Inasubiri admin" : "Waiting for admin"}
                </h3>
                <p className="text-onyx-300 text-sm leading-relaxed mb-6">
                  {sw
                    ? "Umewasilisha maombi ya usanidi. Timu itaweka external portal kwenye Omada yako."
                    : "Your setup request was sent. Our team will configure the external portal on your Omada controller."}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={remindLater}
                    className="w-full rounded-xl border border-gold-30 py-3 font-semibold text-gold hover:bg-gold-10"
                  >
                    {sw ? "Nimeelewa" : "Got it"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void dismissGuide()}
                    className="text-xs text-onyx-500 hover:text-onyx-300"
                  >
                    {sw ? "Usionyeshe tena" : "Don't show again"}
                  </button>
                </div>
              </>
            ) : currentStep ? (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-gold mb-2">
                  {sw
                    ? `Hatua ${currentStep.number} / ${guide.totalSteps}`
                    : `Step ${currentStep.number} of ${guide.totalSteps}`}
                </p>
                <h3 className="text-2xl font-black text-white mb-2">
                  {sw ? currentStep.titleSw : currentStep.titleEn}
                </h3>
                <p className="text-onyx-300 text-sm leading-relaxed mb-6">
                  {sw ? currentStep.descSw : currentStep.descEn}
                </p>
                {err && <p className="text-sm text-red-300 mb-3">{err}</p>}
                <div className="flex flex-col gap-2">
                  {currentStep.id === "admin_push" ? (
                    <button
                      type="button"
                      disabled={sending || !guide.prepComplete}
                      onClick={() => void sendToAdmin()}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold py-3.5 font-bold text-onyx-950 hover:bg-gold-400 disabled:opacity-50"
                    >
                      {sending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                      {sw ? currentStep.actionSw : currentStep.actionEn}
                    </button>
                  ) : onCurrentStepPage ? (
                    <button
                      type="button"
                      onClick={remindLater}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold py-3.5 font-bold text-onyx-950 hover:bg-gold-400"
                    >
                      {sw ? "Endelea hapa" : "Continue here"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(currentStep.href);
                        setModalOpen(false);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold py-3.5 font-bold text-onyx-950 hover:bg-gold-400"
                    >
                      {sw ? currentStep.actionSw : currentStep.actionEn}
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  )}
                  {currentStep.id === "admin_push" && !guide.prepComplete && (
                    <p className="text-xs text-amber-200/90 text-center">
                      {sw ? "Maliza hatua 1–5 kwanza." : "Complete steps 1–5 before sending to admin."}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={remindLater}
                    className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-onyx-400 hover:text-white"
                  >
                    {sw ? "Baadaye" : "Remind me later"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

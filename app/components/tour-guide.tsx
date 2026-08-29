"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface TourStep {
  title: string;
  description: string;
  icon: string;
  tip?: string;
  highlight?: string;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to Content Creator Studio",
    description:
      "Your professional workspace for research-driven content — from idea to publication in one streamlined flow. This 60-second tour will show you how to create polished, SEO-ready articles in English.",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    highlight: "Built on Next.js 16 · OpenRouter AI · Research + Outline + Writing + SEO",
  },
  {
    title: "1. Start a New Article",
    description:
      "Enter a clear Topic (e.g., 'AI in Healthcare 2024'), add comma-separated Keywords for SEO, pick a Style and Length, then choose your Generation Mode.",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    tip: "Tip: The topic field suggests AI-generated keywords automatically when you finish typing. Click a suggestion or your recent keywords to fill them in.",
  },
  {
    title: "2. Choose Your Generation Mode",
    description:
      "Lite is fast and low-cost — ideal for quick drafts. DeepAgent runs the full agent framework with memory, richer research, and iterative refinement.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    highlight: "Lite = speed · DeepAgent = depth",
  },
  {
    title: "3. Track the Workflow",
    description:
      "Follow the Workflow card on the left: Research → Outline → Writing → Review → Refine. Each step lights up as it runs and shows token usage when complete.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    tip: "You can stop generation anytime with the Stop button — useful if you want to revise the prompt.",
  },
  {
    title: "4. Review & Edit the Outline",
    description:
      "Before writing, you'll get an interactive outline. Click any heading or bullet to edit, add new points, then Confirm & Start Writing. Need a different angle? Regenerate, or Skip to write directly.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    highlight: "Outline gives you control over structure and estimated word count.",
  },
  {
    title: "5. Edit, Refine & Version",
    description:
      "The markdown editor shows live content as it streams. Use the Refine bar below to give instructions ('expand the intro', 'make it more persuasive'). Choose Full article or Section mode to target specific parts.",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    tip: "Copy, Focus Mode, and Version History (v1, v2…) live in the editor toolbar. Focus Mode is perfect for reading and presenting.",
  },
  {
    title: "6. Export & Article Insights",
    description:
      "Export in one click — Markdown, HTML, Plain Text, or .md download. The Article Stats panel shows word count, reading time, and a clickable outline to jump through the document.",
    icon: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    title: "7. SEO Optimization",
    description:
      "Run Analyze SEO to get an instant score: keyword density, readability, heading structure, and actionable suggestions. Iteratively refine and re-analyze to perfect your ranking potential.",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    highlight: "Aim for 800+ words, 3+ H2 headings, and 1–4% keyword density for best results.",
  },
  {
    title: "8. History & Auto-Save",
    description:
      "Everything is auto-saved and versioned. The Article History panel lets you reload past articles and restore earlier versions. Your writing preferences (style, length, recent topics) persist across sessions.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    tip: "History requires deployment to EdgeOne Makers for persistence. Locally it works in-memory.",
  },
  {
    title: "You're All Set — Start Creating!",
    description:
      "Be specific with your topic, include 3–5 targeted keywords, and use Refine to polish iteratively. Try DeepAgent for your best articles and Lite for quick experiments.",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    highlight: "Pro tip: Write in English only — the workspace is optimized for English output via OpenRouter (gpt-4o-mini).",
  },
];

const STORAGE_KEY = "cc-studio-tour-completed-v2";

export function TourGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    } else {
      setCompleted(true);
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setCompleted(true);
    setOpen(false);
  }, []);

  const reopen = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else complete();
  }, [step, complete]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, []);

  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, close]);

  if (!mounted) return null;

  return (
    <>
      {/* Header / floating trigger */}
      <button
        onClick={reopen}
        aria-label="Open tour guide"
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:bg-brand-900/30 transition-colors"
        title="Take the quick tour"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Tour
        {!completed && <span className="inline-flex h-2 w-2 rounded-full bg-brand-500 animate-pulse" aria-hidden />}
      </button>

      {/* Overlay */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={close}
              aria-hidden
            />

            {/* Card */}
            <div className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 animate-in zoom-in-95 fade-in duration-200">
              {/* Progress bar */}
              <div className="h-1 w-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full bg-brand-600 transition-all duration-400 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Header accent */}
              <div className="bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-brand-950/30 dark:via-gray-900 dark:to-blue-950/20 px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={current.icon} />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm border border-brand-100 dark:bg-gray-800 dark:text-brand-300 dark:border-gray-700">
                      {step + 1} / {STEPS.length}
                    </span>
                    <button
                      onClick={close}
                      aria-label="Close tour"
                      className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <h2 className="mt-4 text-lg font-semibold leading-tight text-gray-900 dark:text-gray-50">
                  {current.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {current.description}
                </p>

                {current.highlight && (
                  <div className="mt-3 inline-flex items-start gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2 text-xs leading-relaxed text-brand-700 shadow-sm dark:border-brand-900/50 dark:bg-gray-800/80 dark:text-brand-300">
                    <span className="mt-0.5 text-brand-500">✦</span>
                    <span>{current.highlight}</span>
                  </div>
                )}

                {current.tip && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 border border-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50">
                    <span className="mt-0.5">💡</span>
                    <span>{current.tip}</span>
                  </div>
                )}
              </div>

              {/* Dots */}
              <div className="flex items-center justify-center gap-1.5 px-6 pt-4">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`Go to step ${i + 1}`}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === step
                        ? "w-6 bg-brand-600"
                        : i < step
                          ? "w-1.5 bg-brand-300 dark:bg-brand-700"
                          : "w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300"
                    )}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 px-6 py-5">
                <button
                  onClick={prev}
                  disabled={step === 0}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    step === 0
                      ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  )}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={complete}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
                  >
                    Skip tour
                  </button>
                  <button
                    onClick={next}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:bg-brand-800 transition-colors"
                  >
                    {step === STEPS.length - 1 ? (
                      <>
                        Start Creating
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                      </>
                    ) : (
                      <>
                        Next
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 bg-gray-50 px-6 py-2.5 dark:border-gray-800 dark:bg-gray-900/50">
                <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
                  Use <kbd className="rounded border bg-white px-1 py-0.5 text-[10px] dark:bg-gray-800 dark:border-gray-700">←</kbd>{" "}
                  <kbd className="rounded border bg-white px-1 py-0.5 text-[10px] dark:bg-gray-800 dark:border-gray-700">→</kbd> to navigate ·{" "}
                  <kbd className="rounded border bg-white px-1 py-0.5 text-[10px] dark:bg-gray-800 dark:border-gray-700">Esc</kbd> to close
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

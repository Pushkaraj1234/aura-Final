import React, { useEffect, useRef, useMemo } from "react";
import { X, Calendar, TrendingDown, TrendingUp, Minus, Quote } from "lucide-react";
import type { CheckIn, CheckInAnalysis } from "../types";
import {
  calculateCheckInAnalysis,
  explainFactorPercentages,
} from "../services/recommendationEngine";
import { ScoreFormulaCard } from "./ScoreFormulaCard";

/**
 * One day of the trajectory, opened from the graph.
 *
 * WHY THIS EXISTS
 *
 * The trajectory answers "how have I been?" and then stops. A line with
 * twenty-seven points on it invites exactly one question — *what happened on
 * that day?* — and until now the graph had no answer. The reading was visible
 * and the reasoning behind it was not.
 *
 * WHERE THE ANALYSIS COMES FROM, AND WHY THAT IS SAID OUT LOUD
 *
 * Most stored check-ins carry no saved `analysis`. It is computed at submit
 * time and, for seeded rows and anything written before that path existed,
 * never persisted. So this panel does what participantStore already does when
 * it needs a reading for the latest check-in: uses the saved analysis when
 * there is one, and otherwise recomputes it with `calculateCheckInAnalysis`
 * from the answers given that day.
 *
 * That is a recomputation, not a reconstruction: the analysis depends only on
 * that check-in and the one before it, both of which are stored verbatim. But
 * a person reading their own past deserves to know which of the two they are
 * looking at, so the panel says so rather than presenting both in the same
 * voice.
 *
 * The history passed in is deliberately truncated at this day. A reading
 * labelled "13 September" must not be computed with knowledge of what
 * happened on the 14th.
 */

interface Props {
  checkIn: CheckIn;
  /** The check-in immediately before this one, or null if this is the first. */
  previous: CheckIn | null;
  /** Check-ins up to and including this one. Never later ones. */
  history: CheckIn[];
  /**
   * The score the graph plotted for this point. Passed so the panel can
   * reconcile against it rather than quietly showing a different number.
   */
  chartScore: number;
  /**
   * Who is reading. The arithmetic is identical either way; the sentences are
   * not. A counsellor reading "what you wrote that day" would be reading a
   * screen that thinks it is talking to the survivor.
   */
  voice?: "self" | "counsellor";
  onClose: () => void;
}

/**
 * The same panel, addressed to whoever opened it.
 *
 * Kept as one component rather than two so the breakdown, the recomputation
 * and the provenance rules cannot drift apart between the two surfaces. Only
 * the wording differs.
 */
const COPY = {
  self: {
    eyebrow: "That day’s check-in",
    reported: "What you reported that day",
    wrote: "What you wrote that day",
    recomputed:
      "This reading was worked out again just now, from the answers you gave that day, using the same rules that were used then. Your answers themselves are unchanged.",
    saved: "This is the reading that was saved with this check-in.",
    footer:
      "This is a self-reported wellbeing indicator, not a diagnosis. It describes what you told us on this day and nothing more.",
  },
  counsellor: {
    eyebrow: "Their check-in that day",
    reported: "What they reported that day",
    wrote: "What they wrote that day",
    recomputed:
      "This reading was worked out again just now, from the answers they gave that day, using the same rules that were used then. Their answers themselves are unchanged.",
    saved: "This is the reading that was saved with this check-in.",
    footer:
      "This is a self-reported wellbeing indicator, not a diagnosis. It describes what this person told us on this day and nothing more. A human decision still belongs to you.",
  },
} as const;

const LEVEL_TONE: Record<string, string> = {
  LOW: "bg-[#E8F0EA] text-[#17624A] border-[#CADDD0]",
  MODERATE: "bg-[#FDF4E7] text-[#8A4A20] border-[#EAD9C2]",
  HIGH: "bg-[#FBEDE4] text-[#A14A1C] border-[#EDD2C0]",
  VERY_HIGH: "bg-[#F7E6DF] text-[#9A3412] border-[#E8C7B8]",
};

export const CheckInDayPanel: React.FC<Props> = ({
  checkIn,
  previous,
  history,
  chartScore,
  voice = "self",
  onClose,
}) => {
  const copy = COPY[voice];
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Whether this is the reading saved that day or one worked out again now.
  const wasSaved = Boolean(checkIn.analysis);

  const analysis: CheckInAnalysis = useMemo(
    () => checkIn.analysis || calculateCheckInAnalysis(checkIn, previous, history),
    [checkIn, previous, history]
  );

  const factorFormula = useMemo(() => explainFactorPercentages(checkIn), [checkIn]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      // A dialog that lets focus wander back onto the page behind it is a
      // dialog a keyboard user cannot tell they are inside.
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = priorOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const when = new Date(checkIn.timestamp);
  const dayLabel = when.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLabel = when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const change = analysis.change;
  const ChangeIcon = change === undefined ? Minus : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

  const factors: Array<{ key: keyof typeof factorFormula; label: string; value: number }> = [
    { key: "stress", label: "Stress and pressure", value: analysis.factorPercentages.stress },
    { key: "sleep", label: "Sleep and rest", value: analysis.factorPercentages.sleep },
    {
      key: "emotionalWellbeing",
      label: "Emotional wellbeing",
      value: analysis.factorPercentages.emotionalWellbeing,
    },
    {
      key: "socialConnection",
      label: "Social connection",
      value: analysis.factorPercentages.socialConnection,
    },
  ];

  const reflectionText =
    checkIn.reflection?.transcript?.trim() || checkIn.optionalNote?.trim() || "";

  /**
   * Whether a counsellor may read what the person wrote.
   *
   * A participant can submit a reflection and withhold it from their worker;
   * shareNoteWithWorker and reflection.shareWithWorker both carry that choice.
   * The person themselves always sees their own words. Only an explicit false
   * withholds — an older row with the field absent was written when everything
   * was shared, and silently hiding it would misreport the past in the other
   * direction.
   */
  const withheld =
    voice === "counsellor" &&
    (checkIn.shareNoteWithWorker === false ||
      checkIn.reflection?.shareWithWorker === false);

  const showReflection = Boolean(reflectionText) && !withheld;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#3C3530]/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-panel-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#EFE8E2] shadow-xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-[#EFE8E2] px-5 sm:px-7 py-4 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0 space-y-1">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#68625D]">
              <Calendar size={12} aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <h3 id="day-panel-title" className="text-lg sm:text-xl font-black text-[#3C3530] truncate">
              {dayLabel}
            </h3>
            <p className="text-xs text-[#6B635C]">Recorded at {timeLabel}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close this day's breakdown"
            className="shrink-0 rounded-full p-2 text-[#6B635C] hover:text-[#3C3530] hover:bg-[#FDF9F5] transition-colors cursor-pointer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 sm:px-7 py-5 space-y-6">
          {/* The reading itself */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] px-5 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#68625D]">
                Indicator
              </span>
              <span className="text-3xl font-black text-[#3C3530]">
                {analysis.distressScore}
                <span className="text-xs font-normal text-[#68625D]">/100</span>
              </span>
            </div>
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                LEVEL_TONE[analysis.level] || LEVEL_TONE.MODERATE
              }`}
            >
              {analysis.levelLabel}
            </span>
            {change !== undefined && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#FDF9F5] border border-[#EFE8E2] px-3 py-1.5 text-xs font-bold text-[#5A5049]">
                <ChangeIcon size={13} aria-hidden="true" />
                {change === 0
                  ? "Unchanged from the check-in before"
                  : `${change > 0 ? "+" : "−"}${Math.abs(change)} from the check-in before`}
              </span>
            )}
          </div>

          {/* Provenance. Which of the two readings this is. */}
          <p className="text-[11px] leading-relaxed text-[#6B635C] bg-[#FDF9F5] border border-[#EFE8E2] rounded-xl px-3.5 py-2.5">
            {wasSaved ? copy.saved : copy.recomputed}
          </p>

          {/* The arithmetic — the same component the results screen uses, so
              what is shown here is the calculation that actually runs. */}
          <ScoreFormulaCard
            checkIn={checkIn}
            displayedScore={chartScore}
            aiAdjustment={analysis.aiAdjustment}
            aiConsulted={analysis.aiConsulted}
            aiClamped={analysis.aiClamped}
            aiEvidenceChars={analysis.aiEvidenceChars}
            aiAdjustmentCap={analysis.aiAdjustmentCap}
          />

          {/* Where it came from */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
              {copy.reported}
            </h4>
            <div className="space-y-3">
              {factors.map((f) => (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#5A5049]">{f.label}</span>
                    <span className="text-[#3C3530]">{f.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#EFE8E2] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#5A5049]"
                      style={{ width: `${Math.max(0, Math.min(100, f.value))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#68625D] font-mono">
                    {factorFormula[f.key]} = {f.value}%
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-[#6B635C]">
              Each bar has its own scale, so these do not add up to the
              indicator above. They are there to compare one area against
              another at a glance.
            </p>
          </div>

          {/* The explanation */}
          {analysis.explanation && (
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
                What this reading was based on
              </h4>
              <p className="text-sm leading-relaxed text-[#3C3530]">{analysis.explanation}</p>
              {analysis.explanationPoints?.length > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {analysis.explanationPoints.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-[#5A5049]">
                      <span aria-hidden="true" className="text-[#8A4A20] shrink-0">
                        &bull;
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Their own words, if they left any. Never paraphrased. */}
          {showReflection && (
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#68625D]">
                {copy.wrote}
              </h4>
              <blockquote className="rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] px-4 py-3 flex gap-2.5">
                <Quote size={14} className="text-[#DBC3B2] shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-[#3C3530] italic" data-no-translate>
                  {reflectionText}
                </p>
              </blockquote>
            </div>
          )}

          {analysis.supportiveMessage && (
            <p className="text-sm leading-relaxed text-[#5A5049] border-l-2 border-[#DBC3B2] pl-4">
              {analysis.supportiveMessage}
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-[#68625D] border-t border-[#EFE8E2] pt-4">
            {copy.footer}
          </p>
        </div>
      </div>
    </div>
  );
};

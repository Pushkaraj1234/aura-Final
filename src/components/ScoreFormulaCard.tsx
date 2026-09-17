import React, { useState } from "react";
import { Calculator, ChevronDown, ShieldAlert } from "lucide-react";
import { CheckIn } from "../types";
import { explainRawScore } from "../services/riskEngine";

interface Props {
  checkIn: CheckIn;
  /** The score actually shown on screen, so the two can be reconciled. */
  displayedScore: number;
  /** Points the AI moved the rule-based score by, if it was consulted. */
  aiAdjustment?: number;
  /** Whether the AI ran at all. It only does when a reflection was written or spoken. */
  aiConsulted?: boolean;
  /** True when the AI wanted to move the score further than it was allowed to. */
  aiClamped?: boolean;
  /** Characters of reflection the model actually read, if any. */
  aiEvidenceChars?: number;
  /** The most it could move the score, given that much to go on. */
  aiAdjustmentCap?: number;
}

/** Trims trailing zeros so 7.5 stays 7.5 but 10.0 reads as 10. */
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Shows the arithmetic behind the distress score, using the participant's own
 * answers. Every term comes from explainRawScore — the same function the
 * engine scores with — so what is displayed here is the calculation that
 * actually ran, not a description of it written alongside.
 */
export const ScoreFormulaCard: React.FC<Props> = ({
  checkIn,
  displayedScore,
  aiAdjustment = 0,
  aiConsulted = false,
  aiClamped = false,
  aiEvidenceChars,
  aiAdjustmentCap,
}) => {
  const [open, setOpen] = useState(false);
  const breakdown = explainRawScore(checkIn);

  // The headline score must equal what this card derives. If it ever does not,
  // something upstream produced a number these answers cannot account for —
  // a stored score from an older weighting, or a model value that escaped its
  // bounds. Rather than print one figure as the rounding of another, say so.
  // This box exists to be checkable; a silent mismatch is the one failure it
  // must never have.
  const derived = breakdown.score + aiAdjustment;
  const reconciles = derived === displayedScore;

  // An immediate-safety answer bypasses the weighted model, so there is no
  // arithmetic to show — only the reason the score is what it is.
  if (breakdown.overridden) {
    return (
      <div className="rounded-2xl bg-[#A55D25]/10 border border-[#A55D25]/30 p-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-[#A55D25] shrink-0" />
          <h5 className="text-xs font-black uppercase tracking-wider text-[#A55D25]">
            How this number was calculated
          </h5>
        </div>
        <p className="text-xs text-[#5A5049] leading-relaxed">{breakdown.overrideReason}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer hover:bg-[#F6EEE6] transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Calculator size={15} className="text-[#5A5049] shrink-0" />
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase tracking-wider text-[#3C3530]">
              How this number was calculated
            </span>
            <span className="block text-[11px] text-[#68625D] font-mono truncate">
              {breakdown.terms.map((t) => fmt(t.points)).join(" + ")} = {fmt(breakdown.subtotal)} →{" "}
              {breakdown.score}
              {aiAdjustment !== 0 && ` ${aiAdjustment > 0 ? "+" : "−"} ${Math.abs(aiAdjustment)} = ${derived}`}
              {!reconciles && `, but ${displayedScore} is shown above`}
            </span>
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`text-[#68625D] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#EFE8E2] pt-3">
          <p className="text-[11px] text-[#68625D] leading-relaxed">
            Each question carries a fixed weight. Your answer is converted to points, and the points are added
            up. Nothing is hidden and no outside data is used.
          </p>

          {/* Rows rather than a table: on a phone a table either scrolls the
              points column out of view or crushes the arithmetic, and the
              points are the whole reason this box exists. */}
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-wider text-[#68625D] font-bold pb-1">
              <span>Your answers</span>
              <span>Points</span>
            </div>

            {breakdown.terms.map((term) => (
              <div
                key={term.key}
                className="flex items-baseline justify-between gap-3 py-1.5 border-t border-[#EFE8E2]/70"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#3C3530]">{term.label}</p>
                  <p className="text-[10px] text-[#6B635C] break-words">
                    <span className="font-semibold text-[#5A5049]">{term.response}</span>
                    <span className="font-mono"> · {term.expression}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-mono font-bold text-[#3C3530] leading-tight">
                    {fmt(term.points)}
                  </p>
                  <p className="text-[10px] text-[#6F5F4F] leading-tight">of {term.maxPoints}</p>
                </div>
              </div>
            ))}

            <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t-2 border-[#DBC3B2]">
              <span className="text-[11px] font-bold text-[#3C3530]">Total</span>
              <span className="text-[12px] font-mono font-bold text-[#3C3530]">{fmt(breakdown.subtotal)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] text-[#68625D]">Rounded to the nearest whole number</span>
              <span className="text-[13px] font-mono font-black text-[#3C3530] whitespace-nowrap">
                {breakdown.score}
              </span>
            </div>

            {/* Only shown when the AI actually moved the number. Without this
                the card printed the questionnaire subtotal above a different
                headline figure and called one the rounding of the other. */}
            {aiConsulted && (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] text-[#68625D]">
                    AI review of what you wrote or said
                    {/* The cap is stated because it is derived from how much
                        the person actually wrote. Without it, a small number
                        here looks arbitrary and a large one looks unearned —
                        and neither is something they could check. */}
                    {typeof aiEvidenceChars === "number" && aiEvidenceChars > 0 && (
                      <>
                        {" "}({aiEvidenceChars} characters
                        {typeof aiAdjustmentCap === "number" && `, up to ${aiAdjustmentCap} point${aiAdjustmentCap === 1 ? "" : "s"}`})
                      </>
                    )}
                    {aiClamped && " (held at that limit)"}
                  </span>
                  <span
                    className={`text-[12px] font-mono font-bold whitespace-nowrap ${
                      aiAdjustment === 0 ? "text-[#68625D]" : "text-[#A55D25]"
                    }`}
                  >
                    {aiAdjustment === 0
                      ? "no change"
                      : `${aiAdjustment > 0 ? "+" : "−"}${Math.abs(aiAdjustment)}`}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-1.5 border-t border-[#DBC3B2]">
                  <span className="text-[11px] font-bold text-[#3C3530]">Final score</span>
                  <span className="text-[13px] font-mono font-black text-[#3C3530] whitespace-nowrap">
                    {derived} / 100
                  </span>
                </div>
              </>
            )}

            {!reconciles && (
              <div className="mt-2 rounded-xl border border-[#A55D25]/30 bg-[#A55D25]/8 p-3 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#A55D25]">
                  These two numbers do not agree
                </p>
                <p className="text-[11px] text-[#5A5049] leading-relaxed">
                  Your answers work out to <strong>{derived}</strong>, but <strong>{displayedScore}</strong> is
                  shown above. That means the score displayed was not produced by the calculation on this page.
                  most often a result saved under an older version of the scoring. Please mention it to your
                  support worker; the working shown here is the one you can check.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white border border-[#EFE8E2] p-3 space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#68625D]">The general formula</p>
            <p className="text-[11px] font-mono text-[#5A5049] leading-relaxed break-words">
              score = safety + ((stress − 1) ÷ 4) × 22 + ((5 − wellbeing) ÷ 4) × 22 + ((5 − sleep) ÷ 4) × 17 +
              ((5 − connection) ÷ 4) × 11
            </p>
            <p className="text-[10px] text-[#68625D] leading-relaxed">
              safety: No = 28 · Unsure = 18 · Mostly = 6 · Yes = 0. Scales run 1–5, and the reversed ones
              (wellbeing, sleep, connection) score 0 points at 5, because a higher rating there means things are
              going better.
            </p>
            <p className="text-[10px] text-[#68625D] leading-relaxed">
              Asking for support is deliberately <em>not</em> scored. It still brings a counsellor sooner. It just
              does not change this number, so saying you would rather not talk to anyone can never make your
              score look calmer than your answers earned.
            </p>
          </div>

          {aiConsulted ? (
            <p className="text-[10px] text-[#68625D] leading-relaxed">
              The questionnaire above is scored by fixed rules. Anything you wrote or said is read separately by
              the AI, which can move the total by at most 15 points either way. Enough to weigh something the
              questions could not ask about, not enough to replace an answer you can check for yourself.
              {aiClamped &&
                " Here it wanted to move the score further than that, so it was held at the limit and your support worker has been told the two readings disagree."}
            </p>
          ) : (
            <p className="text-[10px] text-[#68625D] leading-relaxed">
              No AI review this time. That only happens when you write or record a reflection. This score is the
              questionnaire alone.
            </p>
          )}

          <p className="text-[10px] text-[#68625D] leading-relaxed italic">
            The percentage bars above are a separate visual scale for reading each area at a glance. They are not
            the points in this breakdown and do not add up to the score. This is a transparent rule-based calculation
            on your own voluntary answers, not a clinical measurement or a diagnosis.
          </p>
        </div>
      )}
    </div>
  );
};

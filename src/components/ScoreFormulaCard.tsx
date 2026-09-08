import React, { useState } from "react";
import { Calculator, ChevronDown, ShieldAlert } from "lucide-react";
import { CheckIn } from "../types";
import { explainRawScore } from "../services/riskEngine";

interface Props {
  checkIn: CheckIn;
  /** The score actually shown on screen, so the two can be reconciled. */
  displayedScore: number;
}

/** Trims trailing zeros so 7.5 stays 7.5 but 10.0 reads as 10. */
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Shows the arithmetic behind the distress score, using the participant's own
 * answers. Every term comes from explainRawScore — the same function the
 * engine scores with — so what is displayed here is the calculation that
 * actually ran, not a description of it written alongside.
 */
export const ScoreFormulaCard: React.FC<Props> = ({ checkIn, displayedScore }) => {
  const [open, setOpen] = useState(false);
  const breakdown = explainRawScore(checkIn);

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
            <span className="block text-[11px] text-[#7F8C8D] font-mono truncate">
              {breakdown.terms.map((t) => fmt(t.points)).join(" + ")} = {fmt(breakdown.subtotal)} → {displayedScore}
            </span>
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`text-[#7F8C8D] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#EFE8E2] pt-3">
          <p className="text-[11px] text-[#7F8C8D] leading-relaxed">
            Each question carries a fixed weight. Your answer is converted to points, and the points are added
            up — nothing is hidden and no external data is used.
          </p>

          {/* Rows rather than a table: on a phone a table either scrolls the
              points column out of view or crushes the arithmetic, and the
              points are the whole reason this box exists. */}
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-wider text-[#7F8C8D] font-bold pb-1">
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
                  <p className="text-[10px] text-[#7A726C] break-words">
                    <span className="font-semibold text-[#5A5049]">{term.response}</span>
                    <span className="font-mono"> · {term.expression}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-mono font-bold text-[#3C3530] leading-tight">
                    {fmt(term.points)}
                  </p>
                  <p className="text-[10px] text-[#A99A8A] leading-tight">of {term.maxPoints}</p>
                </div>
              </div>
            ))}

            <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t-2 border-[#DBC3B2]">
              <span className="text-[11px] font-bold text-[#3C3530]">Total</span>
              <span className="text-[12px] font-mono font-bold text-[#3C3530]">{fmt(breakdown.subtotal)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] text-[#7F8C8D]">Rounded to the nearest whole number</span>
              <span className="text-[13px] font-mono font-black text-[#3C3530] whitespace-nowrap">
                {displayedScore} / 100
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-[#EFE8E2] p-3 space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#7F8C8D]">The general formula</p>
            <p className="text-[11px] font-mono text-[#5A5049] leading-relaxed break-words">
              score = safety + ((stress − 1) ÷ 4) × 22 + ((5 − wellbeing) ÷ 4) × 22 + ((5 − sleep) ÷ 4) × 17 +
              ((5 − connection) ÷ 4) × 11
            </p>
            <p className="text-[10px] text-[#7F8C8D] leading-relaxed">
              safety: No = 28 · Unsure = 18 · Mostly = 6 · Yes = 0. Scales run 1–5, and the reversed ones
              (wellbeing, sleep, connection) score 0 points at 5, because a higher rating there means things are
              going better.
            </p>
            <p className="text-[10px] text-[#7F8C8D] leading-relaxed">
              Asking for support is deliberately <em>not</em> scored. It still brings a counsellor sooner — it just
              does not change this number, so saying you would rather not talk to anyone can never make your
              score look calmer than your answers earned.
            </p>
          </div>

          <p className="text-[10px] text-[#7F8C8D] leading-relaxed italic">
            The percentage bars above are a separate visual scale for reading each area at a glance — they are not
            the points in this breakdown and do not add up to the score. This is a transparent rule-based calculation
            on your own voluntary answers, not a clinical measurement or a diagnosis.
          </p>
        </div>
      )}
    </div>
  );
};

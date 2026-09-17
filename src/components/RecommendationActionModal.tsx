import React, { useEffect, useRef } from "react";
import { X, ArrowRight, LifeBuoy, Check } from "lucide-react";
import { Recommendation } from "../types";
import { getActionGuide } from "../services/actionGuides";

interface Props {
  recommendation: Recommendation | null;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onOpenEmergency: () => void;
}

/**
 * Opens when someone taps a recommendation's action. Before this the action
 * was a plain label that did nothing — a dead end offered to someone who had
 * just been told their distress was elevated and went looking for help.
 */
export const RecommendationActionModal: React.FC<Props> = ({
  recommendation,
  onClose,
  onNavigate,
  onOpenEmergency,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus starts inside the dialog so a keyboard user is
  // not left tabbing through the page behind it.
  useEffect(() => {
    if (!recommendation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [recommendation, onClose]);

  if (!recommendation) return null;
  const guide = getActionGuide(recommendation);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3C3530]/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={guide.title}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#EFE8E2] shadow-lg"
      >
        <div className="sticky top-0 bg-white border-b border-[#EFE8E2] px-6 py-4 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#68625D]">
              {recommendation.category.replace(/_/g, " ")}
            </span>
            <h3 className="text-lg font-bold text-[#3C3530] leading-snug">{guide.title}</h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-2 -m-2 rounded-full text-[#68625D] hover:text-[#3C3530] hover:bg-[#FDF9F5] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-[#5A5049] leading-relaxed">{guide.intent}</p>

          <ul className="space-y-3">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#FDF9F5] border border-[#EFE8E2] flex items-center justify-center">
                  <Check size={11} className="text-[#5A5049]" />
                </span>
                <span className="text-[13px] text-[#3C3530] leading-relaxed">{step}</span>
              </li>
            ))}
          </ul>

          {guide.footnote && (
            <p className="text-[11px] text-[#68625D] leading-relaxed italic border-t border-[#EFE8E2] pt-3">
              {guide.footnote}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {guide.isEmergency ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEmergency();
                }}
                className="flex-1 py-3 rounded-xl bg-[#A55D25] text-white font-bold text-sm hover:bg-[#8A4A20] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LifeBuoy size={16} />
                <span>Open emergency help</span>
              </button>
            ) : (
              guide.navigateTo && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate(guide.navigateTo!);
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{guide.navigateLabel}</span>
                  <ArrowRight size={15} />
                </button>
              )
            )}

            <button
              type="button"
              onClick={onClose}
              className="sm:w-auto py-3 px-5 rounded-xl border border-[#EFE8E2] text-[#5A5049] font-bold text-sm hover:bg-[#FDF9F5] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

          <p className="text-[10px] text-[#68625D] leading-relaxed">
            These are self-care and coping suggestions alongside human support, not treatment and not a
            substitute for it. Nothing here is required, and none of it is a test you can fail.
          </p>
        </div>
      </div>
    </div>
  );
};

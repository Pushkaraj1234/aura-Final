import React from "react";
import { ArrowLeft, LifeBuoy, MessageSquare } from "lucide-react";
import { LiteracyLibrary } from "../components/LiteracyLibrary";

/**
 * The reading library, for someone signed in.
 *
 * The accordion itself lives in LiteracyLibrary because the landing page shows
 * the same four pieces to people who have not signed up yet, and two copies of
 * it would drift apart. What belongs here is only what is different for a
 * person who already has a counsellor: the way back, and the offer to message
 * them.
 */

interface Props {
  onBack: () => void;
  onOpenEmergency: () => void;
  onOpenMessages?: () => void;
}

export const WhatToExpect: React.FC<Props> = ({ onBack, onOpenEmergency, onOpenMessages }) => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#7A726C] hover:text-[#3C3530] transition-colors"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </button>

      <LiteracyLibrary headingLevel={1}>
        {/* The route out of reading and into a person, which is the point of
            having written any of it. */}
        <section className="rounded-3xl border border-[#E0D7CE] bg-[#FDFAF7] p-6 sm:p-7 space-y-4">
          <h2 className="text-lg font-bold text-[#3C3530]">If you'd rather ask someone</h2>
          <p className="text-[15px] text-[#5A5049] leading-relaxed">
            None of this replaces talking to a person, and you don't need a reason or a bad week to
            do it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {onOpenMessages && (
              <button
                onClick={onOpenMessages}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#2A241F] transition-colors"
              >
                <MessageSquare size={16} aria-hidden="true" />
                Message your counsellor
              </button>
            )}
            <button
              onClick={onOpenEmergency}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-[#E0D7CE] text-[#5A5049] font-semibold text-sm hover:bg-white transition-colors"
            >
              <LifeBuoy size={16} aria-hidden="true" />
              Numbers that answer now
            </button>
          </div>
        </section>
      </LiteracyLibrary>
    </div>
  );
};

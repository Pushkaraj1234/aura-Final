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
 *
 * The column is held to 720px for the same reason the landing page holds it
 * there. This is reading, and reading wants a measure, not the full width of a
 * laptop.
 */

interface Props {
  onBack: () => void;
  onOpenEmergency: () => void;
  onOpenMessages?: () => void;
}

export const WhatToExpect: React.FC<Props> = ({ onBack, onOpenEmergency, onOpenMessages }) => {
  return (
    <div className="max-w-[720px] mx-auto px-5 sm:px-8 py-12 sm:py-16 space-y-12">
      <button
        onClick={onBack}
        className="group/back inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-[#8A7A6B] hover:text-[#3A2A1E] transition-colors cursor-pointer"
      >
        <ArrowLeft
          size={15}
          aria-hidden="true"
          className="transition-transform duration-200 ease-out group-hover/back:-translate-x-[3px]"
        />
        Back
      </button>

      <LiteracyLibrary headingLevel={1}>
        {/* The route out of reading and into a person, which is the point of
            having written any of it. Warmer ground than the reading cards, so
            it reads as a change of register rather than a fifth chapter. */}
        <section className="rounded-2xl border border-[#E6D3BC] bg-[#F3E7D8] px-6 sm:px-8 py-8 sm:py-9 space-y-4">
          <h2 className="font-serif text-[1.375rem] leading-[1.3] text-[#3A2A1E]">
            If you&rsquo;d rather ask someone
          </h2>
          <p className="max-w-[58ch] text-[1.0625rem] leading-[1.7] text-[#6B5B4C]">
            None of this replaces talking to a person, and you don&rsquo;t need a reason or a bad
            week to do it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            {onOpenMessages && (
              <button
                onClick={onOpenMessages}
                className="btn-primary px-6 py-3.5 text-[0.9375rem]"
              >
                <MessageSquare size={16} aria-hidden="true" />
                Message your counsellor
              </button>
            )}
            <button
              onClick={onOpenEmergency}
              className="btn-ghost px-6 py-3.5 text-[0.9375rem]"
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

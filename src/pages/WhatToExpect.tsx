import React, { useState } from "react";
import { ArrowLeft, BookOpen, ChevronDown, LifeBuoy, MessageSquare } from "lucide-react";
import { LITERACY_MODULES, type LiteracyModuleId } from "../services/literacyModules";

/**
 * The reading library.
 *
 * Built as one page of collapsed modules rather than a sequence, because the
 * person most likely to open this is not in a state to be led through
 * anything. Whichever heading matches what they are worried about right now
 * should be one tap away, and nothing should require finishing the first
 * thing to reach the third.
 *
 * Nothing is tracked. There is no progress bar, no completion state and no
 * record of what was read. A library that reports back on whether you finished
 * it is a different and much worse object, and on this product it would sit
 * inside a counsellor's view of a survivor.
 */

interface Props {
  onBack: () => void;
  onOpenEmergency: () => void;
  onOpenMessages?: () => void;
}

export const WhatToExpect: React.FC<Props> = ({ onBack, onOpenEmergency, onOpenMessages }) => {
  const [open, setOpen] = useState<LiteracyModuleId | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#7A726C] hover:text-[#3C3530] transition-colors"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </button>

      <header className="space-y-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B0713C]">
          <BookOpen size={13} aria-hidden="true" />
          Reading
        </span>
        <h1 className="font-serif text-[2.2rem] sm:text-[2.6rem] leading-[1.1] text-[#3A2A1E]">
          What to expect
        </h1>
        <p className="text-[15px] text-[#7A726C] leading-relaxed max-w-2xl">
          Four short pieces about what you might be feeling, what the people here can actually do,
          and how the court process usually goes. Read whichever one matches today. Nothing here is
          recorded, and nobody is told what you opened.
        </p>
      </header>

      <div className="space-y-3">
        {LITERACY_MODULES.map((module) => {
          const isOpen = open === module.id;
          return (
            <article
              key={module.id}
              className="rounded-3xl border border-[#EFE8E2] bg-white shadow-xs overflow-hidden"
            >
              <button
                onClick={() => setOpen(isOpen ? null : module.id)}
                aria-expanded={isOpen}
                className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 hover:bg-[#FDFAF7] transition-colors"
              >
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[#3C3530]">{module.title}</h2>
                  <p className="text-sm text-[#7A726C] mt-1">{module.summary}</p>
                  <p className="text-[12px] text-[#9A8E82] mt-1.5">{module.minutes} minute read</p>
                </div>
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  className={`shrink-0 mt-1 text-[#9A8E82] transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-6 space-y-5 border-t border-[#F6F1EC] pt-5">
                  {module.sections.map((section) => (
                    <section key={section.heading} className="space-y-1.5">
                      <h3 className="text-[15px] font-bold text-[#3C3530]">{section.heading}</h3>
                      <p className="text-[15px] text-[#5A5049] leading-relaxed">{section.body}</p>
                    </section>
                  ))}

                  <p className="text-[15px] text-[#3C3530] font-semibold leading-relaxed rounded-2xl bg-[#FBF3EC] border border-[#E3C9A8] px-5 py-4">
                    {module.takeaway}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>

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
    </div>
  );
};

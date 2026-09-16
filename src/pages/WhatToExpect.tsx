import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Compass, LifeBuoy, MessageSquare, RotateCcw } from "lucide-react";
import { LiteracyLibrary } from "../components/LiteracyLibrary";
import {
  GUIDED_CHOICES,
  NEED_OPTIONS,
  needOption,
  readingFor,
  type NeedId,
} from "../services/recoveryNeeds";

/**
 * The reading library, for someone signed in, with a gentle way in.
 *
 * WHAT IS DIFFERENT HERE FROM THE LANDING PAGE, AND WHY IT IS ONLY HERE
 *
 * Both pages render the same four pieces through the same component, and a
 * visitor who has not signed up should not be asked where they are before they
 * are allowed to read. So the check-in lives on this page only. The shared
 * component gained one optional prop, `only`, which the landing page does not
 * pass and is therefore unaffected by.
 *
 * WHY THIS PAGE NOW WRITES ITS OWN HEADER
 *
 * The shared header says "Nothing here is recorded, and nobody is told what
 * you opened", which is true of both pages and must stay true. This page adds
 * a question, so it says what happens to the answer in the same breath rather
 * than leaving a reader to assume. `showHeader={false}` keeps the shared
 * sentence exactly as it is for the landing page.
 *
 * NOTHING SELECTED HERE IS STORED
 *
 * The choice lives in component state for the length of a visit. It is not
 * written to the database, not sent to a counsellor, not fed into any score,
 * and does not follow the person into the Recovery Hub. It reorders reading.
 * If that ever changes, the paragraph under the heading has to change with it.
 *
 * WHAT TO EXPECT EXPLAINS. THE RECOVERY HUB ORGANISES.
 *
 * The door between them is offered at the end and is never a requirement.
 * Somebody can read everything here, message a counsellor, and never open a
 * case, which is the point of keeping the two things separate.
 */

interface Props {
  onBack: () => void;
  onOpenEmergency: () => void;
  onOpenMessages?: () => void;
  onOpenRecoveryHub?: () => void;
}

export const WhatToExpect: React.FC<Props> = ({
  onBack,
  onOpenEmergency,
  onOpenMessages,
  onOpenRecoveryHub,
}) => {
  const [need, setNeed] = useState<NeedId | null>(null);
  const chosen = need ? needOption(need) : undefined;
  const isGuided = need === "unsure";

  return (
    <div className="max-w-[720px] mx-auto px-5 sm:px-8 py-12 sm:py-16 space-y-12">
      <button
        onClick={onBack}
        className="group/back inline-flex min-h-[44px] items-center gap-2 px-1 text-[0.8125rem] font-semibold text-[#6B5B4C] hover:text-[#3A2A1E] transition-colors cursor-pointer"
      >
        <ArrowLeft
          size={15}
          aria-hidden="true"
          className="transition-transform duration-200 ease-out group-hover/back:-translate-x-[3px]"
        />
        Back
      </button>

      {/* This page's own header, so the shared one on the landing page is left
          exactly as it was. Same type, same colours, same rhythm. */}
      <header className="space-y-5">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          Reading
        </span>

        <h1 className="text-[2rem] sm:text-[2.5rem] leading-[1.12] text-[#3A2A1E]">
          What to expect
        </h1>

        <p className="max-w-[60ch] text-[1.0625rem] leading-[1.7] text-[#6B5B4C]">
          Four short pieces about what you might be feeling, what the people here can actually do,
          and how the court process usually goes. Read whichever one matches today.
        </p>

        {/* Accurate rather than reassuring: the question below has an answer,
            and this says what becomes of it. */}
        <p className="max-w-[60ch] text-[1.0625rem] leading-[1.7] text-[#6B5B4C]">
          You choose what to share, and you can skip any question. Nothing you choose here is
          saved, and nobody is told what you opened. Anything you later choose to save lives in
          your Recovery Hub, where only you can see it.
        </p>
      </header>

      {/* -- the check-in ------------------------------------------------- */}
      <section className="space-y-5" aria-labelledby="need-heading">
        <div className="space-y-2">
          <h2
            id="need-heading"
            className="font-serif text-[1.375rem] leading-[1.3] text-[#3A2A1E]"
          >
            What feels closest to where you are today?
          </h2>
          <p className="max-w-[58ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
            You don&rsquo;t need to explain everything. Choose whatever feels most helpful right
            now.
          </p>
        </div>

        {/* Same container and hairline rules as the reading list, so this reads
            as part of the same page rather than a form bolted to the top. */}
        <div className="rounded-2xl border border-[#E4D7C6] bg-[#FDFAF4] overflow-hidden">
          {NEED_OPTIONS.map((option, index) => {
            const isOpen = need === option.id;
            return (
              <div
                key={option.id}
                className={`group border-[#EDE2D4] transition-colors duration-200 ease-out ${
                  index > 0 ? "border-t" : ""
                } ${isOpen ? "bg-white" : "hover:bg-[#FBF5EC]"}`}
              >
                <button
                  type="button"
                  aria-pressed={isOpen}
                  onClick={() => setNeed(isOpen ? null : option.id)}
                  className="w-full text-left flex items-baseline gap-4 sm:gap-6 px-5 sm:px-7 py-5 sm:py-6 min-h-[44px] cursor-pointer"
                >
                  {/* #756553 rather than the lighter grey the reading list
                      uses: these are on the same surfaces but measured 3.18:1,
                      and a numeral a sighted person reads is text whether or
                      not it is hidden from a screen reader. */}
                  <span
                    aria-hidden="true"
                    className="font-mono font-normal text-[0.8125rem] tabular-nums text-[#756553] shrink-0"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 min-w-0 block">
                    <span
                      className={`block text-[1.0625rem] leading-[1.45] ${
                        isOpen ? "font-semibold text-[#3A2A1E]" : "text-[#3A2A1E]"
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.detail && (
                      <span className="mt-1 block text-[0.875rem] leading-[1.6] text-[#6B5B4C]">
                        {option.detail}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {chosen && (
          <div
            role="status"
            className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-5 py-4 text-[1rem] leading-[1.7] text-[#6B5B4C]"
          >
            {chosen.acknowledgement}
          </div>
        )}

        {/* "I'm not sure" gets a second, smaller question rather than a dead
            end, and every answer lands on a need that already exists. */}
        {isGuided && (
          <div className="space-y-3">
            <p className="text-[0.9375rem] font-semibold text-[#3A2A1E]">
              What would help most right now?
            </p>
            <div className="flex flex-wrap gap-2.5">
              {GUIDED_CHOICES.map((choice) => (
                <button
                  key={choice.label}
                  onClick={() => setNeed(choice.resolvesTo)}
                  className="btn-ghost min-h-[44px] px-5 py-2.5 text-[0.9375rem]"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {need && (
          <button
            onClick={() => setNeed(null)}
            className="inline-flex min-h-[44px] items-center gap-2 px-1 text-[0.875rem] font-semibold text-[#6B5B4C] underline-offset-4 hover:text-[#3A2A1E] hover:underline cursor-pointer"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Show me everything instead
          </button>
        )}
      </section>

      {/* -- the reading, reordered rather than reduced -------------------- */}
      <LiteracyLibrary
        showHeader={false}
        headingLevel={1}
        only={readingFor(need)}
        listLabel={need ? "Start with these" : "The four pieces"}
      >
        {/* What is behind the door, said plainly, before the door is offered. */}
        {chosen && chosen.hubHighlights.length > 0 && (
          <section className="rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] px-6 sm:px-8 py-7 space-y-4">
            <h2 className="font-serif text-[1.25rem] leading-[1.3] text-[#3A2A1E]">
              If you&rsquo;re ready to take the next step
            </h2>
            <p className="max-w-[58ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
              You can keep your case information, documents, important dates, and support
              resources together in one place. For where you are, that would mean:
            </p>
            <ul className="space-y-2 pt-1">
              {chosen.hubHighlights.map((h) => (
                <li
                  key={h}
                  className="flex gap-3 text-[0.9375rem] leading-[1.65] text-[#5A4636]"
                >
                  <span aria-hidden="true" className="text-[#A85D2E]">
                    &middot;
                  </span>
                  {h}
                </li>
              ))}
            </ul>
            {chosen.nextStep && (
              <p className="max-w-[58ch] border-l-2 border-[#D9A877] pl-4 text-[0.9375rem] leading-[1.7] text-[#5A4636]">
                {chosen.nextStep}
              </p>
            )}
            {onOpenRecoveryHub && (
              <div className="pt-1">
                <button
                  onClick={onOpenRecoveryHub}
                  className="btn-primary min-h-[44px] px-6 py-3.5 text-[0.9375rem]"
                >
                  <Compass size={16} aria-hidden="true" />
                  Open Recovery Hub
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
            <p className="text-[0.8125rem] leading-[1.6] text-[#7A6A5A]">
              Nothing has to be filled in, and you don&rsquo;t have to open a case to keep reading
              or to talk to someone.
            </p>
          </section>
        )}

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
                className="btn-primary min-h-[44px] px-6 py-3.5 text-[0.9375rem]"
              >
                <MessageSquare size={16} aria-hidden="true" />
                Message your counsellor
              </button>
            )}
            <button
              onClick={onOpenEmergency}
              className="btn-ghost min-h-[44px] px-6 py-3.5 text-[0.9375rem]"
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

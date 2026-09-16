import React, { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { LITERACY_MODULES, type LiteracyModuleId } from "../services/literacyModules";

/**
 * The reading library, shared by the participant page and the landing page.
 *
 * Extracted rather than copied. The two places this appears show the same four
 * pieces about distress, counsellors, the court process and what AURA does
 * with what it is told, and a duplicated accordion would drift: someone edits
 * the signed-in copy, the public one keeps saying the old thing, and the
 * screen a person reads before they trust us is the stale one.
 *
 * Only the action at the end differs, because the two audiences differ. A
 * signed-in person can message their counsellor; a visitor cannot. That is
 * passed in as children instead of being branched on here.
 *
 * Nothing is tracked, in either place. There is no progress state, no
 * completion flag and no record of what was opened. A library that reports
 * back on whether you finished it is a different and much worse object, and on
 * this product it would end up inside a counsellor's view of a survivor.
 */

interface Props {
  /** The action offered at the end. Differs by audience. */
  children?: React.ReactNode;
  /** Rendering inside a page that already has its own heading. */
  showHeader?: boolean;
  /**
   * The level of "What to expect".
   *
   * On its own page it is the page title and must be an h1, or that screen has
   * no top-level heading at all and a screen reader has nothing to jump to. On
   * the landing page the hero already holds the h1, so it is an h2 there. The
   * levels below it shift with it, so the outline stays contiguous either way
   * rather than skipping a rank.
   */
  headingLevel?: 1 | 2;
}

export const LiteracyLibrary: React.FC<Props> = ({
  children,
  showHeader = true,
  headingLevel = 2,
}) => {
  const [open, setOpen] = useState<LiteracyModuleId | null>(null);
  const Heading = (headingLevel === 1 ? "h1" : "h2") as "h1" | "h2";
  const ModuleHeading = (headingLevel === 1 ? "h2" : "h3") as "h2" | "h3";
  const SectionHeading = (headingLevel === 1 ? "h3" : "h4") as "h3" | "h4";

  return (
    <div className="space-y-8">
      {showHeader && (
        <header className="space-y-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B0713C]">
            <BookOpen size={13} aria-hidden="true" />
            Reading
          </span>
          <Heading className="font-serif text-[2.2rem] sm:text-[2.6rem] leading-[1.1] text-[#3A2A1E]">
            What to expect
          </Heading>
          <p className="text-[15px] text-[#7A726C] leading-relaxed max-w-2xl">
            Four short pieces about what you might be feeling, what the people here can actually
            do, and how the court process usually goes. Read whichever one matches today. Nothing
            here is recorded, and nobody is told what you opened.
          </p>
        </header>
      )}

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
                  <ModuleHeading className="text-lg font-bold text-[#3C3530]">
                    {module.title}
                  </ModuleHeading>
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
                      <SectionHeading className="text-[15px] font-bold text-[#3C3530]">
                        {section.heading}
                      </SectionHeading>
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

      {children}
    </div>
  );
};

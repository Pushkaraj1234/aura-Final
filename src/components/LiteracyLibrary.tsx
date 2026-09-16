import React, { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
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
 * DESIGN NOTES
 *
 * These read as chapters, not as UI. A numbered column, a serif title, a
 * hairline rule and a great deal of space, because the person opening this may
 * be reading it at two in the morning and should feel invited rather than
 * processed. Everything is restrained on purpose: 2px of lift on hover, 3px of
 * arrow travel, one border shade darker. Nothing bounces, glows or scales.
 *
 * The expanded state is deliberately not a panel. It is an article: a 62ch
 * measure, 1.75 line-height, and a way out at the bottom that says "Close
 * reading" rather than collapsing silently, so nobody feels held inside it.
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
  const uid = useId();

  const Heading = (headingLevel === 1 ? "h1" : "h2") as "h1" | "h2";
  const ModuleHeading = (headingLevel === 1 ? "h2" : "h3") as "h2" | "h3";
  const SectionHeading = (headingLevel === 1 ? "h3" : "h4") as "h3" | "h4";

  return (
    <div className="space-y-14 sm:space-y-16">
      {showHeader && (
        <header className="space-y-5">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
            Reading
          </span>

          <Heading className="text-[2rem] sm:text-[2.5rem] leading-[1.12] text-[#3A2A1E] max-w-[16ch]">
            What to expect
          </Heading>

          {/* Narrower than the heading, so the block reads as a column rather
              than a banner. 66ch is about 11 words a line, which is the range
              people read without effort. */}
          <p className="max-w-[66ch] text-[1.0625rem] leading-[1.7] text-[#6B5B4C]">
            Four short pieces about what you might be feeling, what the people here can actually
            do, and how the court process usually goes. Read whichever one matches today. Nothing
            here is recorded, and nobody is told what you opened.
          </p>

          {/* Guidance, not an instruction and not a control. Set in italic
              serif at the same size as the body so it reads as an aside from a
              person rather than as another thing to do. */}
          <p className="font-serif italic text-[1.0625rem] leading-[1.7] text-[#7A6A5A] pt-1">
            Start with whatever feels closest to where you are today.
          </p>
        </header>
      )}

      <div className="space-y-3">
        {LITERACY_MODULES.map((module, index) => {
          const isOpen = open === module.id;
          const buttonId = `${uid}-trigger-${module.id}`;
          const panelId = `${uid}-panel-${module.id}`;

          return (
            <article
              key={module.id}
              className={`group rounded-2xl border transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out ${
                isOpen
                  ? "border-[#DFD0BC] bg-white shadow-[0_1px_2px_rgba(58,42,30,0.04),0_18px_40px_-28px_rgba(58,42,30,0.22)]"
                  : "border-[#ECE1D3] bg-[#FDFAF4] hover:-translate-y-0.5 hover:border-[#DFD0BC] hover:bg-white hover:shadow-[0_1px_2px_rgba(58,42,30,0.04),0_18px_40px_-28px_rgba(58,42,30,0.18)]"
              }`}
            >
              {/* The heading wraps the button rather than sitting inside it.
                  A button's content model is phrasing content, so a heading
                  nested in one is invalid and assistive technology may not
                  expose it as a heading at all. This is the pattern the ARIA
                  authoring practices specify for an accordion. */}
              <ModuleHeading className="m-0">
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : module.id)}
                  className="w-full text-left flex items-start gap-4 sm:gap-6 px-5 sm:px-7 py-6 sm:py-7 rounded-2xl cursor-pointer"
                >
                  {/* Mono keeps the four numerals on one optical column down
                      the stack, which is the whole reason they are here. */}
                  {/* font-normal on every child is load-bearing, not tidiness.
                      The wrapping heading sets font-weight:550 !important and
                      these inherit it, so without this the summary and the
                      reading time render as bold as the title and the card has
                      no hierarchy at all. */}
                  <span
                    aria-hidden="true"
                    className="font-mono font-normal text-[0.8125rem] leading-[1.6] tabular-nums text-[#9A8B77] pt-[0.35rem]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="flex-1 min-w-0 block">
                    <span className="block font-serif text-[1.1875rem] sm:text-[1.3125rem] leading-[1.35] text-[#3A2A1E]">
                      {module.title}
                    </span>
                    <span className="block font-sans font-normal text-[0.9375rem] leading-[1.6] text-[#6B5B4C] max-w-[52ch] mt-2">
                      {module.summary}
                    </span>
                    <span className="block font-sans font-normal text-[0.75rem] tracking-[0.06em] text-[#7A6A5A] mt-3">
                      {module.minutes} min read
                    </span>
                  </span>

                  <ArrowRight
                    size={18}
                    aria-hidden="true"
                    className={`shrink-0 mt-1 text-[#B9A894] transition-transform duration-200 ease-out ${
                      isOpen ? "rotate-90 text-[#A85D2E]" : "group-hover:translate-x-[3px]"
                    }`}
                  />
                </button>
              </ModuleHeading>

              {/* Height is animated with a 0fr/1fr grid row, which is the only
                  way to transition to an intrinsic height without measuring it
                  in JavaScript. `invisible` when closed rather than merely
                  clipped, because visibility:hidden takes the collapsed text
                  out of the accessibility tree instead of leaving four hidden
                  articles for a screen reader to wade through. */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div
                  className={`overflow-hidden transition-[visibility] duration-300 ${
                    isOpen ? "visible" : "invisible"
                  }`}
                >
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="px-5 sm:px-7 pb-7 sm:pb-8"
                  >
                    <div className="border-t border-[#F1E7DA] pt-7 sm:pl-[3.25rem] space-y-7">
                      {module.sections.map((section) => (
                        <section key={section.heading} className="space-y-2 max-w-[62ch]">
                          <SectionHeading className="reading-subhead text-[0.9375rem] text-[#3A2A1E]">
                            {section.heading}
                          </SectionHeading>
                          <p className="text-[1.0625rem] leading-[1.75] text-[#5A4636]">
                            {section.body}
                          </p>
                        </section>
                      ))}

                      {/* The one line worth remembering. A left rule rather
                          than a filled box: a pull quote, not a callout. */}
                      <p className="max-w-[62ch] border-l-2 border-[#D9A877] pl-5 font-serif text-[1.125rem] leading-[1.6] text-[#3A2A1E]">
                        {module.takeaway}
                      </p>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setOpen(null)}
                          className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-[#7A6A5A] hover:text-[#3A2A1E] transition-colors cursor-pointer"
                        >
                          <span aria-hidden="true" className="text-[1rem] leading-none">
                            &minus;
                          </span>
                          Close reading
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {children}
    </div>
  );
};

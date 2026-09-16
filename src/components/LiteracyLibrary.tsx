import React, { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { LITERACY_MODULES, type LiteracyModuleId } from "../services/literacyModules";

/**
 * The reading library, shared by the participant page and the landing page.
 *
 * Extracted rather than copied. The two places this appears show the same four
 * pieces about distress, counsellors, the court process and what AURA does
 * with what it is told, and a duplicated list would drift: someone edits the
 * signed-in copy, the public one keeps saying the old thing, and the screen a
 * person reads before they trust us is the stale one.
 *
 * WHY THE PROMPT LEADS AND THE TITLE FOLLOWS
 *
 * Someone arriving on the landing page is not browsing a library. They have a
 * question and usually no vocabulary for it, so the row says "I don't
 * understand what I'm feeling" and the article title sits underneath it once
 * the row is open. A person who cannot yet name what is happening to them can
 * still recognise their own sentence, which is the entire point of this
 * section and the reason it is not four article cards.
 *
 * WHY IT IS A LIST AND NOT CARDS
 *
 * One bordered container with hairline rules between rows, rather than four
 * separate surfaces. Four cards read as a grid of products; a ruled list reads
 * as a contents page. Only the hovered or open row takes a surface, so the
 * eye is drawn along the column rather than across four equal blocks.
 *
 * Everything is restrained on purpose: a background half a shade warmer on
 * hover, a plus that becomes a minus, one border shade darker, 200ms. Nothing
 * scales, glows or bounces.
 *
 * Nothing is tracked, in either place. There is no progress state, no
 * completion flag and no record of what was opened. A library that reports
 * back on whether you finished it is a different and much worse object, and on
 * this product it would end up inside a counsellor's view of a survivor.
 */

interface Props {
  /** The action offered at the end. Differs by audience, and sits below everything. */
  children?: React.ReactNode;
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
  /**
   * `split` puts the editorial column beside the list, which is what the
   * homepage needs: a narrow centred column there left the section stranded in
   * a field of empty background. `stacked` keeps the single reading column
   * that suits a page someone opened deliberately.
   */
  layout?: "split" | "stacked";
}

export const LiteracyLibrary: React.FC<Props> = ({
  children,
  showHeader = true,
  headingLevel = 2,
  layout = "stacked",
}) => {
  const [open, setOpen] = useState<LiteracyModuleId | null>(null);
  const uid = useId();

  const Heading = (headingLevel === 1 ? "h1" : "h2") as "h1" | "h2";
  const RowHeading = (headingLevel === 1 ? "h2" : "h3") as "h2" | "h3";
  const SectionHeading = (headingLevel === 1 ? "h3" : "h4") as "h3" | "h4";
  const isSplit = layout === "split";

  const header = showHeader ? (
    <header className="space-y-5">
      <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
        Reading
      </span>

      <Heading className="text-[2rem] sm:text-[2.5rem] leading-[1.12] text-[#3A2A1E]">
        What to expect
      </Heading>

      <p className="max-w-[54ch] text-[1.0625rem] leading-[1.7] text-[#6B5B4C]">
        Four short pieces about what you might be feeling, what the people here can actually do,
        and how the court process usually goes. Read whichever one matches today. Nothing here is
        recorded, and nobody is told what you opened.
      </p>

      {/* Guidance, not an instruction and not a control. Italic serif so it
          reads as an aside from a person rather than another thing to do. */}
      <p className="font-serif italic text-[1.0625rem] leading-[1.7] text-[#7A6A5A] pt-1">
        Start with whatever feels closest to where you are today.
      </p>
    </header>
  ) : null;

  const list = (
    <div className="space-y-6">
      {/* #756553 rather than a lighter grey: this sits on the opaque #F7EFE3
          band, where it measures 4.92:1. At 11px it is small text and needs
          4.5:1, which the #8A7A6B used elsewhere on lighter card surfaces does
          not reach here (3.63:1). */}
      <span className="block text-[11px] uppercase tracking-[0.18em] text-[#756553]">
        What feels closest today?
      </span>

      {/* One container, hairline rules inside. A contents page, not a grid. */}
      <div className="rounded-2xl border border-[#E4D7C6] bg-[#FDFAF4] overflow-hidden">
        {LITERACY_MODULES.map((module, index) => {
          const isOpen = open === module.id;
          const buttonId = `${uid}-trigger-${module.id}`;
          const panelId = `${uid}-panel-${module.id}`;

          return (
            <div
              key={module.id}
              className={`group border-[#EDE2D4] transition-colors duration-200 ease-out ${
                index > 0 ? "border-t" : ""
              } ${isOpen ? "bg-white" : "hover:bg-[#FBF5EC]"}`}
            >
              {/* The heading wraps the button rather than sitting inside it. A
                  button's content model is phrasing content, so a heading
                  nested in one is invalid and assistive technology may not
                  expose it as a heading at all. This is the pattern the ARIA
                  authoring practices specify for an accordion. */}
              <RowHeading className="m-0">
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : module.id)}
                  /* items-baseline, not items-center: most of these statements
                     wrap at phone widths and one of them wraps on a laptop, and
                     a numeral centred against a three-line block floats between
                     the lines belonging to neither. Baseline alignment puts it
                     on the first line, which is where a list marker goes. The
                     indicator opts out with self-center so it stays centred on
                     the row as a whole. */
                  className="w-full text-left flex items-baseline gap-4 sm:gap-7 px-5 sm:px-8 py-7 sm:py-8 cursor-pointer"
                >
                  {/* Mono keeps the four numerals on one optical column down
                      the list, which is the whole reason they are here.
                      font-normal is load-bearing rather than tidiness: the
                      wrapping heading sets font-weight:550 !important and
                      every child inherits it, so without this the numeral and
                      the indicator render as heavy as the statement. */}
                  <span
                    aria-hidden="true"
                    className="font-mono font-normal text-[0.8125rem] tabular-nums text-[#9A8B77] shrink-0"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="flex-1 min-w-0 block font-serif text-[1.25rem] sm:text-[1.5rem] leading-[1.3] text-[#3A2A1E]">
                    {module.prompt}
                  </span>

                  {/* The ring is decoration and deliberately faint; the glyph
                      inside is what carries the open/closed state and is what
                      has to be legible (3.97:1 closed, 4.92:1 open, both above
                      the 3:1 required of non-text). Do not lighten the glyph to
                      match the ring — darken the ring if anything. */}
                  <span
                    aria-hidden="true"
                    className={`shrink-0 self-center flex items-center justify-center h-9 w-9 rounded-full border transition-colors duration-200 ease-out ${
                      isOpen
                        ? "border-[#A85D2E] bg-[#A85D2E] text-white"
                        : "border-[#E0D0BB] text-[#8A7A6B] group-hover:border-[#C9B69C] group-hover:text-[#3A2A1E]"
                    }`}
                  >
                    {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                  </span>
                </button>
              </RowHeading>

              {/* Height animates with a 0fr/1fr grid row, the only way to
                  transition to an intrinsic height without measuring it in
                  JavaScript. `invisible` when closed rather than merely
                  clipped, because visibility:hidden takes the collapsed text
                  out of the accessibility tree instead of leaving four hidden
                  articles for a screen reader to wade through, and it is
                  transitioned so the words stay put while the row closes
                  rather than vanishing before it. */}
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
                    className="px-5 sm:px-8 pb-8 sm:pl-[4.25rem]"
                  >
                    {/* The article this answers with, named now that the
                        person has chosen. Secondary to the statement above, so
                        it is set smaller and lighter than the row title. */}
                    <p className="font-serif text-[1.0625rem] leading-[1.4] text-[#3A2A1E]">
                      {module.title}
                    </p>
                    <p className="font-sans font-normal text-[0.9375rem] leading-[1.6] text-[#6B5B4C] max-w-[56ch] mt-2">
                      {module.summary}
                    </p>
                    <p className="font-sans font-normal text-[0.75rem] tracking-[0.06em] text-[#7A6A5A] mt-2.5">
                      {module.minutes} min read
                    </p>

                    <div className="border-t border-[#F1E7DA] mt-7 pt-7 space-y-7">
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
                          <Minus size={14} aria-hidden="true" />
                          Close reading
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!isSplit) {
    return (
      <div className="space-y-14 sm:space-y-16">
        {header}
        {list}
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* 38/62 rather than a half split: the left column is a standfirst, and
          giving it equal weight would make the page look like a comparison
          table. `items-start` so the editorial column stays at the top rather
          than centring itself against a list that grows when a row opens. */}
      <div className="grid gap-12 lg:gap-20 lg:grid-cols-[38fr_62fr] items-start">
        <div className="lg:sticky lg:top-28">{header}</div>
        {list}
      </div>
      {children}
    </div>
  );
};

import React, { useEffect, useId, useState } from "react";
import { ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { LITERACY_MODULES, type LiteracyModuleId } from "../services/literacyModules";

/**
 * The reading library as four flip cards, for the landing page only.
 *
 * WHY THIS IS A SEPARATE COMPONENT FROM LiteracyLibrary
 *
 * The signed-in page shows these four pieces as a ruled accordion, because
 * somebody who has opened that page deliberately is there to read. A visitor
 * scanning a homepage is doing something else, and the two presentations share
 * almost no markup: an accordion and a 2x2 grid of rotating cards forced into
 * one component behind a variant flag would be worse for both.
 *
 * What is NOT duplicated is the content. Both components read
 * LITERACY_MODULES, so there is still exactly one place where any of these
 * words live, and a test asserts no title, summary or reading time is typed
 * into this file.
 *
 * THE FLIP IS PURELY VISUAL, AND THAT IS AN ACCESSIBILITY DECISION
 *
 * A screen reader user never hovers, and information that only exists on the
 * far side of an animation is information they do not have. So both faces are
 * aria-hidden and the button carries the whole card, prompt and article and
 * reading time, in one accessible name. The rotation is decoration over the
 * top of a control that already says everything.
 *
 * TOUCH HAS NO HOVER, SO IT GETS A REAL SECOND STATE
 *
 * On a device that can hover, a click opens the piece: the back is already
 * showing, so asking for a second click would be asking twice for the same
 * thing. Without hover, the first tap turns the card and the second opens it,
 * which is the only way the back is reachable at all.
 *
 * READING HAPPENS IN PLACE
 *
 * Opening a piece expands an article panel under the grid rather than routing
 * away. Nothing is tracked: no progress state, no completion flag, no record
 * of what was opened, on a page somebody is reading before they have decided
 * whether to trust us.
 */

interface Props {
  /** The action offered at the end. Sits below everything. */
  children?: React.ReactNode;
}

export const LiteracyCards: React.FC<Props> = ({ children }) => {
  const [open, setOpen] = useState<LiteracyModuleId | null>(null);
  const [tapped, setTapped] = useState<LiteracyModuleId | null>(null);
  const [canHover, setCanHover] = useState(true);
  const uid = useId();

  /**
   * Whether this device has a real pointer.
   *
   * Read from the media query rather than from user-agent sniffing, and
   * re-read on change, because a tablet with a keyboard attached and then
   * detached is one device that is both.
   */
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(hover: hover)");
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const activate = (id: LiteracyModuleId) => {
    if (!canHover && tapped !== id) {
      setTapped(id);
      return;
    }
    setOpen(id);
    setTapped(null);
  };

  const opened = LITERACY_MODULES.find((m) => m.id === open) ?? null;

  const header = (
    <header className="space-y-5">
      <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
        Reading
      </span>

      <h2 className="text-[2rem] sm:text-[2.5rem] leading-[1.12] text-[#3A2A1E]">
        What to expect
      </h2>

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
  );

  const grid = (
    <div className="space-y-6">
      <span className="block text-[11px] uppercase tracking-[0.18em] text-[#6B5B4C]">
        What feels closest today?
      </span>

      <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
        {LITERACY_MODULES.map((module, index) => {
          const numeral = String(index + 1).padStart(2, "0");
          const isTapped = tapped === module.id;

          return (
            <div
              key={module.id}
              className="flip-card"
              data-flipped={isTapped ? "true" : "false"}
            >
              <button
                type="button"
                onClick={() => activate(module.id)}
                // The whole card in one accessible name, so nothing depends on
                // the rotation having happened.
                aria-label={`${module.prompt}. Reading: ${module.title}. ${module.summary} ${module.minutes} min read.`}
                aria-expanded={open === module.id}
                // Only pointed at the panel while the panel exists. An
                // aria-controls referencing a missing id is a dangling
                // reference in every screen reader that follows it.
                aria-controls={open === module.id ? `${uid}-article` : undefined}
                className="flip-card-inner w-full text-left rounded-2xl cursor-pointer"
              >
                {/* FRONT ------------------------------------------------- */}
                <span
                  aria-hidden="true"
                  className="flip-face flex flex-col justify-between rounded-2xl border border-[#E4D7C6] bg-[#FDFAF4] px-6 py-7 sm:px-7 sm:py-8 min-h-[13.5rem] sm:min-h-[15rem]"
                  style={{
                    boxShadow:
                      "0 1px 2px rgba(58, 42, 30, 0.04), 0 16px 34px -26px rgba(58, 42, 30, 0.18)",
                  }}
                >
                  <span className="font-mono font-normal text-[0.8125rem] tabular-nums text-[#756553]">
                    {numeral}
                  </span>

                  <span className="block font-serif text-[1.3125rem] sm:text-[1.4375rem] leading-[1.3] text-[#3A2A1E] pt-6">
                    {module.prompt}
                  </span>

                  <span className="flex justify-end pt-5">
                    <ArrowUpRight size={18} className="text-[#756553]" />
                  </span>
                </span>

                {/* BACK -------------------------------------------------- */}
                <span
                  aria-hidden="true"
                  className="flip-face flip-face-back flex flex-col justify-between rounded-2xl border border-[#E0D0BB] bg-[#F7F0E4] px-6 py-7 sm:px-7 sm:py-8 min-h-[13.5rem] sm:min-h-[15rem]"
                  style={{
                    boxShadow:
                      "0 1px 2px rgba(58, 42, 30, 0.04), 0 16px 34px -26px rgba(58, 42, 30, 0.18)",
                  }}
                >
                  <span className="font-mono font-normal text-[0.8125rem] tabular-nums text-[#756553]">
                    {numeral}
                  </span>

                  <span className="block pt-5">
                    {/* The article title leads on this side, where the prompt
                        led on the other: the person has recognised themselves
                        and now wants to know what they would be reading. */}
                    <span className="block font-serif text-[1.1875rem] sm:text-[1.25rem] leading-[1.35] text-[#3A2A1E]">
                      {module.title}
                    </span>
                    <span className="mt-2.5 block font-sans font-normal text-[0.9375rem] leading-[1.6] text-[#5A4636]">
                      {module.summary}
                    </span>
                    <span className="mt-3 block font-sans font-normal text-[0.75rem] tracking-[0.06em] text-[#6B5B4C]">
                      {module.minutes} min read
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5 pt-5 text-[0.875rem] font-semibold text-[#8A4A20]">
                    Read more
                    <ArrowRight size={15} />
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* 38/62 rather than a half split: the left column is a standfirst, and
          giving it equal weight would make the page look like a comparison
          table. items-start so the editorial column stays at the top rather
          than centring itself against a grid that is taller than it. */}
      <div className="grid gap-12 lg:gap-20 lg:grid-cols-[38fr_62fr] items-start">
        <div className="lg:sticky lg:top-28">{header}</div>
        {grid}
      </div>

      {/* The piece itself, opened in place. A 62ch measure and 1.75 line
          height, and a way out at the bottom that says so rather than
          collapsing silently, so nobody feels held inside it. */}
      {opened && (
        <article
          id={`${uid}-article`}
          className="rounded-2xl border border-[#ECE1D3] bg-white px-6 sm:px-10 py-8 sm:py-10 space-y-7"
        >
          <header className="space-y-2">
            <h3 className="font-serif text-[1.5rem] leading-[1.25] text-[#3A2A1E]">
              {opened.title}
            </h3>
            <p className="max-w-[62ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
              {opened.summary}
            </p>
            <p className="text-[0.75rem] tracking-[0.06em] text-[#6B5B4C]">
              {opened.minutes} min read
            </p>
          </header>

          <div className="border-t border-[#F1E7DA] pt-7 space-y-7">
            {opened.sections.map((section) => (
              <section key={section.heading} className="space-y-2 max-w-[62ch]">
                <h4 className="reading-subhead text-[0.9375rem] text-[#3A2A1E]">
                  {section.heading}
                </h4>
                <p className="text-[1.0625rem] leading-[1.75] text-[#5A4636]">{section.body}</p>
              </section>
            ))}

            <p className="max-w-[62ch] border-l-2 border-[#D9A877] pl-5 font-serif text-[1.125rem] leading-[1.6] text-[#3A2A1E]">
              {opened.takeaway}
            </p>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="inline-flex min-h-[44px] items-center gap-2 px-1 text-[0.8125rem] font-semibold text-[#6B5B4C] hover:text-[#3A2A1E] transition-colors cursor-pointer"
              >
                <Minus size={14} aria-hidden="true" />
                Close reading
              </button>
            </div>
          </div>
        </article>
      )}

      {children}
    </div>
  );
};

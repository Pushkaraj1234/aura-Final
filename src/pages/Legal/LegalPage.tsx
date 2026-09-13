import React from "react";
import { ArrowLeft } from "lucide-react";
import { CONTACT_EMAIL, LAST_UPDATED, OPERATOR_NAME } from "./legalMeta";

/**
 * The one address a reader is told to write to. When the operator has not
 * published one yet, this says so and points at the routes that do exist,
 * rather than printing an address nobody reads.
 */
export const ContactDetails: React.FC = () =>
  CONTACT_EMAIL ? (
    <p>
      Write to <strong>{OPERATOR_NAME}</strong> at{" "}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#A85D2E] hover:text-[#8A4A20] underline">
        {CONTACT_EMAIL}
      </a>
      . If you would rather not write, your counsellor can raise it for you.
    </p>
  ) : (
    <p>
      <strong>{OPERATOR_NAME}</strong> has not published a written contact address for this
      deployment yet. Until it does, ask your counsellor, or the organisation that gave you
      access to AURA, and they will pass it on.
    </p>
  );

export interface LegalSection {
  id: string;
  heading: string;
  body: React.ReactNode;
}

interface Props {
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  /** The other legal document, linked at the foot of this one. */
  sibling: { href: string; label: string };
}

/**
 * Shared chrome for the two legal documents. They are served from real paths
 * (/privacy-policy, /terms) rather than from App's view state, so a link to
 * either one survives being copied into an email or an app store listing.
 */
export const LegalPage: React.FC<Props> = ({ title, intro, sections, sibling }) => (
  <div className="min-h-screen">
    <header className="border-b border-[#ECE1D3] bg-[#FDFAF4]/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2.5 min-w-0">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" className="shrink-0">
            <rect width="32" height="32" rx="7" fill="#3A2A1E" />
            <path
              d="M23.07 7.57A11 11 0 1 1 14.09 5.17"
              fill="none"
              stroke="#DBC3B2"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="16" cy="16" r="4.4" fill="#FDFAF4" />
          </svg>
          <span className="font-semibold tracking-tight text-[#3A2A1E]">AURA</span>
        </a>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8A7A6B] hover:text-[#3A2A1E] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to AURA</span>
        </a>
      </div>
    </header>

    <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A85D2E]">
        Last updated {LAST_UPDATED}
      </p>
      <h1 className="text-3xl sm:text-4xl text-[#3A2A1E] mt-2">{title}</h1>
      <div className="mt-5 text-[15px] leading-relaxed text-[#5A4636] space-y-4">{intro}</div>

      <nav aria-label="On this page" className="mt-9 rounded-2xl border border-[#ECE1D3] bg-[#FDFAF4] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8A7A6B]">On this page</p>
        <ol className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {sections.map((section, i) => (
            <li key={section.id} className="flex gap-2">
              <span className="font-mono text-xs text-[#A99A8A] pt-0.5 tabular-nums">{i + 1}.</span>
              <a href={`#${section.id}`} className="text-[#5A4636] hover:text-[#A85D2E] transition-colors">
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-9">
        {sections.map((section, i) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="text-xl sm:text-2xl text-[#3A2A1E] flex items-baseline gap-3">
              <span className="font-mono text-sm text-[#A99A8A] tabular-nums">{i + 1}</span>
              <span>{section.heading}</span>
            </h2>
            <div className="mt-3 text-[15px] leading-relaxed text-[#5A4636] space-y-3.5 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_strong]:text-[#3A2A1E] [&_strong]:font-semibold">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </main>

    <footer className="border-t border-[#ECE1D3] mt-6">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
        <a href={sibling.href} className="font-semibold text-[#A85D2E] hover:text-[#8A4A20] transition-colors">
          {sibling.label}
        </a>
        <a href="/" className="text-[#8A7A6B] hover:text-[#3A2A1E] transition-colors">
          Return to AURA
        </a>
      </div>
    </footer>
  </div>
);

import React, { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  ChoiceList,
  ErrorNote,
  OfficialLink,
  OfficialSiteNotice,
  SaveButton,
} from "../../components/Recovery/RecoveryPrimitives";
import { explainMatch, matchResources, officialResource } from "../../services/officialResources";
import {
  buildChecklist,
  DOCUMENT_LABELS,
  FINANCIAL_IMPACT_LABELS,
} from "../../services/recoveryHub";
import type {
  DocumentType,
  FinancialImpactType,
  ImpactType,
  IncidentCategory,
  PriorAssistance,
} from "../../types/recovery";

/**
 * Financial recovery.
 *
 * THE SENTENCE THIS WHOLE SCREEN IS BUILT AROUND
 *
 * "This resource may be relevant based on the information you've provided.
 * Final eligibility is determined by the relevant authority."
 *
 * It is not a disclaimer tucked under the fold. Matching is done on what a
 * person ticked, against schemes whose actual rules involve caste
 * certification, medical boards, FIR registration under specific statutes and
 * district-level discretion, none of which this app can evaluate and none of
 * which it should pretend to. The cost of being wrong in the optimistic
 * direction is somebody counting on money that is not coming.
 *
 * So the page shows what is worth reading, and never what someone will get.
 */

interface Props {
  financialImpacts: FinancialImpactType[];
  priorAssistance?: PriorAssistance;
  incidentCategory?: IncidentCategory;
  /** What the checklist already knows, so this screen can show what changes. */
  incidentImpacts: ImpactType[];
  district?: string;
  hasFir?: boolean | null;
  heldDocTypes: DocumentType[];
  state?: string;
  language: string;
  busy: boolean;
  error: string | null;
  onSave: (patch: {
    financialImpacts: FinancialImpactType[];
    priorAssistance?: PriorAssistance;
  }) => Promise<void>;
  onBack: () => void;
}

export const RecoveryFinancialScreen: React.FC<Props> = ({
  financialImpacts,
  priorAssistance,
  incidentCategory,
  incidentImpacts,
  district,
  hasFir,
  heldDocTypes,
  state,
  language,
  busy,
  error,
  onSave,
  onBack,
}) => {
  const [impacts, setImpacts] = useState<FinancialImpactType[]>(financialImpacts);
  const [prior, setPrior] = useState<PriorAssistance[]>(
    priorAssistance ? [priorAssistance] : []
  );

  const trackResource = officialResource("nalsa_track_application")!;
  const ctx = { state, category: incidentCategory, financialImpacts: impacts };
  const compensation = matchResources(ctx, "compensation");
  const stateSchemes = matchResources(ctx, "state_scheme");
  const anyMatched = compensation.length + stateSchemes.length > 0;

  /**
   * What ticking these boxes actually changes in the document checklist.
   *
   * Computed by running the real checklist twice, with and without the current
   * selection, and diffing. Not a hand-maintained list, which would drift from
   * the rule it is describing the moment either changed.
   */
  const addedDocs = useMemo(() => {
    const base = {
      category: incidentCategory,
      impacts: incidentImpacts,
      hasFir,
      heldDocTypes,
    };
    const without = buildChecklist({ ...base, financialImpacts: [] }).items.map((i) => i.docType);
    return buildChecklist({
      ...base,
      financialImpacts: impacts,
      priorAssistance: prior[0],
    })
      .items.map((i) => i.docType)
      .filter((d) => !without.includes(d));
  }, [impacts, prior, incidentCategory, incidentImpacts, hasFir, heldDocTypes]);

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-[#8A4A20]">
          Financial recovery
        </span>
        <h1 className="text-[1.75rem] sm:text-[2.125rem] leading-[1.15] text-[#3A2A1E]">
          What support may apply
        </h1>
        <p className="max-w-[58ch] text-[1rem] leading-[1.7] text-[#6B5B4C]">
          Let&rsquo;s explore financial assistance and compensation pathways
          that may be relevant to your situation.
        </p>
      </header>

      <section className="card-elev space-y-6 rounded-2xl p-5 sm:p-6">
        <ChoiceList<FinancialImpactType>
          legend="What financial impact have you experienced?"
          hint="Choose as many as apply. You can change this whenever you like."
          choices={(Object.keys(FINANCIAL_IMPACT_LABELS) as FinancialImpactType[]).map(
            (k) => ({ value: k, label: FINANCIAL_IMPACT_LABELS[k] })
          )}
          selected={impacts}
          onChange={setImpacts}
          multiple
        />

        <ChoiceList<PriorAssistance>
          legend="Have you already received financial assistance?"
          choices={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "unsure", label: "I'm not sure" },
          ]}
          selected={prior}
          onChange={setPrior}
        />

        {error && <ErrorNote message={error} />}

        <SaveButton
          disabled={busy}
          label="Save and see what may apply"
          onSave={() => onSave({ financialImpacts: impacts, priorAssistance: prior[0] })}
        />
      </section>

      {/* What the answers above just changed. Directly under the questions,
          not below the resource list: an answer whose consequence renders
          two thousand pixels further down is an answer that looks like it
          did nothing, which is exactly how this read before. */}
      {/* Each of the three answers has to lead somewhere different, or the
          question is decoration. Yes adds a document an office will ask for;
          not sure gets a way to find out; no says plainly that nothing
          further is needed, rather than going silent. */}
      {prior[0] === "yes" && (
        <div className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-4 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          <p className="font-semibold text-[#3A2A1E]">
            We&rsquo;ve added one thing to your document checklist
          </p>
          <p className="mt-1.5">
            A record of what you already received. Applications usually ask,
            and under the atrocity provisions relief is released in stages, so
            the earlier sanction order shows which stage you are at. The
            office that paid it can give you a copy, and a bank statement
            showing the credit also works.
          </p>
          <p className="mt-2">
            Whether an earlier payment affects a new application is decided by
            the authority handling it, not here. Mention it when you apply.
          </p>
        </div>
      )}

      {prior[0] === "unsure" && (
        <div className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-4 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          <p className="font-semibold text-[#3A2A1E]">How to find out</p>
          <p className="mt-1.5">
            Money is sometimes sanctioned to a family without the person it
            concerns being told directly, so not knowing is common. Two places
            can tell you: the District Legal Services Authority, if any victim
            compensation was ordered; and, for an atrocity
            case, the Assistant Commissioner of Social Welfare for{" "}
            {district || "your district"}. Your FIR number is what they will
            ask for.
          </p>
          <p className="mt-2">
            Once you know, change this answer and we&rsquo;ll update your
            checklist.
          </p>
          <div className="mt-3">
            <OfficialLink resource={trackResource} language={language} compact />
          </div>
        </div>
      )}

      {prior[0] === "no" && (
        <p className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          Nothing further needed on that, then. If something comes through
          later, change this answer and we&rsquo;ll add the record to your
          checklist.
        </p>
      )}

      {addedDocs.length > 0 && (
        <div className="rounded-2xl border border-[#E6D3BC] bg-[#F3E7D8] px-4 py-4 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          <p className="font-semibold text-[#3A2A1E]">
            What your answers changed
          </p>
          <p className="mt-1.5">
            Because of what you&rsquo;ve selected, your document checklist now
            asks for:
          </p>
          <ul className="mt-2 space-y-1">
            {addedDocs.map((d) => (
              <li key={d} className="text-[#3A2A1E]">
                {DOCUMENT_LABELS[d]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state && state !== "Maharashtra" && (
        <p className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
          The national routes above apply across India. {state} also runs its
          own schemes, and we don&rsquo;t yet have checked links for them.
          Rather than send you to an address we haven&rsquo;t verified, we
          would rather say so: your State Legal Services Authority can point
          you to them.
        </p>
      )}

      {/* Matching ----------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="font-serif text-[1.3125rem] leading-[1.3] text-[#3A2A1E]">
          Potential support resources
        </h2>

        {/* The qualification, placed above the list rather than below it. A
            person who reads three scheme names and then a caveat has already
            formed the belief the caveat is meant to prevent. */}
        <p className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.9375rem] leading-[1.7] text-[#6B5B4C]">
          These may be relevant based on the information you&rsquo;ve provided.
          Final eligibility is determined by the relevant authority, not by
          AURA. Reading about one costs nothing and rules out nothing.
        </p>

        {!anyMatched ? (
          <p className="rounded-2xl border border-dashed border-[#E0D4C3] bg-[#FDFAF4] px-5 py-8 text-center text-[0.9375rem] leading-[1.6] text-[#6B5B4C]">
            Tell us a little about the financial impact above and we&rsquo;ll
            show which pathways are worth reading about.
          </p>
        ) : (
          <>
            <OfficialSiteNotice />
            {compensation.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[0.75rem] uppercase tracking-[0.12em] text-[#7A6A5A]">
                  Victim compensation
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {compensation.map((r) => (
                    <OfficialLink
                      key={r.key}
                      resource={r}
                      language={language}
                      reason={explainMatch(r, ctx)}
                    />
                  ))}
                </div>
              </div>
            )}
            {stateSchemes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[0.75rem] uppercase tracking-[0.12em] text-[#7A6A5A]">
                  {state} schemes
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {stateSchemes.map((r) => (
                    <OfficialLink
                      key={r.key}
                      resource={r}
                      language={language}
                      reason={explainMatch(r, ctx)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </section>

      <button onClick={onBack} className="btn-ghost px-5 py-3 text-[0.9375rem]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to my recovery
      </button>
    </div>
  );
};

import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  ChoiceList,
  ErrorNote,
  OfficialLink,
  OfficialSiteNotice,
  SaveButton,
} from "../../components/Recovery/RecoveryPrimitives";
import { matchResources } from "../../services/officialResources";
import { FINANCIAL_IMPACT_LABELS } from "../../services/recoveryHub";
import type {
  FinancialImpactType,
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

  const ctx = { state, category: incidentCategory, financialImpacts: impacts };
  const compensation = matchResources(ctx, "compensation");
  const stateSchemes = matchResources(ctx, "state_scheme");
  const anyMatched = compensation.length + stateSchemes.length > 0;

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
                    <OfficialLink key={r.key} resource={r} language={language} />
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
                    <OfficialLink key={r.key} resource={r} language={language} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {prior[0] === "yes" && (
          <p className="rounded-2xl border border-[#E8DFD2] bg-[#F7F2E9] px-4 py-3.5 text-[0.875rem] leading-[1.7] text-[#6B5B4C]">
            You said you&rsquo;ve already received some assistance. Some schemes
            take earlier payments into account and some do not, and the
            authority handling your application is the one who can tell you how
            it works in your case. It is worth mentioning when you apply.
          </p>
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
      </section>

      <button onClick={onBack} className="btn-ghost px-5 py-3 text-[0.9375rem]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to my recovery
      </button>
    </div>
  );
};

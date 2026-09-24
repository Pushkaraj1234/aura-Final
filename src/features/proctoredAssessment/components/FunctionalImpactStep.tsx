import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { FUNCTIONAL_IMPACT_DOMAINS } from '../data/assessmentQuestions';
import { StepHeader } from './StepHeader';

interface FunctionalImpactStepProps {
  functionalResponses: Record<string, number>;
  onSaveResponse: (domainId: string, val: number) => void;
  onComplete: () => void;
  onBack: () => void;
}

const IMPACT_LEVELS = [
  { value: 0, label: 'None', desc: 'No effect on this' },
  { value: 1, label: 'Mild', desc: 'A little harder than usual' },
  { value: 2, label: 'Moderate', desc: 'Noticeably harder' },
  { value: 3, label: 'Severe', desc: 'Often unable to manage' },
  { value: 4, label: 'Extreme', desc: 'Unable to manage at all' },
];

export const FunctionalImpactStep: React.FC<FunctionalImpactStepProps> = ({
  functionalResponses,
  onSaveResponse,
  onComplete,
  onBack,
}) => {
  const isAllAnswered = FUNCTIONAL_IMPACT_DOMAINS.every((d) => functionalResponses[d.id] !== undefined);

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <StepHeader step={7} title="Daily life">
        Over the past month, how much have these reactions affected each part of your life? This is recorded
        separately from your questionnaire score.
      </StepHeader>

      <div className="mb-6 divide-y divide-stone-200 border-t border-stone-200">
        {FUNCTIONAL_IMPACT_DOMAINS.map((domain) => {
          const currentValue = functionalResponses[domain.id];
          const headingId = `domain-${domain.id}`;
          return (
            <fieldset key={domain.id} className="py-5" aria-labelledby={headingId}>
              <div className="mb-3">
                <p id={headingId} className="text-sm font-semibold text-stone-900">
                  {domain.domain}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">{domain.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {IMPACT_LEVELS.map((level) => {
                  const isSelected = currentValue === level.value;
                  return (
                    <button
                      type="button"
                      key={level.value}
                      aria-pressed={isSelected}
                      onClick={() => onSaveResponse(domain.id, level.value)}
                      className={`flex flex-col items-center justify-center rounded-lg border px-2 py-2.5 text-center transition-colors ${
                        isSelected
                          ? 'border-teal-800 bg-teal-800 text-white'
                          : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-100'
                      }`}
                    >
                      <span className="text-sm font-medium">{level.label}</span>
                      <span className={`mt-0.5 text-[11px] leading-tight ${isSelected ? 'text-teal-100' : 'text-stone-500'}`}>
                        {level.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-stone-200 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </button>

        <button
          type="button"
          disabled={!isAllAnswered}
          onClick={onComplete}
          id="proceed-to-interview-btn"
          className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

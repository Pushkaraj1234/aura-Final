import React, { useState } from 'react';
import { Check, ArrowLeft } from 'lucide-react';
import { LEC5_EVENTS } from '../data/assessmentQuestions';
import { StepHeader } from './StepHeader';

export interface TraumaExposureData {
  hasExposure: boolean;
  selectedEvents: string[];
  indexTrauma: string;
  preferNotToSpecify: boolean;
}

interface TraumaExposureStepProps {
  onComplete: (traumaData: TraumaExposureData) => void;
  onBack: () => void;
  /** Answers from an earlier visit, so going back never makes the person answer again */
  initialData?: TraumaExposureData | null;
}

const PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_DESCRIBE';
const NOT_SURE = 'NOT_SURE';
const NOT_SURE_LABEL = 'More than one experience';

const initialIndexChoice = (data?: TraumaExposureData | null) => {
  if (!data?.hasExposure) return '';
  if (data.preferNotToSpecify) return PREFER_NOT_TO_SAY;
  if (data.indexTrauma === NOT_SURE_LABEL) return NOT_SURE;
  return LEC5_EVENTS.some((e) => e.category === data.indexTrauma) ? data.indexTrauma : '';
};

const primaryButton =
  'rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50';
const backButton = 'flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900';

const CheckboxRow: React.FC<{
  checked: boolean;
  onToggle: () => void;
  title: string;
  description: string;
}> = ({ checked, onToggle, title, description }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={onToggle}
    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
      checked ? 'border-teal-700 bg-teal-50/70' : 'border-stone-200 hover:bg-stone-50'
    }`}
  >
    <span
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
        checked ? 'border-teal-700 bg-teal-700 text-white' : 'border-stone-300 bg-white'
      }`}
      aria-hidden="true"
    >
      {checked && <Check className="h-3 w-3 stroke-[3]" />}
    </span>
    <span>
      <span className="block text-sm font-medium text-stone-900">{title}</span>
      <span className="block text-xs leading-relaxed text-stone-500">{description}</span>
    </span>
  </button>
);

export const TraumaExposureStep: React.FC<TraumaExposureStepProps> = ({ onComplete, onBack, initialData }) => {
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(initialData?.selectedEvents ?? []);
  const [noExposureEndorsed, setNoExposureEndorsed] = useState<boolean>(initialData ? !initialData.hasExposure : false);
  const [indexTraumaChoice, setIndexTraumaChoice] = useState<string>(() => initialIndexChoice(initialData));
  const [isSpecifyingIndex, setIsSpecifyingIndex] = useState<boolean>(false);

  const toggleEvent = (id: string) => {
    setNoExposureEndorsed(false);
    setSelectedEventIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleNone = () => {
    setNoExposureEndorsed((prev) => !prev);
    setSelectedEventIds([]);
    setIsSpecifyingIndex(false);
  };

  const handleProceedFromExposure = () => {
    if (noExposureEndorsed) {
      onComplete({
        hasExposure: false,
        selectedEvents: [],
        indexTrauma: 'No specific event reported',
        preferNotToSpecify: false,
      });
    } else if (selectedEventIds.length > 0) {
      setIsSpecifyingIndex(true);
    }
  };

  const handleFinalIndexSubmit = () => {
    const indexLabel =
      indexTraumaChoice === PREFER_NOT_TO_SAY
        ? 'Not specified'
        : indexTraumaChoice === NOT_SURE
        ? NOT_SURE_LABEL
        : indexTraumaChoice || 'A stressful experience';

    onComplete({
      hasExposure: true,
      selectedEvents: selectedEventIds,
      indexTrauma: indexLabel,
      preferNotToSpecify: indexTraumaChoice === PREFER_NOT_TO_SAY,
    });
  };

  if (isSpecifyingIndex) {
    const options = [
      ...LEC5_EVENTS.filter((e) => selectedEventIds.includes(e.id)).map((e) => ({
        value: e.category,
        label: e.category,
      })),
      { value: NOT_SURE, label: "I'm not sure, or more than one" },
      { value: PREFER_NOT_TO_SAY, label: "I'd prefer not to say" },
    ];

    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <StepHeader step={4} title="Which experience should the questions refer to?">
          The next questions ask about "the stressful experience". Choose the one that affects you most. You won't
          be asked to describe what happened.
        </StepHeader>

        <fieldset className="mb-6 space-y-2.5">
          <legend className="sr-only">Experience to focus on</legend>
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                indexTraumaChoice === opt.value ? 'border-teal-700 bg-teal-50/70' : 'border-stone-200 hover:bg-stone-50'
              }`}
            >
              <input
                type="radio"
                name="indexTrauma"
                value={opt.value}
                checked={indexTraumaChoice === opt.value}
                onChange={() => setIndexTraumaChoice(opt.value)}
                className="h-4 w-4 text-teal-700 focus:ring-teal-600"
              />
              <span className="text-sm text-stone-800">{opt.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="flex items-center justify-between border-t border-stone-200 pt-5">
          <button type="button" onClick={() => setIsSpecifyingIndex(false)} className={backButton}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
          </button>
          <button type="button" onClick={handleFinalIndexSubmit} id="confirm-index-trauma-btn" className={primaryButton}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <StepHeader step={4} title="Life events">
        Select any of these that you have experienced, witnessed, or learned happened to someone close to you. This
        list only gives context for the questions that follow. It isn't scored.
      </StepHeader>

      <div className="mb-6 space-y-2" role="group" aria-label="Life events">
        {LEC5_EVENTS.map((event) => (
          <CheckboxRow
            key={event.id}
            checked={selectedEventIds.includes(event.id)}
            onToggle={() => toggleEvent(event.id)}
            title={event.category}
            description={event.description}
          />
        ))}

        <div className="pt-2">
          <CheckboxRow
            checked={noExposureEndorsed}
            onToggle={handleNone}
            title="None of these apply to me"
            description="I haven't experienced or witnessed any of these events."
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-stone-200 pt-5">
        <button type="button" onClick={onBack} className={backButton}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </button>
        <button
          type="button"
          disabled={selectedEventIds.length === 0 && !noExposureEndorsed}
          onClick={handleProceedFromExposure}
          id="proceed-exposure-btn"
          className={primaryButton}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

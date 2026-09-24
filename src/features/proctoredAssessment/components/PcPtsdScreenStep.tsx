import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PC_PTSD_5_QUESTIONS } from '../data/assessmentQuestions';
import { StepHeader } from './StepHeader';

interface PcPtsdScreenStepProps {
  onComplete: (answers: Record<number, boolean>, score: number) => void;
  onBack: () => void;
  initialAnswers?: Record<number, boolean>;
}

export const PcPtsdScreenStep: React.FC<PcPtsdScreenStepProps> = ({ onComplete, onBack, initialAnswers }) => {
  const [answers, setAnswers] = useState<Record<number, boolean>>(initialAnswers ?? {});

  const setAnswer = (id: number, val: boolean) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  };

  const isAllAnswered = PC_PTSD_5_QUESTIONS.every((q) => answers[q.id] !== undefined);

  const handleSubmit = () => {
    const score = Object.values(answers).filter(Boolean).length;
    onComplete(answers, score);
  };

  const choiceClass = (selected: boolean) =>
    `rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
      selected ? 'border-teal-800 bg-teal-800 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
    }`;

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <StepHeader step={5} title="A few quick questions">
        Five yes-or-no questions about the past month (the PC-PTSD-5). Whatever you answer, you'll continue to the
        full questionnaire next.
      </StepHeader>

      <ol className="mb-6 divide-y divide-stone-200 border-t border-stone-200">
        {PC_PTSD_5_QUESTIONS.map((q, idx) => {
          const currentAnswer = answers[q.id];
          return (
            <li key={q.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex-1">
                <span className="mb-1 block text-xs text-stone-500">Question {idx + 1} of 5</span>
                <p id={`pcptsd-${q.id}`} className="text-sm leading-relaxed text-stone-900" data-no-translate>
                  {q.text}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2" role="group" aria-labelledby={`pcptsd-${q.id}`}>
                <button
                  type="button"
                  aria-pressed={currentAnswer === true}
                  onClick={() => setAnswer(q.id, true)}
                  className={choiceClass(currentAnswer === true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  aria-pressed={currentAnswer === false}
                  onClick={() => setAnswer(q.id, false)}
                  className={choiceClass(currentAnswer === false)}
                >
                  No
                </button>
              </div>
            </li>
          );
        })}
      </ol>

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
          onClick={handleSubmit}
          id="submit-pc-ptsd-btn"
          className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

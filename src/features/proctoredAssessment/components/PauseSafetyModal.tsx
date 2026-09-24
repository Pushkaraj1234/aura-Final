import React, { useState, useEffect, useRef } from 'react';
import { CRISIS_SUPPORT_RESOURCES } from '../data/assessmentQuestions';

interface PauseSafetyModalProps {
  isOpen: boolean;
  onResume: () => void;
  onExit: () => void;
}

const PHASE_LABELS = { Inhale: 'Breathe in', Hold: 'Hold', Exhale: 'Breathe out' } as const;

export const PauseSafetyModal: React.FC<PauseSafetyModalProps> = ({ isOpen, onResume, onExit }) => {
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [breathCount, setBreathCount] = useState(4);
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null);

  // 4-7-8 breathing rhythm
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setBreathCount((prev) => {
        if (prev > 1) return prev - 1;

        if (breathPhase === 'Inhale') {
          setBreathPhase('Hold');
          return 7;
        } else if (breathPhase === 'Hold') {
          setBreathPhase('Exhale');
          return 8;
        } else {
          setBreathPhase('Inhale');
          return 4;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, breathPhase]);

  useEffect(() => {
    if (!isOpen) return;
    setBreathPhase('Inhale');
    setBreathCount(4);
    resumeButtonRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 animate-fadeIn">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
      >
        <h2 id="pause-title" className="text-xl font-semibold text-stone-900">
          Take your time
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          Your answers so far are saved. Come back to the questions whenever you're ready.
        </p>

        <div className="my-6 flex flex-col items-center rounded-xl bg-teal-50 px-6 py-8">
          <div
            className={`flex h-28 w-28 items-center justify-center rounded-full bg-teal-700 text-white transition-transform duration-1000 ease-in-out ${
              breathPhase === 'Inhale' ? 'scale-110' : breathPhase === 'Hold' ? 'scale-110' : 'scale-90'
            }`}
            aria-hidden="true"
          >
            <span className="text-3xl font-semibold tabular-nums">{breathCount}</span>
          </div>
          <p className="mt-4 text-sm font-medium text-teal-900" aria-live="polite">
            {PHASE_LABELS[breathPhase]}
          </p>
          <p className="mt-1 text-xs text-teal-800">In for 4, hold for 7, out for 8. Repeat as often as you like.</p>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-stone-800">If you need to talk to someone</p>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {CRISIS_SUPPORT_RESOURCES.slice(0, 2).map((res) => (
              <li key={res.name} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium text-stone-900">{res.name}</p>
                  <p className="text-xs text-stone-500">{res.details}</p>
                </div>
                <p className="shrink-0 font-semibold text-teal-800">{res.contact}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            ref={resumeButtonRef}
            type="button"
            onClick={onResume}
            id="resume-assessment-btn"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onExit}
            id="exit-assessment-btn"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
          >
            Save and exit
          </button>
        </div>
      </div>
    </div>
  );
};

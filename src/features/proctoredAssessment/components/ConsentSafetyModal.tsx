import React, { useState } from 'react';
import { Camera, Mic, ClipboardList, Pause, AlertCircle } from 'lucide-react';
import { StepHeader } from './StepHeader';

interface ConsentSafetyModalProps {
  onAccept: (consentData: {
    participantId: string;
    acceptedAt: string;
    researchConsent: boolean;
  }) => void;
  onOpenCrisis: () => void;
}

const WHAT_TO_EXPECT = [
  {
    icon: Camera,
    title: 'Camera',
    text: "Used to confirm that you're present and on your own. Video is analyzed in your browser and never recorded. Your expressions are never used to score you.",
  },
  {
    icon: Mic,
    title: 'Microphone',
    text: 'Used for optional voice answers and to notice background noise. Your voice is never analyzed for emotion or used in scoring.',
  },
  {
    icon: ClipboardList,
    title: 'Scoring',
    text: 'Your score comes directly from your answers to the PCL-5 questionnaire (0 to 80). It is never generated or changed by AI.',
  },
  {
    icon: Pause,
    title: 'Your control',
    text: 'You can pause, skip the optional parts, or stop at any time. Your answers are saved as you go.',
  },
];

export const ConsentSafetyModal: React.FC<ConsentSafetyModalProps> = ({ onAccept, onOpenCrisis }) => {
  const [participantId, setParticipantId] = useState(
    () => `AURA-USER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  );
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedSafety, setAgreedSafety] = useState(false);
  const [researchConsent, setResearchConsent] = useState(true);

  const canProceed = agreedPrivacy && agreedSafety && participantId.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) return;
    onAccept({
      participantId: participantId.trim(),
      acceptedAt: new Date().toISOString(),
      researchConsent,
    });
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <StepHeader step={1} title="Before you begin">
        This screening looks at how a stressful or traumatic experience may be affecting you, using standard
        clinical questionnaires. Please read how the session works before you start.
      </StepHeader>

      <dl className="mb-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {WHAT_TO_EXPECT.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <dt className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
              {title}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-stone-600">{text}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="text-sm text-stone-700">
          <p className="leading-relaxed">
            Some questions ask about difficult experiences. This is a screening, not a diagnosis. If you are in
            distress or thinking about harming yourself, please reach out for support now.
          </p>
          <button
            type="button"
            onClick={onOpenCrisis}
            className="mt-2 font-semibold text-teal-800 underline-offset-2 hover:underline"
          >
            Get crisis support (988)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="participant-id" className="mb-1 block text-sm font-medium text-stone-800">
            Participant ID
          </label>
          <input
            id="participant-id"
            type="text"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            aria-describedby="participant-id-help"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
            required
          />
          <p id="participant-id-help" className="mt-1 text-xs text-stone-500">
            A random ID that isn't linked to your name. If you were given an ID, you can enter it here.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="sr-only">Consent</legend>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
            />
            <span className="text-sm leading-relaxed text-stone-700">
              I agree to camera, microphone and window-focus monitoring during the assessment. I understand that
              video isn't saved and that my answers are kept confidentially for 30 days.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreedSafety}
              onChange={(e) => setAgreedSafety(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
            />
            <span className="text-sm leading-relaxed text-stone-700">
              I feel ready to begin, and I know I can pause, get support, or stop at any time.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={researchConsent}
              onChange={(e) => setResearchConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
            />
            <span className="text-sm leading-relaxed text-stone-600">
              Optional: include my anonymized answers in aggregate research on trauma care.
            </span>
          </label>
        </fieldset>

        <div className="flex justify-end border-t border-stone-200 pt-5">
          <button
            type="submit"
            disabled={!canProceed}
            id="proceed-to-device-check-btn"
            className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
};

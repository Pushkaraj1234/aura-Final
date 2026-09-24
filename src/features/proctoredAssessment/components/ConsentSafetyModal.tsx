import React, { useState } from 'react';
import { Camera, Mic, ClipboardList, Pause, AlertCircle } from 'lucide-react';
import { StepHeader } from './StepHeader';

interface ConsentSafetyModalProps {
  /** The signed-in participant's AURA record id; results are saved against it */
  participantId: string;
  onAccept: (consentData: { acceptedAt: string; researchConsent: boolean }) => void;
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
    text: "Used for optional voice answers and to notice background noise. Your voice is never analyzed for emotion or used in scoring. If you answer by voice, your browser's speech service turns it into text; in some browsers, such as Chrome, that happens on the browser maker's servers.",
  },
  {
    icon: ClipboardList,
    title: 'Scoring',
    text: 'Your score comes directly from your answers to the PCL-5 questionnaire (0 to 80). It is never generated or changed by AI.',
  },
  {
    icon: Pause,
    title: 'Your control',
    text: 'You can pause, skip the optional parts, or stop at any time. Nothing is saved to your AURA record unless you choose to save your results at the end.',
  },
];

export const ConsentSafetyModal: React.FC<ConsentSafetyModalProps> = ({ participantId, onAccept, onOpenCrisis }) => {
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedSafety, setAgreedSafety] = useState(false);
  // Research use is opt-in: an optional permission is never pre-ticked
  const [researchConsent, setResearchConsent] = useState(false);

  const canProceed = agreedPrivacy && agreedSafety;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) return;
    onAccept({
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
            Get crisis support (Tele MANAS 14416)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <p className="mb-1 block text-sm font-medium text-stone-800">Participant ID</p>
          <p
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900"
            data-no-translate
          >
            {participantId}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Your AURA participant ID. Your results are saved to your AURA record under this ID.
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
              I agree to camera, microphone and window-focus monitoring during this assessment only. I understand that
              video and audio are never recorded or saved, and that if I choose to save my results they are stored
              in my AURA record, where my counsellor can see them.
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

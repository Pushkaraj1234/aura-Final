import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, CheckCircle2, ArrowLeft, Check } from 'lucide-react';
import { PCL5_QUESTIONS, PCL5_RESPONSE_OPTIONS } from '../data/assessmentQuestions';
import { mapSpeechToPcl5Option } from '../utils/audioVision';
import { StepHeader } from './StepHeader';

interface Pcl5AssessmentStepProps {
  responses: Record<number, number>;
  onSaveResponse: (questionId: number, value: number) => void;
  onComplete: () => void;
  onBack: () => void;
  indexTraumaLabel: string;
}

export const Pcl5AssessmentStep: React.FC<Pcl5AssessmentStepProps> = ({
  responses,
  onSaveResponse,
  onComplete,
  onBack,
  indexTraumaLabel,
}) => {
  // Resume at the first unanswered question, or the last one when returning from a later step
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const firstUnanswered = PCL5_QUESTIONS.findIndex((q) => responses[q.id] === undefined);
    return firstUnanswered === -1 ? PCL5_QUESTIONS.length - 1 : firstUnanswered;
  });
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechConfirmation, setSpeechConfirmation] = useState<{
    value: number;
    label: string;
  } | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSpeakingItem, setIsSpeakingItem] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const currentQuestion = PCL5_QUESTIONS[currentIndex];
  const currentValue = responses[currentQuestion.id];
  const isLastQuestion = currentIndex === PCL5_QUESTIONS.length - 1;

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const mapped = mapSpeechToPcl5Option(transcript);
        if (mapped) {
          setSpeechConfirmation(mapped);
        } else {
          setSpeechError(
            `We heard "${transcript}". Please say one of: not at all, a little bit, moderately, quite a bit, or extremely.`
          );
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setSpeechError('Voice input stopped working. You can select an answer instead.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startVoiceInput = () => {
    if (!recognitionRef.current) {
      setSpeechError("Voice answers aren't supported in this browser. Please select an answer.");
      return;
    }
    setSpeechConfirmation(null);
    setSpeechError(null);
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn(e);
    }
  };

  const readQuestionAloud = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (isSpeakingItem) {
      setIsSpeakingItem(false);
      return;
    }

    const textToSpeak = `In the past month, how much were you bothered by: ${currentQuestion.text}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.9; // Calm, deliberate pacing
    utterance.onend = () => setIsSpeakingItem(false);
    utterance.onerror = () => setIsSpeakingItem(false);

    setIsSpeakingItem(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSelectOption = (val: number) => {
    onSaveResponse(currentQuestion.id, val);
    setSpeechConfirmation(null);
  };

  const resetVoiceState = () => {
    setSpeechConfirmation(null);
    setSpeechError(null);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeakingItem(false);
  };

  const handleNext = () => {
    if (currentValue === undefined) return;
    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
      resetVoiceState();
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      resetVoiceState();
    } else {
      onBack();
    }
  };

  const secondaryButton =
    'flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100';

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <StepHeader step={6} title="Symptom questionnaire">
        Twenty questions from the PCL-5. Answer based on the past month. There are no right or wrong answers.
      </StepHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
        <p className="text-sm text-stone-600">
          <span className="font-medium text-stone-900">Question {currentIndex + 1} of 20</span>
          <span className="text-stone-400"> · </span>
          {currentQuestion.clusterName}
        </p>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-stone-500" aria-live="polite">
            {currentValue !== undefined && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Answered
              </>
            )}
          </span>
          <button
            type="button"
            onClick={readQuestionAloud}
            aria-pressed={isSpeakingItem}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            {isSpeakingItem ? 'Stop reading' : 'Read aloud'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-1 text-sm text-stone-600">In the past month, how much were you bothered by:</p>
        {/* Not machine-translated, like the WHO-5 items: reworded items are not the PCL-5 any more */}
        <h2 id="pcl5-question" className="text-xl font-semibold leading-snug text-stone-900 sm:text-2xl" data-no-translate>
          {currentQuestion.text}
        </h2>
        {currentQuestion.subtext && (
          <p className="mt-2 text-sm leading-relaxed text-stone-500">{currentQuestion.subtext}</p>
        )}
        {indexTraumaLabel && (
          <p className="mt-3 text-xs text-stone-500">
            Thinking about: <span className="text-stone-700">{indexTraumaLabel}</span>
          </p>
        )}
      </div>

      {speechConfirmation && (
        <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm animate-fadeIn" role="status">
          <p className="mb-3 text-teal-950">
            We heard "{speechConfirmation.label}". Use this answer?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectOption(speechConfirmation.value)}
              className="rounded-lg bg-teal-800 px-3.5 py-1.5 font-semibold text-white transition hover:bg-teal-900"
            >
              Use this answer
            </button>
            <button
              type="button"
              onClick={() => setSpeechConfirmation(null)}
              className="rounded-lg border border-teal-200 bg-white px-3.5 py-1.5 font-medium text-teal-900 transition hover:bg-teal-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {speechError && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {speechError}
        </div>
      )}

      <div className="mb-8 space-y-2" role="radiogroup" aria-labelledby="pcl5-question">
        {PCL5_RESPONSE_OPTIONS.map((opt) => {
          const isSelected = currentValue === opt.value;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              key={opt.value}
              onClick={() => handleSelectOption(opt.value)}
              className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-colors ${
                isSelected ? 'border-teal-700 bg-teal-50/70 ring-1 ring-teal-700' : 'border-stone-200 hover:bg-stone-50'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isSelected ? 'bg-teal-800 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                  aria-hidden="true"
                >
                  {opt.value}
                </span>
                <span>
                  <span className="block text-sm font-medium text-stone-900" data-no-translate>
                    {opt.label}
                  </span>
                  <span className="block text-xs text-stone-500">{opt.description}</span>
                </span>
              </span>
              {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5">
        <button type="button" onClick={handlePrev} className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startVoiceInput}
            id="voice-answer-btn"
            aria-pressed={isListening}
            className={`${secondaryButton} ${isListening ? 'border-teal-600 bg-teal-50 text-teal-900' : ''}`}
          >
            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            {isListening ? 'Listening…' : 'Answer by voice'}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={currentValue === undefined}
            id="next-pcl5-item-btn"
            className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLastQuestion ? 'Finish questionnaire' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

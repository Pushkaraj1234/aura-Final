import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, ArrowLeft, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { StepHeader } from './StepHeader';

interface ContextualInterviewStepProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onComplete: () => void;
  onBack: () => void;
  indexTraumaLabel: string;
  isGeneratingReport?: boolean;
}

export const ContextualInterviewStep: React.FC<ContextualInterviewStepProps> = ({
  messages,
  onSendMessage,
  onComplete,
  onBack,
  isGeneratingReport = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Keep the newest message in view without scrolling the whole page
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  // Web Speech Recognition for voice input
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      setVoiceSupported(true);
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);
    try {
      await onSendMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <StepHeader step={8} title="Anything you'd like to add?">
        This part is optional. If you'd like, you can say more about how these experiences have affected you. It
        doesn't change your scores, and you can go straight to your results.
      </StepHeader>

      <div
        ref={transcriptRef}
        className="mb-4 h-72 space-y-3 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-4"
        role="log"
        aria-live="polite"
        aria-label="Conversation with Aura"
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.sender === 'user'
                  ? 'rounded-br-md bg-teal-800 text-white'
                  : 'rounded-bl-md border border-stone-200 bg-white text-stone-800'
              }`}
            >
              <span className="sr-only">{m.sender === 'user' ? 'You: ' : 'Aura: '}</span>
              {m.text}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-500">
              Aura is writing a reply…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="mb-6 flex items-center gap-2">
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoiceInput}
            aria-label={isListening ? 'Stop voice input' : 'Speak your message'}
            aria-pressed={isListening}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              isListening
                ? 'border-teal-600 bg-teal-50 text-teal-800'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
            }`}
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <label htmlFor="interview-input" className="sr-only">
          Your message
        </label>
        <input
          id="interview-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isListening ? 'Listening…' : 'Write a message'}
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-800 text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <div className="flex items-center justify-between border-t border-stone-200 pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={isGeneratingReport}
          className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 disabled:opacity-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </button>

        <button
          type="button"
          onClick={onComplete}
          disabled={isGeneratingReport}
          id="generate-final-report-btn"
          className="flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-70"
        >
          {isGeneratingReport && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isGeneratingReport ? 'Preparing your results…' : 'View results'}
        </button>
      </div>
    </div>
  );
};

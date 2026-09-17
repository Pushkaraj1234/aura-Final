import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Play, Pause, RotateCcw, Trash2, Edit3, Check, ChevronDown, ChevronUp, Shield, Cpu, Info, Volume2, FileText, Loader2 } from "lucide-react";
import { voiceRecordingService, AcousticDeliveryFeatures } from "../services/voiceRecording";
import { analyzeReflection } from "../services/reflectionAnalysis";
import { ReflectionAnalysis } from "./ReflectionAnalysis";
import { apiService } from "../services/apiService";
import { voiceRecordingStore } from "../services/voiceRecordings";
import { supabaseService } from "../services/supabaseService";
import { ParticipantReflection, VoiceToneAnalysisResult } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

interface VoiceRecorderProps {
  participantId: string;
  onSaveReflection: (reflection: ParticipantReflection | null) => void;
  onClearReflection: () => void;
  initialTranscript?: string;
  onSkip?: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  participantId,
  onSaveReflection,
  onClearReflection,
  initialTranscript = "",
  onSkip
}) => {
  /**
   * The two voice consents, read rather than assumed.
   *
   * Both were stored, shown on the consent screen, and never consulted: the
   * delivery analysis ran whatever "Measure how it was said" said, and "Keep
   * the recording afterwards" kept nothing either way. They are loaded here so
   * the switches decide what actually happens.
   *
   * Defaults are the cautious ones. If the preferences cannot be read, we
   * measure nothing and keep nothing, because guessing wrong in the other
   * direction means analysing or storing a person's voice they did not agree
   * to.
   */
  const [measureDelivery, setMeasureDelivery] = useState(false);
  const [keepRecording, setKeepRecording] = useState(false);
  const [keptRecording, setKeptRecording] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await supabaseService.consents.get(participantId);
        if (cancelled || !prefs) return;
        setMeasureDelivery(Boolean(prefs.voiceAcousticAnalysis));
        setKeepRecording(Boolean(prefs.voiceAudioRetention));
      } catch {
        /* the cautious defaults stand */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  // Mode & Recording State
  const [mode, setMode] = useState<"choice" | "voice" | "text">("choice");
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState(initialTranscript);
  const [interimText, setInterimText] = useState("");
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [shareWithWorker, setShareWithWorker] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemoSample, setIsDemoSample] = useState(false);

  // Vocal-delivery + tone analysis state
  const [acousticFeatures, setAcousticFeatures] = useState<AcousticDeliveryFeatures | null>(null);
  const [voiceToneResult, setVoiceToneResult] = useState<VoiceToneAnalysisResult | null>(null);
  const [isAnalyzingTone, setIsAnalyzingTone] = useState(false);
  const [voiceToneError, setVoiceToneError] = useState<string | null>(null);

  // Expandable info cards
  const [showWhyCard, setShowWhyCard] = useState(false);
  const [showHowItWorksCard, setShowHowItWorksCard] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Speech recognition compatibility check
  const isSpeechRecognitionSupported = voiceRecordingService.isSpeechRecognitionSupported();

  // Re-run dynamic analysis whenever transcript changes
  const analysisResult = analyzeReflection(transcript, isDemoSample);

  // Auto-sync reflection object to parent check-in
  useEffect(() => {
    if (transcript.trim().length > 0) {
      const refObj: ParticipantReflection = {
        id: `ref-${Date.now()}`,
        participantId,
        type: audioUrl ? "voice" : "text",
        transcript: transcript.trim(),
        timestamp: new Date().toISOString(),
        audioRecorded: !!audioUrl,
        shareWithWorker,
        sentiment: 'none',
        analysis: analysisResult,
        voiceToneAnalysis: voiceToneResult || undefined
      };
      onSaveReflection(refObj);
    } else {
      onSaveReflection(null);
    }
  }, [transcript, audioUrl, shareWithWorker, isDemoSample, voiceToneResult]);

  // Handle start voice trigger
  const handleInitiateVoice = () => {
    setShowPrivacyNotice(true);
  };

  const handleConfirmPrivacyStartRecording = async () => {
    setShowPrivacyNotice(false);
    setMode("voice");
    setIsRecording(true);
    setErrorMessage(null);
    setTranscript("");
    setInterimText("");
    setIsDemoSample(false);

    const started = await voiceRecordingService.startRecording(
      (finalText, interim) => {
        setTranscript(finalText);
        setInterimText(interim);
      },
      (seconds) => {
        setRecordingSeconds(seconds);
      },
      (err) => {
        setErrorMessage(err);
        setIsRecording(false);
      },
      { measureDelivery }
    );

    if (!started) {
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    const { audioUrl: url, audioBlob, acoustic } = await voiceRecordingService.stopRecording();
    setAudioUrl(url);
    setAcousticFeatures(acoustic);

    // Only now does "Keep the recording afterwards" mean anything. A failure
    // here never blocks the reflection: the person came to say something, not
    // to file an audio archive.
    setKeptRecording(false);
    if (keepRecording && audioBlob && audioBlob.size > 0) {
      const saved = await voiceRecordingStore.keep({
        blob: audioBlob,
        participantId,
        durationSeconds: acoustic.durationSeconds,
        transcript,
      });
      setKeptRecording(Boolean(saved));
    }

    // Derive speaking rate from the final transcript + measured duration, then
    // send the transcript + measured vocal-delivery numbers to the LLM so it can
    // reason about emotional tone from both together (not keyword matching).
    const wordCount = transcript.trim().length > 0 ? transcript.trim().split(/\s+/).length : 0;
    const minutes = Math.max(acoustic.durationSeconds / 60, 1 / 60);
    const speakingRateWpm = wordCount > 0 ? wordCount / minutes : 0;
    const featuresForAnalysis: AcousticDeliveryFeatures = { ...acoustic, speakingRateWpm };

    setVoiceToneResult(null);
    setVoiceToneError(null);
    setIsAnalyzingTone(true);
    try {
      const result = await apiService.ai.analyzeVoiceTone(transcript, featuresForAnalysis, participantId);
      setVoiceToneResult(result as VoiceToneAnalysisResult);
    } catch (err: any) {
      console.warn("Voice tone analysis unavailable:", err);
      setVoiceToneError("Voice tone analysis could not be completed right now. Your transcript is still here.");
    } finally {
      setIsAnalyzingTone(false);
    }
  };

  const handleTogglePlayAudio = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleRecordAgain = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioUrl(null);
    setIsPlayingAudio(false);
    setAcousticFeatures(null);
    setVoiceToneResult(null);
    setVoiceToneError(null);
    handleConfirmPrivacyStartRecording();
  };

  const handleDeleteRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    voiceRecordingService.cleanup();
    setAudioUrl(null);
    setIsPlayingAudio(false);
    setTranscript("");
    setInterimText("");
    setIsDemoSample(false);
    setAcousticFeatures(null);
    setVoiceToneResult(null);
    setVoiceToneError(null);
    onClearReflection();
  };

  // Demo synthetic sample loader (only for presenter / demo mode)
  const handleLoadDemoSample = () => {
    setMode("text");
    setIsDemoSample(true);
    setTranscript("I haven't been sleeping well since moving to the new shelter block. The nighttime noise makes me feel tense and overwhelmed.");
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Privacy Notice Modal/Banner */}
      {showPrivacyNotice && (
        <div className="p-5 rounded-2xl bg-[#FDF9F5] border-2 border-[#5A5049] space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center space-x-2 text-[#5A5049]">
            <Shield size={18} />
            <h4 className="text-sm font-black uppercase tracking-wide text-[#3C3530]">
              Before You Record
            </h4>
          </div>

          <ul className="text-xs text-[#7A726C] space-y-2 leading-relaxed">
            <li className="flex items-start space-x-2">
              <span className="text-[#5A5049] font-bold">•</span>
              <span>Your microphone will be active <strong>only while you choose to record</strong>.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#5A5049] font-bold">•</span>
              <span>You can pause, edit your transcript, re-record, or completely delete the audio at any time.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#5A5049] font-bold">•</span>
              <span>For this prototype, speech-to-text processing occurs in your browser.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#5A5049] font-bold">•</span>
              <span><strong>Privacy Reminder:</strong> Please do not include full names, exact shelter room numbers, or sensitive government IDs in your reflection.</span>
            </li>
          </ul>

          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleConfirmPrivacyStartRecording}
              className="px-5 py-2.5 rounded-xl bg-[#5A5049] hover:bg-[#3C3530] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-2"
            >
              <Mic size={14} />
              <span>I understand, start recording</span>
            </button>
            <button
              onClick={() => setShowPrivacyNotice(false)}
              className="px-4 py-2.5 rounded-xl border border-[#EFE8E2] bg-white text-[#7F8C8D] hover:text-[#3C3530] text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Interaction Area */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Mic size={16} className="text-[#5A5049]" />
            <span className="text-xs font-black uppercase text-[#3C3530]">
              Optional Reflection Input
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
            Optional • Voice or Text
          </span>
        </div>

        {/* Browser capability status */}
        {!isSpeechRecognitionSupported && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
            <Info size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <p>
              Live speech-to-text recognition is not supported in this browser. You can record audio directly or type your reflection below.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorMessage}
          </div>
        )}

        {/* Choice / Idle State */}
        {mode === "choice" && !transcript && (
          <div className="space-y-4">
            <p className="text-xs text-[#7A726C]">
              Choose how you would like to share your voluntary reflection:
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={handleInitiateVoice}
                className="p-4 rounded-2xl bg-white border border-[#EFE8E2] hover:border-[#5A5049] hover:bg-white text-left transition-all group cursor-pointer shadow-xs"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-[#5A5049] text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Mic size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#3C3530]">Start Voice Reflection</h5>
                    <span className="text-[10px] text-[#7F8C8D]">Speak naturally into microphone</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#7F8C8D]">
                  Audio is recorded locally with assistive transcription where supported.
                </p>
              </button>

              <button
                onClick={() => setMode("text")}
                className="p-4 rounded-2xl bg-white border border-[#EFE8E2] hover:border-[#5A5049] hover:bg-white text-left transition-all group cursor-pointer shadow-xs"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-[#DBC3B2]/40 text-[#3C3530] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#3C3530]">Type a Reflection</h5>
                    <span className="text-[10px] text-[#7F8C8D]">Write in your own words</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#7F8C8D]">
                  Enter free-form thoughts, feelings, or situational context.
                </p>
              </button>
            </div>

            {/* SIH Demonstration Helper */}
            <div className="pt-2 flex items-center justify-between border-t border-[#EFE8E2]">
              <span className="text-[10px] text-[#7F8C8D]">Presentation / Evaluator Tools:</span>
              <button
                onClick={handleLoadDemoSample}
                className="text-[11px] font-bold text-[#5A5049] hover:text-[#3C3530] bg-white border border-[#EFE8E2] px-3 py-1 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <span>Load Demo Sample Reflection</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Recording State */}
        {isRecording && (
          <div className="p-6 rounded-2xl bg-white border-2 border-[#5A5049] text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-[#A55D25] font-black text-xs uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span>● Recording... {formatTime(recordingSeconds)}</span>
            </div>

            {/* Audio Wave Visualizer Simulation */}
            <div className="flex items-center justify-center space-x-1.5 h-10">
              <span className="w-1.5 h-4 bg-[#5A5049] rounded-full animate-pulse"></span>
              <span className="w-1.5 h-8 bg-[#DBC3B2] rounded-full animate-bounce"></span>
              <span className="w-1.5 h-10 bg-[#5A5049] rounded-full animate-pulse"></span>
              <span className="w-1.5 h-6 bg-[#A55D25] rounded-full animate-bounce"></span>
              <span className="w-1.5 h-9 bg-[#5A5049] rounded-full animate-pulse"></span>
              <span className="w-1.5 h-5 bg-[#DBC3B2] rounded-full animate-bounce"></span>
              <span className="w-1.5 h-3 bg-[#5A5049] rounded-full animate-pulse"></span>
            </div>

            {/* Live Partial Transcript */}
            {(transcript || interimText) && (
              <div className="p-3 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2] text-left text-xs text-[#3C3530] max-h-24 overflow-y-auto">
                <span data-no-translate className="font-semibold">{transcript}</span>{" "}
                <span className="text-[#7F8C8D] italic">{interimText}</span>
              </div>
            )}

            <button
              onClick={handleStopRecording}
              className="px-6 py-2.5 rounded-xl bg-[#A55D25] hover:bg-[#c06e4f] text-white text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center space-x-2"
            >
              <Square size={13} />
              <span>Stop Recording</span>
            </button>
          </div>
        )}

        {/* Reviewing Recorded Voice or Typing */}
        {(transcript.length > 0 || mode === "text") && !isRecording && (
          <div className="space-y-4">
            {/* Demo Notice if synthetic sample */}
            {isDemoSample && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                <span className="font-bold flex items-center">
                  DEMO / SYNTHETIC DATA LOADED
                </span>
                <span className="text-[10px] uppercase font-bold text-amber-700">Presentation Mode</span>
              </div>
            )}

            {/* Audio Playback Controls if audio recorded */}
            {audioUrl && (
              <div className="p-3 rounded-2xl bg-white border border-[#EFE8E2] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleTogglePlayAudio}
                    className="w-8 h-8 rounded-xl bg-[#5A5049] text-white flex items-center justify-center hover:bg-[#3C3530] transition-colors cursor-pointer"
                  >
                    {isPlayingAudio ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                  </button>
                  <div className="text-xs">
                    <span className="font-bold text-[#3C3530] block">Your Audio Recording</span>
                    <span className="text-[10px] text-[#7F8C8D]">{formatTime(recordingSeconds)} length</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRecordAgain}
                    className="px-2.5 py-1.5 rounded-lg border border-[#EFE8E2] text-[#7A726C] hover:text-[#3C3530] text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Record Again</span>
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(true)}
                    className="p-1.5 rounded-lg border border-[#EFE8E2] text-rose-600 hover:bg-rose-50 text-xs cursor-pointer"
                    title="Delete Recording"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Transcript & Text Editing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#7F8C8D] block">
                  {audioUrl ? "Transcript (Editable):" : "Reflection Text:"}
                </label>
                <div className="flex items-center space-x-2">
                  {mode === "text" && !audioUrl && (
                    <button
                      onClick={() => {
                        setMode("choice");
                        setTranscript("");
                        setIsDemoSample(false);
                      }}
                      className="text-[10px] text-[#7F8C8D] hover:text-[#3C3530] underline cursor-pointer"
                    >
                      Switch to Voice
                    </button>
                  )}
                  {transcript.length > 0 && (
                    <button
                      onClick={() => {
                        setTranscript("");
                        setIsDemoSample(false);
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={3}
                value={transcript}
                data-no-translate
                onChange={(e) => {
                  setTranscript(e.target.value);
                  if (isDemoSample) setIsDemoSample(false);
                }}
                placeholder="Share your thoughts, feelings, or what happened today in your own words..."
                className="w-full p-3.5 rounded-2xl border border-[#EFE8E2] bg-white text-xs text-[#3C3530] focus:ring-2 focus:ring-[#5A5049] focus:outline-none leading-relaxed"
              />
            </div>

            {/* Share with Worker Checkbox */}
            <div className="p-3 rounded-xl bg-white border border-[#EFE8E2] flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-[#3C3530]">
                <input
                  type="checkbox"
                  checked={shareWithWorker}
                  onChange={(e) => setShareWithWorker(e.target.checked)}
                  className="rounded border-[#EFE8E2] text-[#5A5049] focus:ring-[#5A5049] cursor-pointer"
                />
                <span className="font-medium">
                  Share this reflection with my designated humanitarian counselor
                </span>
              </label>
              <span className="text-[10px] text-[#7F8C8D]">Consent Controlled</span>
            </div>

            {/* Voice tone analysis in progress / unavailable notice */}
            {audioUrl && isAnalyzingTone && (
              <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-100 text-xs text-violet-800 flex items-center space-x-2">
                <Loader2 size={14} className="animate-spin" />
                <span>Reasoning about your vocal tone (pitch, pace, pauses, loudness) together with your words…</span>
              </div>
            )}
            {audioUrl && !isAnalyzingTone && voiceToneError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
                <Info size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <span>{voiceToneError}</span>
              </div>
            )}

            {/* Transparent Language + Voice-Tone Signal Component */}
            {transcript.trim().length > 0 && (
              <ReflectionAnalysis
                analysis={analysisResult}
                voiceToneAnalysis={voiceToneResult || undefined}
                isDemoSample={isDemoSample}
              />
            )}
          </div>
        )}

        {/* Voice Signal Analysis — honest description of how it actually works */}
        <div className="p-4 rounded-2xl bg-white border border-[#EFE8E2] space-y-2">
          <div className="flex items-center space-x-2 text-[#5A5049]">
            <Volume2 size={15} />
            <h5 className="text-xs font-bold text-[#3C3530]">Voice Signal Analysis</h5>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active for voice recordings
            </span>
          </div>
          <p className="text-xs text-[#7A726C] leading-relaxed">
            When you record a voice reflection, AURA measures how it was spoken directly from the audio on your device: pitch variability, speaking pace, pauses, and loudness. Nothing here works by scanning for keywords: your transcript and these measured delivery numbers are both given to an LLM, which reasons about your emotional tone from the two together, including cases where your words and your tone disagree (e.g. saying "I'm fine" in a flat, quiet voice).
          </p>
          <div className="pt-1 text-[11px] text-[#7F8C8D] border-t border-[#EFE8E2]">
            <strong className="text-[#5A5049]">Notice:</strong> This is a screening aid, not a clinical or diagnostic tool. Raw audio never leaves your device. Only the transcript and numeric delivery measurements are sent for analysis, and a human reviewer always makes the final call.
          </div>
        </div>
      </div>

      {/* Expandable Information Sections (Requirement #9 & #20) */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Why can I share a voice reflection? */}
        <div className="bg-white rounded-2xl border border-[#EFE8E2] overflow-hidden">
          <button
            onClick={() => setShowWhyCard(!showWhyCard)}
            className="w-full p-4 text-left flex items-center justify-between text-xs font-bold text-[#3C3530] hover:bg-[#FDF9F5] transition-colors cursor-pointer"
          >
            <span className="flex items-center space-x-2">
              <Info size={14} className="text-[#5A5049]" />
              <span>Why can I share a voice reflection?</span>
            </span>
            {showWhyCard ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showWhyCard && (
            <div className="p-4 pt-0 text-xs text-[#7A726C] space-y-2 border-t border-[#EFE8E2]/60 bg-[#FDF9F5]">
              <p className="text-[11px] leading-relaxed">
                Some people find speaking easier than typing. A voluntary voice reflection can provide additional context that may not appear in structured check-in questions.
              </p>
              <ul className="space-y-1 text-[11px] list-disc list-inside">
                <li>Understand context from your own words</li>
                <li>Identify broad language patterns</li>
                <li>Enrich your voluntary wellbeing timeline</li>
                <li>Help a counselor understand what you want to share</li>
              </ul>
              <p className="text-[10px] text-[#7F8C8D] pt-1">
                <strong>Notice:</strong> Voice reflections never diagnose conditions and are not automated conclusions about you.
              </p>
            </div>
          )}
        </div>

        {/* How reflection analysis works */}
        <div className="bg-white rounded-2xl border border-[#EFE8E2] overflow-hidden">
          <button
            onClick={() => setShowHowItWorksCard(!showHowItWorksCard)}
            className="w-full p-4 text-left flex items-center justify-between text-xs font-bold text-[#3C3530] hover:bg-[#FDF9F5] transition-colors cursor-pointer"
          >
            <span className="flex items-center space-x-2">
              <Cpu size={14} className="text-[#5A5049]" />
              <span>How reflection analysis works</span>
            </span>
            {showHowItWorksCard ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showHowItWorksCard && (
            <div className="p-4 pt-0 text-xs text-[#7A726C] space-y-2 border-t border-[#EFE8E2]/60 bg-[#FDF9F5]">
              <ol className="space-y-1 text-[11px] list-decimal list-inside leading-relaxed">
                <li>You voluntarily record or type a reflection.</li>
                <li>Voice is converted to text where supported.</li>
                <li>For voice recordings, your device also measures pitch, pace, pauses, and loudness, never keywords.</li>
                <li>An LLM reasons about the transcript and those delivery measurements together to infer emotional tone and trauma-informed screening signals.</li>
                <li>The result becomes an additional wellbeing signal, combined with your voluntary check-in history.</li>
                <li>Important signals are reviewed by a human counselor.</li>
              </ol>
              <p className="text-[10px] text-[#7F8C8D] pt-1">
                Voice tone/emotion inference is not clinically validated and is not used as a diagnosis.
              </p>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Voice Recording"
        message="Are you sure you want to discard your voice recording? This cannot be undone."
        confirmText="Discard Recording"
        onConfirm={() => {
          handleDeleteRecording();
          setShowConfirmDelete(false);
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
};

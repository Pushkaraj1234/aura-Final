import React, { useState, useEffect, useRef } from "react";
import {
  Heart,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Phone,
  Lock,
  Smile,
  Meh,
  Frown,
  Moon,
  Users,
  LifeBuoy,
  XCircle,
  Home,
  Mic,
  MicOff,
  Wifi,
  WifiOff,
  FileText,
  Check,
  Cpu,
  Radio,
  Activity,
  Compass,
  Building2,
  Scale,
  Crosshair,
  HeartHandshake,
  MessageSquare
} from "lucide-react";
import { CheckIn, SafetyResponse, WellbeingScore, RiskAnalysis, ParticipantReflection, SomaticSymptom } from "../types";
import { analyzeDistress } from "../services/riskEngine";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSelector } from "../components/LanguageSelector";
import { VoiceRecorder } from "../components/VoiceRecorder";
import { ReflectionAnalysis } from "../components/ReflectionAnalysis";
import { analyzeReflection } from "../services/reflectionAnalysis";
import { SessionSignalCollector } from "../services/sessionSignals";

interface Props {
  participantId: string;
  previousCheckIn: CheckIn | null;
  onSaveCheckIn: (checkIn: CheckIn) => void;
  onOpenEmergency: () => void;
  onGoToProfile: () => void;
}

export const ParticipantCheckin: React.FC<Props> = ({
  participantId,
  previousCheckIn,
  onSaveCheckIn,
  onOpenEmergency,
  onGoToProfile
}) => {
  // The language now comes from the app-wide provider, so choosing one here
  // holds for every other screen and for the next visit. It used to be local
  // state that reset the moment this page unmounted.
  const { t } = useLanguage();

  // Step 0: Consent Gate
  // Steps 1 to 12: Questions for Victims of Atrocities (MCQ and Reflections)
  // Step 13: Results & Explainable Reflection Summary
  const [step, setStep] = useState(0);

  // Consent states
  const [consentVoluntary, setConsentVoluntary] = useState(true);
  const [consentNoDiag, setConsentNoDiag] = useState(true);

  // Form answers specific to Atrocity Survivors
  // Q1: Nature of Violations (MCQ - Multi-select)
  const [selectedViolations, setSelectedViolations] = useState<string[]>([
    "Forced displacement / Loss of home, land, or community"
  ]);

  // Q2: Perceived Safety & Security (MCQ - Single-select)
  const [safety, setSafety] = useState<SafetyResponse>("Mostly");

  // Q3: Physical & Medical Somatic Impact (MCQ - Single-select)
  const [physicalMedicalNeed, setPhysicalMedicalNeed] = useState<string>("No acute physical injury or medical needs at this time");

  // Q4: Emotional Wellbeing (MCQ - Single-select 1-5)
  const [wellbeing, setWellbeing] = useState<WellbeingScore>(3);

  // Q5: Sleep & Trauma-Related Nightmares (MCQ - Single-select 1-5)
  const [sleep, setSleep] = useState<WellbeingScore>(3);

  // Q6: Social Support & Isolation (MCQ - Single-select 1-5)
  const [connection, setConnection] = useState<WellbeingScore>(3);

  // Q7: Open Reflection - Survivor Coping & Resilience
  const [copingReflection, setCopingReflection] = useState<string>("");

  // Q8: Open Reflection - What Survivors Wish Others Understood
  const [publicUnderstandingReflection, setPublicUnderstandingReflection] = useState<string>("");

  // Q9: Institutional Trust & Legal Documentation (MCQ - Single-select)
  const [institutionalResponse, setInstitutionalResponse] = useState<string>("Partially. Approached institutions, but follow-through has been slow");

  // Q10: Key Priorities for Reparations & Healing (MCQ - Single-select)
  const [reparationsPriority, setReparationsPriority] = useState<string>("Truth, recognition, and legal accountability for perpetrators");

  // Q11: Human Counselor Connection (MCQ - Single-select)
  const [supportRequested, setSupportRequested] = useState<boolean>(false);

  // Q12: Immediate Crisis & Safety Confirmation (MCQ - Single-select)
  const [immediateSafetyConcern, setImmediateSafetyConcern] = useState<boolean>(false);

  // Q11: Behavioural and somatic answers. These ask what a person did and
  // what their body is doing, not how they feel — someone who will not say
  // "I am struggling" will still say they slept three hours, and distress is
  // very often voiced through the body rather than the mood. All optional,
  // and none of them move the distress score: they are what the concordance
  // check weighs the self-report against.
  const [sleepHours, setSleepHours] = useState<number | undefined>(undefined);
  const [mealsYesterday, setMealsYesterday] = useState<number | undefined>(undefined);
  const [leftHome, setLeftHome] = useState<boolean | undefined>(undefined);
  const [spokeToAnyone, setSpokeToAnyone] = useState<boolean | undefined>(undefined);
  const [somaticSymptoms, setSomaticSymptoms] = useState<SomaticSymptom[]>([]);

  // Asked on the consent gate. Someone answering with the person who harmed
  // them in the room gives answers meant for that audience, so the session is
  // marked low-confidence rather than recorded as fact.
  const [privateSpace, setPrivateSpace] = useState<boolean | undefined>(undefined);

  // Wall-clock start, used only to spot a form cleared rather than answered.
  const startedAtRef = useRef<number>(Date.now());

  /**
   * Watches how the form is moved through — time away, hesitation, answers
   * changed, a reflection written then deleted. Feeds concordance only; see
   * services/sessionSignals.ts for why none of it may touch the score.
   */
  const signalsRef = useRef<SessionSignalCollector>(new SessionSignalCollector());

  // Detach the visibility listener when this screen goes away, whether the
  // check-in was submitted or abandoned.
  useEffect(() => {
    const collector = signalsRef.current;
    return () => collector.dispose();
  }, []);

  // One place that records every step change, rather than a call beside each
  // of the dozen setStep sites.
  useEffect(() => {
    signalsRef.current.enterStep(step);
  }, [step]);

  // Likewise for answers: the first value seen is the baseline, and a later
  // different value counts that answer as revised.
  useEffect(() => {
    const c = signalsRef.current;
    c.recordAnswer("wellbeing", wellbeing);
    c.recordAnswer("sleep", sleep);
    c.recordAnswer("connection", connection);
    c.recordAnswer("safety", safety);
    c.recordAnswer("supportRequested", supportRequested);
    c.recordAnswer("immediateSafetyConcern", immediateSafetyConcern);
  }, [wellbeing, sleep, connection, safety, supportRequested, immediateSafetyConcern]);

  useEffect(() => {
    signalsRef.current.recordReflection(copingReflection);
  }, [copingReflection]);

  const toggleSomatic = (symptom: SomaticSymptom) => {
    setSomaticSymptoms((prev) => {
      if (symptom === "none_reported") return prev.includes(symptom) ? [] : ["none_reported"];
      const withoutNone = prev.filter((x) => x !== "none_reported");
      return withoutNone.includes(symptom)
        ? withoutNone.filter((x) => x !== symptom)
        : [...withoutNone, symptom];
    });
  };

  // Qualitative voice reflection component state
  const [currentReflection, setCurrentReflection] = useState<ParticipantReflection | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState<boolean>(false);

  // Computed stress based on wellbeing and sleep trauma rating (1-5)
  const computedStress: WellbeingScore = Math.min(5, Math.max(1, Math.round(6 - ((wellbeing + sleep) / 2))));

  // Offline Simulation State (Requirement #13)
  const [isOffline, setIsOffline] = useState(false);

  // Calculated analysis
  const [resultAnalysis, setResultAnalysis] = useState<RiskAnalysis | null>(null);

  const totalQuestions = 13;
  const currentQuestionNumber = Math.min(step, totalQuestions);

  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Compile summary of answers for notes
  const compiledNotes = [
    selectedViolations.length > 0 ? `Violations / Circumstances: ${selectedViolations.join("; ")}` : "",
    `Current Safety: ${safety}`,
    physicalMedicalNeed ? `Physical & Medical Needs: ${physicalMedicalNeed}` : "",
    `Emotional Wellbeing: ${wellbeing}/5 | Sleep & Nightmares: ${sleep}/5 | Social Connection: ${connection}/5`,
    copingReflection ? `Resilience & Coping: ${copingReflection}` : "",
    publicUnderstandingReflection ? `Message for Authorities / Society: ${publicUnderstandingReflection}` : "",
    institutionalResponse ? `Institutional Recognition: ${institutionalResponse}` : "",
    reparationsPriority ? `Primary Healing Priority: ${reparationsPriority}` : ""
  ].filter(Boolean).join("\n\n");

  const handleNext = async (safetyOverride?: boolean) => {
    if (step >= 13) {
      setIsProcessingAI(true);
      try {
        const isSafetyConcern = safetyOverride !== undefined ? safetyOverride : immediateSafetyConcern;
        const transcript = currentReflection?.transcript || [copingReflection, publicUnderstandingReflection].filter(Boolean).join("\n\n");
        let aiAnalysis = undefined;
        let aiComprehensiveAnalysis = undefined;

        // Only run Gemini AI if there is text and it's being shared
        if (transcript.length > 5 && (currentReflection ? currentReflection.shareWithWorker : true)) {
          try {
            const { apiService } = await import('../services/apiService');
            aiAnalysis = await apiService.ai.analyzeReflection(transcript);
            aiComprehensiveAnalysis = await apiService.ai.analyzeComprehensiveCheckIn(
              { wellbeing, stress: computedStress, sleep, safety, connection, supportRequested, immediateSafetyConcern: isSafetyConcern },
              transcript
            );
          } catch (e) {
            console.warn("Gemini AI Analysis Failed, falling back to deterministic:", e);
          }
        }

        let updatedReflection = currentReflection || (transcript ? {
          id: `ref-${Date.now()}`,
          participantId,
          type: "text" as const,
          transcript: transcript,
          audioRecorded: false,
          shareWithWorker: true,
          sentiment: "none",
          timestamp: new Date().toISOString(),
          analysis: analyzeReflection(transcript)
        } : undefined);

        if (updatedReflection && aiAnalysis) {
          updatedReflection = { ...updatedReflection, aiAnalysis };
        }

        const newCheckIn: CheckIn = {
          id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          participantId,
          timestamp: new Date().toISOString(),
          wellbeing,
          stress: computedStress,
          sleep,
          safety,
          connection,
          supportRequested,
          immediateSafetyConcern: isSafetyConcern,
          notes: compiledNotes || transcript || undefined,
          voiceInputUsed: currentReflection?.type === "voice" || currentReflection?.audioRecorded,
          shareNoteWithWorker: currentReflection ? currentReflection.shareWithWorker : true,
          reflection: updatedReflection,
          aiComprehensiveAnalysis,
          functional: {
            sleepHours,
            mealsYesterday,
            leftHome,
            spokeToAnyone,
            somaticSymptoms: somaticSymptoms.length ? somaticSymptoms : undefined,
          },
          responseMeta: {
            completionSeconds: Math.round((Date.now() - startedAtRef.current) / 1000),
            privateSpace,
            ...signalsRef.current.finish(),
          }
        };

        const analysis = analyzeDistress(newCheckIn, previousCheckIn);
        setResultAnalysis(analysis);
        onSaveCheckIn(newCheckIn);
        setStep(14);
      } finally {
        setIsProcessingAI(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const handleEmergencyTrigger = () => {
    setImmediateSafetyConcern(true);
    onOpenEmergency();
    const newCheckIn: CheckIn = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      participantId,
      timestamp: new Date().toISOString(),
      wellbeing: 1,
      stress: 5,
      sleep: 1,
      safety: "No",
      connection: 1,
      supportRequested: true,
      immediateSafetyConcern: true,
      notes: "Immediate emergency crisis flagged by survivor during atrocity check-in.",
      voiceInputUsed: false,
      shareNoteWithWorker: true
    };
    const analysis = analyzeDistress(newCheckIn, previousCheckIn);
    setResultAnalysis(analysis);
    onSaveCheckIn(newCheckIn);
    setStep(14);
  };

  // Step 0: Consent Gate
  if (step === 0) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-6">
        {/* Language & Offline Simulation Header Bar */}
        <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-[#EFE8E2]">
          <LanguageSelector />

          <button
            onClick={() => setIsOffline(!isOffline)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              isOffline
                ? "bg-[#D49B6A]/20 text-[#D49B6A] border border-[#D49B6A]/30"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {isOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
            <span>{isOffline ? "Offline Mode (Simulated)" : "Online / Connected"}</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#EFE8E2] shadow-xs space-y-6">
          <div className="space-y-3 text-center">
            <div className="w-16 h-16 bg-[#DBC3B2]/20 text-[#5A5049] rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Shield size={32} />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-[#5A5049]">
              Trauma-Informed Safeguard
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
              {t.voluntaryAgreement}
            </h2>
            <p className="text-xs sm:text-sm text-[#7F8C8D] leading-relaxed max-w-lg mx-auto">
              Before we begin your quick reflection, please review how your answers are processed with complete dignity and transparency.
            </p>
          </div>

          <div className="bg-[#FDF9F5] border border-[#EFE8E2] rounded-2xl p-5 space-y-3 text-xs text-[#7A726C]">
            <div className="flex items-start space-x-3">
              <CheckCircle2 size={16} className="text-[#5A5049] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#3C3530]">Your participation is 100% voluntary:</strong> You may skip any question or stop whenever you choose.
              </span>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle2 size={16} className="text-[#5A5049] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#3C3530]">No Clinical Diagnosis:</strong> AURA only calculates assistive wellbeing indicators to help human counselors support you.
              </span>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle2 size={16} className="text-[#5A5049] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#3C3530]">Data Dignity & Privacy:</strong> All data in this demonstration is securely managed and strictly confidential.
              </span>
            </div>
            {/* Said plainly, before anything is collected. This app already
                recorded how long a check-in took; it never told anyone. If
                something is being noticed, the person it is noticed about is
                entitled to know first. */}
            <div className="flex items-start space-x-3">
              <CheckCircle2 size={16} className="text-[#5A5049] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#3C3530]">How you answer, not only what:</strong> This
                form notes how long you spend on a question, whether you go back and change an
                answer, and whether you leave the app partway through. It is used only to tell a
                counsellor a check-in may be worth a second look. It never changes your score,
                and no keystrokes, camera or microphone are involved.
              </span>
            </div>
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start space-x-3 p-3 rounded-xl border border-[#EFE8E2] hover:bg-[#FDF9F5] cursor-pointer text-xs sm:text-sm text-[#3C3530]">
              <input
                type="checkbox"
                checked={consentVoluntary}
                onChange={(e) => setConsentVoluntary(e.target.checked)}
                className="w-4 h-4 rounded text-[#5A5049] focus:ring-[#5A5049] mt-0.5 cursor-pointer"
              />
              <span>I consent to this voluntary wellbeing check-in.</span>
            </label>

            <label className="flex items-start space-x-3 p-3 rounded-xl border border-[#EFE8E2] hover:bg-[#FDF9F5] cursor-pointer text-xs sm:text-sm text-[#3C3530]">
              <input
                type="checkbox"
                checked={consentNoDiag}
                onChange={(e) => setConsentNoDiag(e.target.checked)}
                className="w-4 h-4 rounded text-[#5A5049] focus:ring-[#5A5049] mt-0.5 cursor-pointer"
              />
              <span>I understand that this system does not provide medical or psychiatric diagnoses.</span>
            </label>
          </div>

          {/* Asked before anything else, because the answer changes how much
              the rest of the check-in can be trusted. Someone answering with
              the person who harmed them nearby gives answers meant for that
              audience — the session is marked low-confidence rather than
              recorded as fact, and nobody is asked to explain themselves. */}
          <div className="rounded-2xl border border-[#EFE8E2] bg-[#FDF9F5] p-4 space-y-3">
            <p className="text-sm font-bold text-[#3C3530]">
              Are you somewhere you can answer freely right now?
            </p>
            <div className="flex flex-wrap gap-2">
              {[["Yes", true], ["Not really", false]].map(([label, val]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => setPrivateSpace(privateSpace === val ? undefined : (val as boolean))}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                    privateSpace === val
                      ? "bg-[#3C3530] text-white border-[#3C3530]"
                      : "bg-white text-[#5A5049] border-[#EFE8E2] hover:border-[#DBC3B2]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {privateSpace === false && (
              <p className="text-[11px] text-[#A55D25] leading-relaxed">
                That is completely fine. You can carry on now, or come back when you have more privacy.
                Either way we will treat today's answers gently.
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onGoToProfile}
              className="w-full sm:w-1/3 py-3.5 rounded-xl border border-[#EFE8E2] text-[#7A726C] font-bold text-sm hover:bg-[#FDF9F5] transition-colors cursor-pointer"
            >
              Cancel / Exit
            </button>
            <button
              disabled={!consentVoluntary || !consentNoDiag}
              onClick={() => {
                startedAtRef.current = Date.now();
                signalsRef.current.start();
                setStep(1);
              }}
              className="w-full sm:w-2/3 py-3.5 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>{t.beginReflection}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 13: Reflection Results & Explainable AI Factor Summary
  if (step >= 13 && resultAnalysis) {
    const isUrgent = resultAnalysis.level === "Urgent";
    const isRecommended = resultAnalysis.level === "Follow-up Recommended";

    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6">
        {/* Offline sync note if offline */}
        {isOffline && (
          <div className="p-3.5 rounded-2xl bg-[#D49B6A]/15 border border-[#D49B6A]/30 text-xs text-[#3C3530] flex items-center space-x-2">
            <WifiOff size={16} className="text-[#D49B6A] shrink-0" />
            <span>
              <strong>Offline Mode Active:</strong> Check-in saved securely in browser local storage. Encrypted payload will sync automatically when network connectivity is re-established.
            </span>
          </div>
        )}

        {/* Urgent Emergency Interception Card */}
        {isUrgent && (
          <div className="bg-[#A55D25] text-white rounded-3xl p-6 sm:p-8 shadow-xs space-y-4 border border-[#A55D25]">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle size={28} />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-white/80">
                  Immediate Support Alert
                </span>
                <h3 className="text-2xl font-black">We hear you and want to help</h3>
                <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                  You indicated an urgent safety concern. A dedicated humanitarian team member has been prioritized to connect with you, and free crisis lines are available right now.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={onOpenEmergency}
                className="px-5 py-3 rounded-xl bg-white text-[#A55D25] font-bold text-sm hover:bg-[#FDF9F5] shadow-xs flex items-center space-x-2 cursor-pointer"
              >
                <Phone size={16} />
                <span>Open 24/7 Crisis Helplines</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Reflection Overview Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#EFE8E2] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EFE8E2]">
            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#DBC3B2]/20 text-[#5A5049] text-xs font-bold mb-2">
                <span>Check-in Reflection Complete</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                {t.todaySignal}
              </h2>
              <p className="text-xs text-[#7F8C8D] mt-0.5">
                Anonymous Participant: <span className="font-mono font-bold text-[#3C3530]">{participantId}</span>
              </p>
            </div>

            {/* Score Pill */}
            <div className="text-right sm:border-l sm:pl-6 border-[#EFE8E2]">
              <div className="text-3xl font-black text-[#3C3530]">
                {resultAnalysis.score}
                <span className="text-sm font-semibold text-[#7F8C8D]">/100</span>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-block mt-1 ${
                isUrgent ? "bg-[#A55D25]/20 text-[#A55D25]" :
                isRecommended ? "bg-[#D49B6A]/20 text-[#D49B6A]" :
                resultAnalysis.level === "Monitor" ? "bg-[#DBC3B2]/25 text-[#5A5049]" :
                "bg-[#DBC3B2]/30 text-[#5A5049]"
              }`}>
                {resultAnalysis.level}
              </span>
            </div>
          </div>

          {/* Dynamic Change Delta */}
          {resultAnalysis.previousScore !== null && (
            <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] flex items-center justify-between">
              <div className="text-xs text-[#7A726C]">
                <span>Previous Check-in: <strong className="text-[#3C3530]">{resultAnalysis.previousScore}/100</strong></span>
              </div>
              <div className={`text-xs font-bold px-3 py-1 rounded-xl ${
                resultAnalysis.change > 0
                  ? "bg-[#D49B6A]/20 text-[#D49B6A]"
                  : resultAnalysis.change < 0
                  ? "bg-[#DBC3B2]/30 text-[#5A5049]"
                  : "bg-[#EFE8E2] text-[#7A726C]"
              }`}>
                {resultAnalysis.change > 0 ? `+${resultAnalysis.change} pts change` : `${resultAnalysis.change} pts change`}
              </div>
            </div>
          )}

          {/* Free text / voice reflection NLP feedback if submitted */}
          {(currentReflection || copingReflection || publicUnderstandingReflection) && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#3C3530] flex items-center">
                    <FileText size={14} className="mr-1.5 text-[#5A5049]" />
                    Submitted Voluntary Reflection:
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#5A5049] bg-[#DBC3B2]/20 px-2 py-0.5 rounded-md">
                    {currentReflection?.type === "voice" ? "Voice Transcript" : "Text Input"}
                  </span>
                </div>
                <p className="text-[#7A726C] italic">"{currentReflection?.transcript || [copingReflection, publicUnderstandingReflection].filter(Boolean).join(" • ")}"</p>
              </div>

              <ReflectionAnalysis
                analysis={currentReflection?.analysis || analyzeReflection([copingReflection, publicUnderstandingReflection].filter(Boolean).join("\n\n"))}
                isDemoSample={currentReflection?.analysis?.isDemoSample}
              />
            </div>
          )}

          {/* Explainable Factors */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#7F8C8D]">
              {t.factorsReasoning}
            </h4>
            <div className="space-y-2">
              {resultAnalysis.factors.map((f, i) => (
                <div key={i} className="p-3.5 rounded-2xl bg-[#FDF9F5] border border-[#EFE8E2] text-xs sm:text-sm text-[#3C3530] flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A5049] shrink-0 mt-2"></span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Next Step */}
          <div className="p-5 rounded-2xl bg-[#DBC3B2]/15 border border-[#DBC3B2]/30 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5049]">
              System Recommendation
            </h4>
            <p className="text-sm font-medium text-[#3C3530] leading-relaxed">
              {resultAnalysis.recommendation}
            </p>
          </div>

          {/* Ethical Disclaimer */}
          <div className="text-center p-3 rounded-xl bg-[#FDF9F5] border border-[#EFE8E2] text-[11px] text-[#7F8C8D]">
            <strong className="text-[#3C3530]">Ethical Notice:</strong> {t.ethicalNotice}
          </div>

          {/* Navigation Action */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onGoToProfile}
              className="w-full py-4 rounded-2xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>View My History & Trends in Profile</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Interactive Question Card (Steps 1 - 8)
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Top Header & Progress */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE8E2] shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs text-[#7F8C8D] font-bold">
          <span>Question {currentQuestionNumber} of {totalQuestions}</span>
          <div className="flex items-center space-x-3">
            <LanguageSelector variant="compact" />
            <button
              onClick={onGoToProfile}
              className="text-[#7F8C8D] hover:text-[#3C3530] transition-colors cursor-pointer"
            >
              Save & Exit
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[#EFE8E2] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#5A5049] transition-all duration-300 rounded-full"
            style={{ width: `${(currentQuestionNumber / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Main Question Body */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#EFE8E2] shadow-xs space-y-8 min-h-[380px] flex flex-col justify-between">
        
        {/* Step 1: Question 1 (MCQ - Multi-select) */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Shield size={14} />
                <span>Step 1 • Nature of Atrocity / Violations Experienced</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                What primary circumstances or violations have you experienced or survived?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Select all that apply. Your responses are strictly confidential and help contextualize support resources.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5 pt-2">
              {[
                {
                  id: "displacement",
                  label: "Forced Displacement & Loss of Home",
                  desc: "Forced to flee homeland, village, or residence due to conflict, state violence, or persecution."
                },
                {
                  id: "detention_violence",
                  label: "Arbitrary Detention, Captivity, or Torture",
                  desc: "Unlawful imprisonment, physical abuse, torture, or enforced restriction of personal liberty."
                },
                {
                  id: "persecution",
                  label: "Persecution Based on Identity or Beliefs",
                  desc: "Targeted violence or systemic discrimination due to ethnicity, religion, caste, gender, or political beliefs."
                },
                {
                  id: "family_loss",
                  label: "Loss, Disappearance, or Family Separation",
                  desc: "Bereavement, forced disappearance, or separation from children, parents, or partner."
                },
                {
                  id: "livelihood_destruction",
                  label: "Destruction of Livelihood & Cultural Heritage",
                  desc: "Confiscation or demolition of land, business, farming resources, or sacred community sites."
                },
                {
                  id: "confidential_other",
                  label: "Prefer Confidential / Other Violations",
                  desc: "Severe violations not listed above, or opting to preserve privacy during initial intake."
                }
              ].map((opt) => {
                const isSelected = selectedViolations.includes(opt.label);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedViolations(selectedViolations.filter((v) => v !== opt.label));
                      } else {
                        setSelectedViolations([...selectedViolations, opt.label]);
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                        : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                    }`}
                  >
                    <div className="flex items-start justify-between space-x-2">
                      <span className="font-bold text-sm text-[#3C3530] leading-snug">{opt.label}</span>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? "bg-[#5A5049] border-[#5A5049] text-white"
                            : "border-[#D1DCD6] bg-white"
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                    </div>
                    <p className="text-xs text-[#7A726C] mt-2 leading-relaxed">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Question 2 (MCQ - Single-select) */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Lock size={14} />
                <span>Step 2 • Current Safety & Security Status</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                How secure and protected do you feel in your current living environment?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Assessing physical safety and sanctuary is foundational to survivor recovery and ongoing risk evaluation.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  value: "Yes" as SafetyResponse,
                  label: "Fully Safe & Protected",
                  desc: "Living in a secure environment with no active threats, harassment, surveillance, or fear of discovery."
                },
                {
                  value: "Mostly" as SafetyResponse,
                  label: "Mostly Safe, with Occasional Apprehension",
                  desc: "Generally secure in daily life, but experiencing moments of hypervigilance or quiet unease."
                },
                {
                  value: "Unsure" as SafetyResponse,
                  label: "Unsure / Unstable Living Conditions",
                  desc: "Precarious housing, unresolved asylum or legal status, or living in unpredictable surroundings."
                },
                {
                  value: "No" as SafetyResponse,
                  label: "Unsafe / Facing Ongoing Hostility or Surveillance",
                  desc: "Currently experiencing intimidation, threats, hostile actors, or fear of immediate discovery."
                }
              ].map((opt) => {
                const isSelected = safety === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSafety(opt.value)}
                    className={`w-full p-4.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                        : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <span className="font-bold text-sm sm:text-base text-[#3C3530] block">{opt.label}</span>
                      <span className="text-xs text-[#7A726C] leading-relaxed block">{opt.desc}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Question 3 (MCQ - Single-select) */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Activity size={14} />
                <span>Step 3 • Physical Health & Somatic Impact</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                Do you have ongoing physical injuries, pain, or medical conditions resulting from what occurred?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Documenting somatic and physical trauma ensures proper referrals to medical specialists and rehabilitation care.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  id: "none",
                  label: "No acute physical injury or medical needs at this time",
                  desc: "Physical health is currently manageable and does not require immediate treatment."
                },
                {
                  id: "chronic_pain",
                  label: "Persistent Chronic Pain & Body Strain",
                  desc: "Ongoing nerve pain, untreated wounds, joint inflammation, or chronic physical exhaustion."
                },
                {
                  id: "mobility",
                  label: "Mobility Limitations or Physical Impairment",
                  desc: "Difficulty walking, standing, or carrying out daily tasks due to past injury or trauma."
                },
                {
                  id: "somatic_distress",
                  label: "Severe Headaches, Stomach Distress, or Palpitations",
                  desc: "High physiological reactivity and severe body tension linked to trauma memories."
                },
                {
                  id: "urgent_medical",
                  label: "Urgent Need for Specialized Medical Care or Medication",
                  desc: "Requiring prompt clinical evaluation, prescription refills, wound care, or specialized surgery."
                }
              ].map((opt) => {
                const isSelected = physicalMedicalNeed === opt.label;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPhysicalMedicalNeed(opt.label)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                        : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <span className="font-bold text-sm text-[#3C3530] block">{opt.label}</span>
                      <span className="text-xs text-[#7A726C] leading-relaxed block">{opt.desc}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Question 4 (MCQ - Single-select) */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Heart size={14} />
                <span>Step 4 • Overall Emotional Wellbeing</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                How would you describe your overall emotional wellbeing over the past few days?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Trauma recovery is non-linear. Your response helps establish an honest baseline without clinical diagnosis.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  value: 5 as WellbeingScore,
                  label: "5 - Grounded and Resilient",
                  desc: "Experiencing emotional stability, able to focus on routines, and feeling hopeful about the future."
                },
                {
                  value: 4 as WellbeingScore,
                  label: "4 - Generally Managing",
                  desc: "Coping with day-to-day demands, though carrying some quiet sadness, grief, or fatigue."
                },
                {
                  value: 3 as WellbeingScore,
                  label: "3 - Moderate Emotional Strain",
                  desc: "Feeling emotionally drained, vulnerable, or needing frequent pauses to navigate the day."
                },
                {
                  value: 2 as WellbeingScore,
                  label: "2 - Severe Distress",
                  desc: "High emotional exhaustion, difficulty focusing, persistent sadness, or feeling weighed down."
                },
                {
                  value: 1 as WellbeingScore,
                  label: "1 - Acute Crisis / Overwhelmed",
                  desc: "Feeling completely depleted, overwhelmed, or unable to bear the emotional pain."
                }
              ].map((opt) => {
                const isSelected = wellbeing === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWellbeing(opt.value)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                        : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <span className="font-bold text-sm text-[#3C3530] block">{opt.label}</span>
                      <span className="text-xs text-[#7A726C] leading-relaxed block">{opt.desc}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 5: Question 5 (MCQ - Single-select) */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Moon size={14} />
                <span>Step 5 • Sleep & Trauma-Related Nightmares</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                How frequently are you experiencing intrusive memories, flashbacks, or nightmares?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Involuntary memories and sleep disturbances are a common physiological response to surviving atrocities.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  value: 5 as WellbeingScore,
                  label: "5 - Restful Sleep / Minimal Intrusion",
                  desc: "Sleeping consistently with peaceful or manageable dreams and minimal night disturbance."
                },
                {
                  value: 4 as WellbeingScore,
                  label: "4 - Mild Sleep Disruption",
                  desc: "Occasional bad dreams or waking up alert once or twice a week, but able to fall back asleep."
                },
                {
                  value: 3 as WellbeingScore,
                  label: "3 - Moderate Flashbacks & Nightmares",
                  desc: "Waking up with a racing heart, vivid traumatic dreams, or restlessness several nights weekly."
                },
                {
                  value: 2 as WellbeingScore,
                  label: "2 - Severe Insomnia & Fear of Sleeping",
                  desc: "Dreading going to sleep, intense nocturnal panic, and persistent daytime exhaustion."
                },
                {
                  value: 1 as WellbeingScore,
                  label: "1 - Constant Terror / Fragmented Rest",
                  desc: "Barely able to sleep; traumatic replays keep you alert and terrified throughout the night."
                }
              ].map((opt) => {
                const isSelected = sleep === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSleep(opt.value)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                        : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <span className="font-bold text-sm text-[#3C3530] block">{opt.label}</span>
                      <span className="text-xs text-[#7A726C] leading-relaxed block">{opt.desc}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 6: Question 6 (MCQ - Single-select) */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Users size={14} />
                <span>Step 6 • Social Support & Community Connection</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                What is your current level of connection with family, trusted allies, or community?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Atrocities often shatter community networks; social connection is one of the strongest protective factors.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  value: 5 as WellbeingScore,
                  label: "5 - Well Supported",
                  desc: "Surrounded by compassionate family, trusted companions, or supportive survivor networks."
                },
                {
                  value: 4 as WellbeingScore,
                  label: "4 - Regular Trusted Contact",
                  desc: "In regular touch with at least one or two people who genuinely understand and stand with you."
                },
                {
                  value: 3 as WellbeingScore,
                  label: "3 - Limited Connection",
                  desc: "Some acquaintances or neighbors, but feeling mostly misunderstood or hesitant to speak openly."
                },
                {
                  value: 2 as WellbeingScore,
                  label: "2 - Displaced or Disconnected",
                  desc: "Separated from loved ones, living in an unfamiliar community, or lacking close confidants."
                },
                {
                  value: 1 as WellbeingScore,
                  label: "1 - Completely Isolated",
                  desc: "Cut off from all family and community, carrying this burden completely alone."
                }
              ].map((opt) => {
                const isSelected = connection === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConnection(opt.value)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                        : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <span className="font-bold text-sm text-[#3C3530] block">{opt.label}</span>
                      <span className="text-xs text-[#7A726C] leading-relaxed block">{opt.desc}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 7: Question 7 (Qualitative Reflection with Voice or Text) */}
        {step === 7 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <span>Step 7 • Strengths, Coping & Resilience</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                What has helped you endure, cope, or find moments of peace or strength?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Sharing what grounds you honors your dignity and helps identify personal sources of strength.
              </p>
            </div>

            {/* Quick Inspiration Tags */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7F8C8D] block">
                Tap to add inspiration to your reflection:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Memories of loved ones",
                  "Faith, prayer & spiritual rituals",
                  "Solidarity with other survivors",
                  "Creative writing, art, or music",
                  "Advocating for truth and justice",
                  "Caring for children and family",
                  "Quiet moments in nature",
                  "Deep breathing and grounding exercises"
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const updated = copingReflection ? `${copingReflection}, ${tag.toLowerCase()}` : tag;
                      setCopingReflection(updated);
                    }}
                    className="text-xs bg-[#FDF9F5] hover:bg-[#DBC3B2]/25 hover:text-[#5A5049] text-[#3C3530] border border-[#EFE8E2] px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice or Text Switch */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                  className="text-xs font-bold text-[#5A5049] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <Mic size={14} />
                  <span>{showVoiceRecorder ? "Hide Voice Recorder" : "Use Spoken Voice Recording Instead"}</span>
                </button>
                <span className="text-xs text-[#7F8C8D]">
                  {copingReflection.length} characters
                </span>
              </div>

              {showVoiceRecorder ? (
                <div className="border border-[#EFE8E2] rounded-2xl p-4 bg-[#FDF9F5]">
                  <VoiceRecorder
                    participantId={participantId}
                    initialTranscript={copingReflection}
                    onSaveReflection={(ref) => {
                      setCurrentReflection(ref);
                      if (ref?.transcript) setCopingReflection(ref.transcript);
                    }}
                    onClearReflection={() => {
                      setCurrentReflection(null);
                      setCopingReflection("");
                    }}
                  />
                </div>
              ) : (
                <textarea
                  rows={5}
                  value={copingReflection}
                  onChange={(e) => setCopingReflection(e.target.value)}
                  placeholder="Describe the people, practices, beliefs, or quiet moments that bring you comfort or strength..."
                  className="w-full p-4 rounded-2xl border border-[#EFE8E2] bg-white text-sm text-[#3C3530] focus:ring-2 focus:ring-[#5A5049] focus:outline-none leading-relaxed"
                />
              )}
            </div>
          </div>
        )}

        {/* Step 8: Question 8 (Qualitative Reflection - Survivor Voice) */}
        {step === 8 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <MessageSquare size={14} />
                <span>Step 8 • Truth, Dignity & Public Understanding</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                What do you wish institutions, investigators, or the public understood about survivors of atrocities?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Your perspective bridges the gap between abstract reports and the living reality of surviving trauma.
              </p>
            </div>

            {/* Quick Suggestion Pills */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7F8C8D] block">
                Tap common truths to include:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  "The trauma does not end when violence stops",
                  "Survivors need to be believed without skepticism",
                  "Loss of homeland and dignity hurts as deeply as physical wounds",
                  "We are resilient people, not just passive victims",
                  "Justice and accountability are necessary for real peace"
                ].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => {
                      const updated = publicUnderstandingReflection ? `${publicUnderstandingReflection}\n\n${pill}` : pill;
                      setPublicUnderstandingReflection(updated);
                    }}
                    className="text-xs bg-[#FDF9F5] hover:bg-[#DBC3B2]/25 hover:text-[#5A5049] text-[#3C3530] border border-[#EFE8E2] px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                  >
                    + "{pill}"
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <textarea
                rows={5}
                value={publicUnderstandingReflection}
                onChange={(e) => setPublicUnderstandingReflection(e.target.value)}
                placeholder="Share what you believe the world needs to hear about survivors and the aftermath of atrocities..."
                className="w-full p-4 rounded-2xl border border-[#EFE8E2] bg-white text-sm text-[#3C3530] focus:ring-2 focus:ring-[#5A5049] focus:outline-none leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* Step 9: Question 9 (MCQ - Single-select) */}
        {step === 9 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Building2 size={14} />
                <span>Step 9 • Institutional Response & Justice Access</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                Have authorities, institutions, or human rights bodies acknowledged your experience?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Understanding your trust in official channels guides safe documentation and legal advocacy.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  id: "formally_documented",
                  label: "Yes, formally documented and supported",
                  desc: "My testimony or case was recorded with dignity by trusted human rights or legal advocates."
                },
                {
                  id: "partial_response",
                  label: "Partly, with limited follow-up",
                  desc: "Shared my account, but assistance, protection, or legal accountability has stalled."
                },
                {
                  id: "dismissed",
                  label: "No, dismissed or ignored",
                  desc: "Faced skepticism, indifference, or hostility when attempting to seek justice or protection."
                },
                {
                  id: "fear_retaliation",
                  label: "Never reported, out of fear",
                  desc: "Did not approach authorities due to fear of reprisals, compromised safety, or lack of trust."
                },
                {
                  id: "platform_record",
                  label: "Desire Confidential Platform Documentation",
                  desc: "Wish to record my experience privately and securely within this confidential system."
                }
              ].map((opt) => {
                const isSelected = institutionalResponse === opt.label;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setInstitutionalResponse(opt.label)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                        : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <span className="font-bold text-sm text-[#3C3530] block">{opt.label}</span>
                      <span className="text-xs text-[#7A726C] leading-relaxed block">{opt.desc}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 10: Question 10 (MCQ - Single-select) */}
        {step === 10 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Scale size={14} />
                <span>Step 10 • Priorities for Recovery & Reparation</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                What is your highest priority for healing, justice, and rebuilding your life?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Surviving atrocities involves multiple dimensions of recovery. Choose your primary need right now.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  id: "justice_accountability",
                  label: "Truth, Recognition & Legal Accountability",
                  desc: "Official acknowledgment of atrocities, public truth-telling, and legal accountability for perpetrators."
                },
                {
                  id: "safe_shelter_asylum",
                  label: "Permanent Safe Shelter & Legal Asylum Status",
                  desc: "Secure long-term housing, protection against deportation, and regularized legal residency."
                },
                {
                  id: "mental_health_rehab",
                  label: "Trauma-Informed Psychological & Somatic Healing",
                  desc: "Access to culturally safe therapy, specialized trauma counseling, and physical medical rehabilitation."
                },
                {
                  id: "livelihood_education",
                  label: "Livelihood Restart, Education & Economic Independence",
                  desc: "Employment opportunities, vocational retraining, or education grants for self and family."
                },
                {
                  id: "family_reunification",
                  label: "Family Tracing & Reuniting with Missing Relatives",
                  desc: "Assistance in searching for missing loved ones, DNA tracing, and cross-border reunification."
                }
              ].map((opt) => {
                const isSelected = reparationsPriority === opt.label;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReparationsPriority(opt.label)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                        : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <span className="font-bold text-sm text-[#3C3530] block">{opt.label}</span>
                      <span className="text-xs text-[#7A726C] leading-relaxed block">{opt.desc}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 11: Question 11 (MCQ - Single-select) */}
        {/* Step 11: behaviour and body — deliberately factual, low-stigma,
            and entirely skippable. None of it changes the distress score. */}
        {step === 11 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <Activity size={14} />
                <span>Step 11 • The Last Day or Two</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                A few practical questions about the last day or two.
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Not about how you felt, just what happened. Answer only what you want to. Skip anything you would rather not say.
              </p>
            </div>

            <div className="space-y-5 pt-1">
              <div className="space-y-2">
                <p className="text-sm font-bold text-[#3C3530]">Roughly how many hours did you sleep last night?</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 2, 4, 6, 8, 10].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setSleepHours(sleepHours === h ? undefined : h)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                        sleepHours === h
                          ? "bg-[#3C3530] text-white border-[#3C3530]"
                          : "bg-[#FDF9F5] text-[#5A5049] border-[#EFE8E2] hover:border-[#DBC3B2]"
                      }`}
                    >
                      {h === 0 ? "Barely any" : h === 10 ? "10+" : `~${h}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-[#3C3530]">How many meals did you eat yesterday?</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMealsYesterday(mealsYesterday === m ? undefined : m)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                        mealsYesterday === m
                          ? "bg-[#3C3530] text-white border-[#3C3530]"
                          : "bg-[#FDF9F5] text-[#5A5049] border-[#EFE8E2] hover:border-[#DBC3B2]"
                      }`}
                    >
                      {m === 3 ? "3 or more" : m === 0 ? "None" : m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[#3C3530]">Did you leave where you are staying?</p>
                  <div className="flex gap-2">
                    {[["Yes", true], ["No", false]].map(([label, val]) => (
                      <button
                        key={String(label)}
                        type="button"
                        onClick={() => setLeftHome(leftHome === val ? undefined : (val as boolean))}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                          leftHome === val
                            ? "bg-[#3C3530] text-white border-[#3C3530]"
                            : "bg-[#FDF9F5] text-[#5A5049] border-[#EFE8E2] hover:border-[#DBC3B2]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-bold text-[#3C3530]">Did you speak with anyone?</p>
                  <div className="flex gap-2">
                    {[["Yes", true], ["No", false]].map(([label, val]) => (
                      <button
                        key={String(label)}
                        type="button"
                        onClick={() => setSpokeToAnyone(spokeToAnyone === val ? undefined : (val as boolean))}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                          spokeToAnyone === val
                            ? "bg-[#3C3530] text-white border-[#3C3530]"
                            : "bg-[#FDF9F5] text-[#5A5049] border-[#EFE8E2] hover:border-[#DBC3B2]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-[#3C3530]">
                  Has your body been troubling you in any of these ways?
                </p>
                <p className="text-[11px] text-[#7F8C8D]">Select any that apply, or none.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {([
                    ["headaches", "Headaches"],
                    ["appetite_change", "Appetite changed"],
                    ["unexplained_pain", "Body pain"],
                    ["palpitations", "Racing heart"],
                    ["exhaustion", "Exhaustion"],
                    ["none_reported", "None of these"],
                  ] as [SomaticSymptom, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSomatic(key)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                        somaticSymptoms.includes(key)
                          ? "bg-[#3C3530] text-white border-[#3C3530]"
                          : "bg-[#FDF9F5] text-[#5A5049] border-[#EFE8E2] hover:border-[#DBC3B2]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 12 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#5A5049] flex items-center space-x-1.5">
                <HeartHandshake size={14} />
                <span>Step 12 • Counselor Connection & Support Preference</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                Would you like to connect with a confidential, specialized human counselor?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                Checking yes will notify our humanitarian caseworker team for a voluntary, confidential follow-up.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => setSupportRequested(true)}
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  supportRequested === true
                    ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                    : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#3C3530]">Yes, connect me</span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        supportRequested === true
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {supportRequested === true && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-[#7A726C] leading-relaxed">
                    Your request goes to the support team, who will arrange a voluntary,
                    confidential conversation with a trauma-informed counsellor.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSupportRequested(false)}
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  supportRequested === false
                    ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30 shadow-xs"
                    : "border-[#EFE8E2] hover:border-[#DBC3B2] hover:bg-[#FDF9F5]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#3C3530]">No, self-guided only</span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        supportRequested === false
                          ? "border-[#5A5049] bg-[#5A5049] text-white"
                          : "border-[#D1DCD6] bg-white"
                      }`}
                    >
                      {supportRequested === false && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-[#7A726C] leading-relaxed">
                    Continue your personal reflection and access self-guided wellness resources without scheduling a call.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 13: Question 13 (MCQ - Single-select) */}
        {step === 13 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#A55D25] flex items-center space-x-1.5">
                <AlertTriangle size={14} />
                <span>Step 13 • Immediate Safety Confirmation</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#3C3530]">
                Are you in immediate physical danger or thinking of hurting yourself right now?
              </h3>
              <p className="text-xs sm:text-sm text-[#7F8C8D]">
                This safety triage step ensures immediate access to emergency helplines and crisis assistance if needed.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setImmediateSafetyConcern(false);
                  handleNext(false);
                }}
                className={`w-full p-4.5 rounded-2xl border-2 text-left flex items-center justify-between cursor-pointer transition-all ${
                  !immediateSafetyConcern
                    ? "border-[#5A5049] bg-[#DBC3B2]/20 ring-2 ring-[#5A5049]/30"
                    : "border-[#EFE8E2] hover:border-[#5A5049] hover:bg-[#DBC3B2]/15"
                }`}
              >
                <div>
                  <span className="font-bold text-[#3C3530] block text-sm sm:text-base">
                    No, I am safe right now.
                  </span>
                  <span className="text-xs text-[#7A726C] mt-0.5 block">
                    Complete check-in and review your personalized reflection summary.
                  </span>
                </div>
                <CheckCircle2 size={22} className="text-[#5A5049] shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleEmergencyTrigger}
                className="w-full p-4.5 rounded-2xl border-2 border-[#A55D25]/40 bg-[#A55D25]/10 hover:bg-[#A55D25]/20 transition-all text-left flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-[#A55D25] block text-sm sm:text-base">
                    Yes, I need immediate emergency help or support.
                  </span>
                  <span className="text-xs text-[#A55D25]/90 mt-0.5 block">
                    Access crisis hotlines and humanitarian alert protocols immediately.
                  </span>
                </div>
                <AlertTriangle size={22} className="text-[#A55D25] shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Footer controls: Back, Skip, Next */}
        <div className="pt-6 border-t border-[#EFE8E2] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step <= 1}
            className="text-xs font-bold text-[#7F8C8D] hover:text-[#3C3530] disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>{t.previous}</span>
          </button>

          <div className="flex items-center space-x-3">
            {step < 13 && (
              <button
                type="button"
                onClick={() => handleNext()}
                className="text-xs font-semibold text-[#7F8C8D] hover:text-[#3C3530] underline cursor-pointer"
              >
                {t.skip}
              </button>
            )}

            {step < 13 ? (
              <button
                type="button"
                onClick={() => handleNext()}
                className="px-6 py-3 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all shadow-xs flex items-center space-x-2 active:scale-95 cursor-pointer"
              >
                <span>{t.continue}</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNext()}
                disabled={isProcessingAI}
                className="px-6 py-3 rounded-xl bg-[#3C3530] text-white font-bold text-sm hover:bg-[#3F4E4E] transition-all shadow-xs flex items-center space-x-2 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <span>{isProcessingAI ? "Processing..." : t.submitCheckin}</span>
                <CheckCircle2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

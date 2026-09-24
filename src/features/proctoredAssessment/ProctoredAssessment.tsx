/**
 * The proctored trauma assessment, as one AURA view.
 *
 * Adapted from the standalone app's main controller. What changed on the way
 * in, and why:
 *
 * - The participant is the signed-in AURA participant, not a random ID typed
 *   on the consent screen, so a saved result lands on the right record.
 * - Completed results are saved to Supabase (proctored_assessments) under
 *   row-level security instead of browser storage, so a shared phone never
 *   shows one person's history to the next and the counsellor can see them.
 * - The standalone server's in-memory session log and research totals are
 *   gone. They were only ever read by the research settings screen, which is
 *   not offered to participants here, and memory does not survive a
 *   serverless deployment anyway.
 * - Crisis support opens AURA's own Emergency modal (Indian helplines), and
 *   the assessment conversation goes through AURA's crisis gate.
 * - The camera and microphone are released as soon as the questions are done,
 *   when the person starts again, and when they leave this page for any other.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AssessmentStage,
  ChatMessage,
  CompletedAssessmentRecord,
  DeviceStatus,
  EventSeverity,
  Pcl5ResultSummary,
  ProctorEvent,
  SensorMonitoringStats,
} from './types';
import { DEFAULT_SESSION_CONFIG } from './data/assessmentQuestions';
import { calculatePcl5Summary } from './utils/scoring';
import { Header } from './components/Header';
import { ConsentSafetyModal } from './components/ConsentSafetyModal';
import { DeviceCheckStep } from './components/DeviceCheckStep';
import { LivenessEnvironmentStep } from './components/LivenessEnvironmentStep';
import { TraumaExposureStep, TraumaExposureData } from './components/TraumaExposureStep';
import { PcPtsdScreenStep } from './components/PcPtsdScreenStep';
import { Pcl5AssessmentStep } from './components/Pcl5AssessmentStep';
import { FunctionalImpactStep } from './components/FunctionalImpactStep';
import { ContextualInterviewStep } from './components/ContextualInterviewStep';
import { ProctorMonitorOverlay } from './components/ProctorMonitorOverlay';
import { PauseSafetyModal } from './components/PauseSafetyModal';
import { ResultReportView } from './components/ResultReportView';
import { AssessmentHistoryView } from './components/AssessmentHistoryView';
import { apiService } from '../../services/apiService';
import { proctoredAssessmentService } from '../../services/proctoredAssessmentService';
import { useLanguage } from '../../context/LanguageContext';
import './proctoredAssessment.css';

// Research settings are not offered to participants, so the validated
// defaults (PCL-5 threshold 33) are the configuration for every session.
const SESSION_CONFIG = DEFAULT_SESSION_CONFIG;

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_ai',
  sender: 'aura',
  text: "Hello, I'm Aura. Thank you for taking the time to complete this assessment. If you'd like to share how these experiences have affected your day-to-day life, I'm here to listen. You can also go straight to your results.",
  timestamp: new Date().toISOString(),
};

interface ProctoredAssessmentProps {
  /** The signed-in participant's AURA record id */
  participantId: string;
  onOpenEmergency: () => void;
}

export const ProctoredAssessment: React.FC<ProctoredAssessmentProps> = ({ participantId, onOpenEmergency }) => {
  const { lang } = useLanguage();
  const [currentStage, setCurrentStage] = useState<AssessmentStage>('CONSENT');
  const [researchConsent, setResearchConsent] = useState<boolean>(false);

  // Hardware Media Streams
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenMode, setScreenMode] = useState<'display_stream' | 'window_focus_proctor' | null>(null);

  // Device & Proctor Status
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    cameraActive: false,
    microphoneActive: false,
    screenShareActive: false,
    livenessPassed: false,
    environmentPassed: false,
    permissionGranted: false,
  });
  const [proctorSeverity, setProctorSeverity] = useState<EventSeverity>('GREEN');
  const [events, setEvents] = useState<ProctorEvent[]>([]);

  // Assessment Data
  const [indexTraumaLabel, setIndexTraumaLabel] = useState<string>('');
  const [traumaSelection, setTraumaSelection] = useState<TraumaExposureData | null>(null);
  const [pcPtsdResponses, setPcPtsdResponses] = useState<Record<number, boolean>>({});
  const [pcl5Responses, setPcl5Responses] = useState<Record<number, number>>({});
  const [functionalResponses, setFunctionalResponses] = useState<Record<string, number>>({});

  // Contextual Interview Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);

  // Modals & Views
  const [isPauseOpen, setIsPauseOpen] = useState<boolean>(false);

  // Completed Results & History
  const [resultSummary, setResultSummary] = useState<Pcl5ResultSummary | null>(null);
  const [sensorStats, setSensorStats] = useState<SensorMonitoringStats | null>(null);
  const [userReportText, setUserReportText] = useState<string>('');
  const [sessionReportText, setSessionReportText] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  // When the current result was produced, and the history id it was saved as (null until saved)
  const [resultDate, setResultDate] = useState<string>(() => new Date().toISOString());
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A past assessment opened from history; shown read-only without replacing the current result
  const [viewedRecord, setViewedRecord] = useState<CompletedAssessmentRecord | null>(null);
  const [history, setHistory] = useState<CompletedAssessmentRecord[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const loadHistory = useCallback(async () => {
    setHistoryStatus('loading');
    const { records, error } = await proctoredAssessmentService.listForParticipant(participantId);
    setHistory(records);
    setHistoryStatus(error ? 'error' : 'ready');
  }, [participantId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Each step starts at its top, not wherever the previous step was scrolled to
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentStage]);

  // Log Proctoring Event
  const handleLogEvent = useCallback(
    (eventData: Omit<ProctorEvent, 'id' | 'timestamp'>) => {
      const newEvent: ProctorEvent = {
        ...eventData,
        id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
      };

      setEvents((prev) => [...prev, newEvent]);

      // Update max active severity
      if (eventData.severity === 'RED') {
        setProctorSeverity('RED');
      } else if (eventData.severity === 'ORANGE' && proctorSeverity !== 'RED') {
        setProctorSeverity('ORANGE');
      } else if (eventData.severity === 'YELLOW' && proctorSeverity === 'GREEN') {
        setProctorSeverity('YELLOW');
      }
    },
    [proctorSeverity]
  );

  // Hands the camera and microphone back. The cleanup effect below stops the
  // tracks of whatever streams were held before this.
  const releaseMedia = () => {
    setVideoStream(null);
    setAudioStream(null);
    setScreenStream(null);
    setDeviceStatus((prev) => ({ ...prev, cameraActive: false, microphoneActive: false, screenShareActive: false }));
  };

  // Phase 1: Consent Accepted
  const handleConsentAccepted = (consentData: { acceptedAt: string; researchConsent: boolean }) => {
    setResearchConsent(consentData.researchConsent);
    handleLogEvent({
      eventType: 'SESSION_STARTED',
      severity: 'GREEN',
      message: 'Consent given.',
      source: 'user-action',
      resolved: true,
    });
    setCurrentStage('DEVICE_CHECK');
  };

  // Phase 2: Device Check Completed
  const handleDeviceCheckCompleted = (streams: {
    videoStream: MediaStream | null;
    audioStream: MediaStream | null;
    screenStream: MediaStream | null;
    screenMode: 'display_stream' | 'window_focus_proctor' | null;
  }) => {
    setVideoStream(streams.videoStream);
    setAudioStream(streams.audioStream);
    setScreenStream(streams.screenStream);
    setScreenMode(streams.screenMode);

    setDeviceStatus((prev) => ({
      ...prev,
      cameraActive: !!streams.videoStream,
      microphoneActive: !!streams.audioStream,
      // Focus tracking uses a placeholder stream, so only a real share counts as screen sharing
      screenShareActive: !!streams.screenStream && streams.screenMode === 'display_stream',
      permissionGranted: true,
    }));

    setCurrentStage('LIVENESS_CHECK');
  };

  // Phase 3: Liveness & Environment Verified
  const handleLivenessCompleted = () => {
    setDeviceStatus((prev) => ({
      ...prev,
      livenessPassed: true,
      environmentPassed: true,
    }));
    setCurrentStage('TRAUMA_EXPOSURE');
  };

  const handleLivenessLogEvent = useCallback(
    (t: string, m: string, s: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED') => {
      handleLogEvent({
        eventType: t as any,
        message: m,
        severity: s,
        source: 'camera-monitor',
        resolved: true,
      });
    },
    [handleLogEvent]
  );

  // Phase 4: Trauma Exposure Endorsed
  const handleTraumaExposureCompleted = (traumaData: TraumaExposureData) => {
    setTraumaSelection(traumaData);
    setIndexTraumaLabel(traumaData.indexTrauma);
    handleLogEvent({
      eventType: 'SESSION_STARTED',
      severity: 'GREEN',
      message: `Life events completed. Questions refer to: ${traumaData.indexTrauma}.`,
      source: 'user-action',
      resolved: true,
    });

    if (traumaData.hasExposure) {
      setCurrentStage('PC_PTSD_SCREEN');
    } else {
      // User reported no exposure, proceed directly to PCL-5 or educational review
      setCurrentStage('PCL5_ASSESSMENT');
    }
  };

  // Phase 5: PC-PTSD-5 Screen Complete
  const handlePcPtsdCompleted = (answers: Record<number, boolean>, score: number) => {
    setPcPtsdResponses(answers);
    handleLogEvent({
      eventType: 'SESSION_STARTED',
      severity: 'GREEN',
      message: `Brief screen completed (${score} of 5 answered yes).`,
      source: 'user-action',
      resolved: true,
    });
    setCurrentStage('PCL5_ASSESSMENT');
  };

  // Phase 6: PCL-5 answers are kept in this view until the result is saved
  const handlePcl5Response = (questionId: number, value: number) => {
    setPcl5Responses((prev) => ({ ...prev, [questionId]: value }));
  };

  // Phase 7: PCL-5 Completed -> Functional Impact
  const handlePcl5Completed = () => {
    handleLogEvent({
      eventType: 'SESSION_STARTED',
      severity: 'GREEN',
      message: 'PCL-5 questionnaire completed.',
      source: 'user-action',
      resolved: true,
    });
    setCurrentStage('FUNCTIONAL_IMPACT');
  };

  // Phase 8: Functional Impact
  const handleFunctionalResponse = (domainId: string, value: number) => {
    setFunctionalResponses((prev) => ({ ...prev, [domainId]: value }));
  };

  const handleFunctionalCompleted = () => {
    setCurrentStage('CONTEXTUAL_INTERVIEW');
  };

  // Phase 9: Contextual AI Interview Message
  const handleSendChatMessage = async (userText: string) => {
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    };

    const earlierMessages = chatMessages;
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const data = await apiService.assessment.contextualChat({
        // Earlier turns only; the new message travels as userMessage
        messages: earlierMessages.map((m) => ({ sender: m.sender, text: m.text })),
        userMessage: userText,
        indexTrauma: indexTraumaLabel,
        completedItemsCount: Object.keys(pcl5Responses).length,
        participantId,
        language: lang,
      });

      const aiMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        sender: 'aura',
        text: data.response || "Thank you for sharing. I'm listening.",
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch {
      const aiMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        sender: 'aura',
        text: "Thank you for sharing that with me. Whenever you're ready, you can view your results.",
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    }
  };

  // Phase 10: Generate Dual Reports (Clinical + Session Integrity)
  const handleGenerateFinalReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);

    // 1. Calculate deterministic scores strictly
    const summary = calculatePcl5Summary(pcl5Responses, functionalResponses, events, SESSION_CONFIG.clinicalCutPoint);
    if (sensorStats) {
      summary.sensorStats = sensorStats;
    }
    setResultSummary(summary);
    setResultDate(new Date().toISOString());
    setSavedRecordId(null);
    setSaveError(null);
    setViewedRecord(null);

    // 2. Request the plain-language summary and session notes
    try {
      const data = await apiService.assessment.generateReport({
        participantId,
        cutPoint: summary.cutPoint,
        totalScore: summary.totalScore,
        isClinicallySignificant: summary.isClinicallySignificant,
        itemsAnswered: summary.itemsAnswered,
        clusters: summary.clusters,
        functionalImpactAvg: summary.functionalImpactAverage,
        indexTrauma: indexTraumaLabel,
        sessionIntegrityRating: summary.sessionIntegrityRating,
        eventsCount: events.length,
        sensorStats,
      });
      setUserReportText(data.userReport || '');
      setSessionReportText(data.sessionReport || '');
    } catch {
      setUserReportText(
        `Your answers give a PCL-5 total score of ${summary.totalScore} out of 80. ` +
          (summary.isClinicallySignificant
            ? `This is above the screening threshold of ${summary.cutPoint}, which means it would be worth talking with a licensed mental health professional about a fuller assessment.`
            : `This is below the screening threshold of ${summary.cutPoint}.`)
      );
      setSessionReportText('');
    } finally {
      setIsGeneratingReport(false);
    }

    handleLogEvent({
      eventType: 'ASSESSMENT_COMPLETED',
      severity: 'GREEN',
      message: `Assessment completed with PCL-5 total ${summary.totalScore}/80.`,
      source: 'system',
      resolved: true,
    });

    // The questions are done, so nothing needs the camera or microphone now
    releaseMedia();
    setCurrentStage('RESULT_SUMMARY');
  };

  // Save the current result to the participant's AURA record
  const handleSaveToHistory = async () => {
    // Each result is saved once, however many times the results page is revisited
    if (!resultSummary || savedRecordId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const { record, error } = await proctoredAssessmentService.save({
      participantId,
      administeredAt: resultDate,
      assessmentVersion: SESSION_CONFIG.version,
      cutPoint: resultSummary.cutPoint,
      pcl5Responses,
      functionalResponses,
      pcPtsdResponses,
      indexTraumaLabel: indexTraumaLabel || 'General traumatic stress',
      events,
      sensorStats: resultSummary.sensorStats || sensorStats,
      userReport: userReportText,
      sessionReport: sessionReportText,
      researchConsent,
    });

    setIsSaving(false);
    if (error || !record) {
      setSaveError("Your results couldn't be saved. Check your connection and try again.");
      return;
    }
    setHistory((prev) => [...prev, record]);
    setSavedRecordId(record.id);
  };

  // Rebuild a results summary from a saved record
  const summaryFromRecord = (rec: CompletedAssessmentRecord): Pcl5ResultSummary => ({
    ...calculatePcl5Summary(rec.responses, rec.functionalProfile ?? {}, rec.events ?? [], rec.cutPoint),
    totalScore: rec.totalScore,
    isClinicallySignificant: rec.isClinicallySignificant,
    functionalImpactAverage: rec.functionalImpactAvg,
    sessionIntegrityRating: rec.sessionIntegrityRating,
    sensorStats: rec.sensorStats,
  });

  // Restart assessment
  const handleRestart = () => {
    releaseMedia();
    setPcl5Responses({});
    setFunctionalResponses({});
    setPcPtsdResponses({});
    setEvents([]);
    setSensorStats(null);
    setProctorSeverity('GREEN');
    setResultSummary(null);
    setUserReportText('');
    setSessionReportText('');
    setIndexTraumaLabel('');
    setTraumaSelection(null);
    setScreenMode(null);
    setSavedRecordId(null);
    setSaveError(null);
    setViewedRecord(null);
    setResearchConsent(false);
    setDeviceStatus({
      cameraActive: false,
      microphoneActive: false,
      screenShareActive: false,
      livenessPassed: false,
      environmentPassed: false,
      permissionGranted: false,
    });
    // A new assessment must not show the previous conversation
    setChatMessages([WELCOME_MESSAGE]);
    setCurrentStage('CONSENT');
  };

  // Pause Controls
  const handleOpenPause = () => {
    setIsPauseOpen(true);
    handleLogEvent({
      eventType: 'SESSION_PAUSED',
      severity: 'YELLOW',
      message: 'Assessment paused.',
      source: 'user-action',
      resolved: false,
    });
  };

  const handleResume = () => {
    setIsPauseOpen(false);
    handleLogEvent({
      eventType: 'SESSION_RESUMED',
      severity: 'GREEN',
      message: 'Assessment resumed.',
      source: 'user-action',
      resolved: true,
    });
  };

  const handleExitToSummaryOrConsent = () => {
    setIsPauseOpen(false);
    if (Object.keys(pcl5Responses).length > 0) {
      handleGenerateFinalReport();
    } else {
      handleRestart();
    }
  };

  // Stop the camera, microphone and screen share whenever the held streams
  // change, and when the person leaves this page for any other AURA view.
  useEffect(() => {
    return () => {
      if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
      if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
      if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
    };
  }, [videoStream, audioStream, screenStream]);

  const showProctorOverlay =
    (currentStage === 'PCL5_ASSESSMENT' ||
      currentStage === 'FUNCTIONAL_IMPACT' ||
      currentStage === 'CONTEXTUAL_INTERVIEW') &&
    deviceStatus.permissionGranted;

  const backFromHistory = () => {
    if (resultSummary) setCurrentStage('RESULT_SUMMARY');
    else if (Object.keys(pcl5Responses).length > 0) setCurrentStage('PCL5_ASSESSMENT');
    else setCurrentStage('CONSENT');
  };

  return (
    <div className="pa-root flex flex-col text-stone-900 antialiased selection:bg-teal-200">
      <Header
        currentStage={currentStage}
        deviceStatus={deviceStatus}
        proctorSeverity={proctorSeverity}
        onPause={handleOpenPause}
        onOpenCrisis={onOpenEmergency}
        onViewHistory={() => {
          setViewedRecord(null);
          setCurrentStage('HISTORY_VIEW');
          loadHistory();
        }}
        completedQuestionsCount={Object.keys(pcl5Responses).length}
      />

      {/* Extra bottom space while the session monitor is shown, so it never hides the step's buttons */}
      <div className={`flex-1 px-4 pt-8 sm:px-6 ${showProctorOverlay ? 'pb-80' : 'pb-16'}`}>
        {currentStage === 'CONSENT' && (
          <ConsentSafetyModal
            participantId={participantId}
            onAccept={handleConsentAccepted}
            onOpenCrisis={onOpenEmergency}
          />
        )}

        {currentStage === 'DEVICE_CHECK' && (
          <DeviceCheckStep
            onComplete={handleDeviceCheckCompleted}
            onLogEvent={(t, m, s) =>
              handleLogEvent({
                eventType: t as any,
                message: m,
                severity: s,
                source: 'system',
                resolved: true,
              })
            }
          />
        )}

        {currentStage === 'LIVENESS_CHECK' && (
          <LivenessEnvironmentStep
            videoStream={videoStream}
            onComplete={handleLivenessCompleted}
            onLogEvent={handleLivenessLogEvent}
          />
        )}

        {currentStage === 'TRAUMA_EXPOSURE' && (
          <TraumaExposureStep
            initialData={traumaSelection}
            onComplete={handleTraumaExposureCompleted}
            onBack={() => setCurrentStage('LIVENESS_CHECK')}
          />
        )}

        {currentStage === 'PC_PTSD_SCREEN' && (
          <PcPtsdScreenStep
            initialAnswers={pcPtsdResponses}
            onComplete={handlePcPtsdCompleted}
            onBack={() => setCurrentStage('TRAUMA_EXPOSURE')}
          />
        )}

        {currentStage === 'PCL5_ASSESSMENT' && (
          <Pcl5AssessmentStep
            responses={pcl5Responses}
            onSaveResponse={handlePcl5Response}
            onComplete={handlePcl5Completed}
            onBack={() => setCurrentStage(traumaSelection?.hasExposure ? 'PC_PTSD_SCREEN' : 'TRAUMA_EXPOSURE')}
            indexTraumaLabel={indexTraumaLabel}
          />
        )}

        {currentStage === 'FUNCTIONAL_IMPACT' && (
          <FunctionalImpactStep
            functionalResponses={functionalResponses}
            onSaveResponse={handleFunctionalResponse}
            onComplete={handleFunctionalCompleted}
            onBack={() => setCurrentStage('PCL5_ASSESSMENT')}
          />
        )}

        {currentStage === 'CONTEXTUAL_INTERVIEW' && (
          <ContextualInterviewStep
            messages={chatMessages}
            onSendMessage={handleSendChatMessage}
            onComplete={handleGenerateFinalReport}
            onBack={() => setCurrentStage('FUNCTIONAL_IMPACT')}
            indexTraumaLabel={indexTraumaLabel}
            isGeneratingReport={isGeneratingReport}
          />
        )}

        {currentStage === 'RESULT_SUMMARY' && viewedRecord && (
          <ResultReportView
            key={viewedRecord.id}
            summary={summaryFromRecord(viewedRecord)}
            indexTraumaLabel={viewedRecord.indexTraumaLabel}
            userReportText={viewedRecord.detailedReport || viewedRecord.summaryText}
            sessionReportText={viewedRecord.integrityReport || ''}
            events={viewedRecord.events ?? []}
            eventsSaved={viewedRecord.events !== undefined}
            participantId={viewedRecord.participantId ?? ''}
            resultDate={viewedRecord.date}
            isPastRecord
            onRestart={handleRestart}
            onOpenCrisis={onOpenEmergency}
          />
        )}

        {currentStage === 'RESULT_SUMMARY' && !viewedRecord && resultSummary && (
          <ResultReportView
            key="current"
            summary={resultSummary}
            indexTraumaLabel={indexTraumaLabel}
            userReportText={userReportText}
            sessionReportText={sessionReportText}
            events={events}
            participantId={participantId}
            resultDate={resultDate}
            isSaved={savedRecordId !== null}
            isSaving={isSaving}
            saveError={saveError}
            onSaveToHistory={handleSaveToHistory}
            onRestart={handleRestart}
            onOpenCrisis={onOpenEmergency}
          />
        )}

        {currentStage === 'HISTORY_VIEW' && (
          <AssessmentHistoryView
            history={history}
            status={historyStatus}
            onRetry={loadHistory}
            onBack={backFromHistory}
            onSelectRecord={(rec) => {
              // Open the saved record read-only; the current result stays untouched
              setViewedRecord(rec);
              setCurrentStage('RESULT_SUMMARY');
            }}
          />
        )}
      </div>

      {/* Non-intrusive Floating Proctor Overlay */}
      {showProctorOverlay && (
        <ProctorMonitorOverlay
          videoStream={videoStream}
          audioStream={audioStream}
          screenStream={screenStream}
          screenMode={screenMode}
          faceAbsenceGraceSeconds={SESSION_CONFIG.faceAbsenceThresholdSeconds}
          onLogEvent={handleLogEvent}
          onUpdateStats={(stats) => setSensorStats(stats)}
          currentSeverity={proctorSeverity}
        />
      )}

      {/* Safety Grounding Pause Modal */}
      <PauseSafetyModal
        isOpen={isPauseOpen}
        onResume={handleResume}
        onExit={handleExitToSummaryOrConsent}
        onOpenCrisis={onOpenEmergency}
      />
    </div>
  );
};

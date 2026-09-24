/**
 * Aura AI-Proctored Trauma Assessment - Domain Types
 */

export type AssessmentStage =
  | 'WELCOME'
  | 'CONSENT'
  | 'SAFETY_CHECK'
  | 'DEVICE_CHECK'
  | 'LIVENESS_CHECK'
  | 'ENVIRONMENT_CHECK'
  | 'TRAUMA_EXPOSURE'
  | 'INDEX_TRAUMA'
  | 'PC_PTSD_SCREEN'
  | 'PCL5_ASSESSMENT'
  | 'FUNCTIONAL_IMPACT'
  | 'CONTEXTUAL_INTERVIEW'
  | 'RESULT_SUMMARY'
  | 'HISTORY_VIEW'
  | 'ADMIN_RESEARCH';

export type SessionState =
  | 'READY'
  | 'DEVICE_CHECK'
  | 'IDENTITY_CHECK'
  | 'ENVIRONMENT_CHECK'
  | 'VERIFIED'
  | 'ASSESSMENT_ACTIVE'
  | 'PAUSED'
  | 'SESSION_EVENT'
  | 'SIGNIFICANT_EVENT'
  | 'SESSION_INVALID'
  | 'COMPLETED'
  | 'TERMINATED';

export type EventSeverity = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export type SessionIntegrityRating =
  | 'VERIFIED'
  | 'MINOR_SESSION_EVENTS'
  | 'SIGNIFICANT_SESSION_EVENTS'
  | 'UNABLE_TO_VERIFY';

export interface ProctorEvent {
  id: string;
  timestamp: string;
  eventType:
    | 'SESSION_STARTED'
    | 'DEVICE_VERIFIED'
    | 'LIVENESS_VERIFIED'
    | 'ENVIRONMENT_VERIFIED'
    | 'CAMERA_LOST'
    | 'CAMERA_RESTORED'
    | 'MICROPHONE_LOST'
    | 'MICROPHONE_RESTORED'
    | 'SCREEN_SHARE_STARTED'
    | 'SCREEN_SHARE_STOPPED'
    | 'SCREEN_SHARE_RESTORED'
    | 'TAB_SWITCH'
    | 'WINDOW_FOCUS_LOST'
    | 'WINDOW_FOCUS_RESTORED'
    | 'MULTIPLE_PERSON_DETECTED'
    | 'FACE_NOT_DETECTED'
    | 'FACE_RETURNED'
    | 'CAMERA_OBSTRUCTED'
    | 'CAMERA_CLEAR'
    | 'PROCTOR_RECALIBRATED'
    | 'SPEECH_DETECTED'
    | 'SESSION_PAUSED'
    | 'SESSION_RESUMED'
    | 'ASSESSMENT_COMPLETED';
  severity: EventSeverity;
  message: string;
  source: 'camera-monitor' | 'microphone-monitor' | 'screen-monitor' | 'browser-focus' | 'user-action' | 'system';
  durationSeconds?: number;
  confidence?: number;
  resolved: boolean;
}

export interface DeviceStatus {
  cameraActive: boolean;
  microphoneActive: boolean;
  screenShareActive: boolean;
  livenessPassed: boolean;
  environmentPassed: boolean;
  permissionGranted: boolean;
}

export interface Lec5EventItem {
  id: string;
  category: string;
  description: string;
}

export interface Pcl5Question {
  id: number;
  cluster: 'B' | 'C' | 'D' | 'E';
  clusterName: string;
  text: string;
  subtext?: string;
}

export interface FunctionalImpactDomain {
  id: string;
  domain: string;
  description: string;
}

export interface SensorMonitoringStats {
  sessionDurationSeconds: number;
  totalFramesAnalyzed: number;
  faceDetectedFrames: number;
  faceRetentionPercentage: number;
  centerPosePercentage: number;
  averageLuminance: number;
  blackScreenFrames: number;
  obstructionEventsCount: number;
  multiplePersonsSuspectedCount: number;
  totalAudioSamples: number;
  averageVolumeDb: number;
  peakVolumeDb: number;
  speechActivitySeconds: number;
  ambientSilencePercentage: number;
  screenShareActive: boolean;
  screenShareType: 'display_stream' | 'window_focus_proctor' | 'none';
  windowFocusPercentage: number;
  windowBlurEventsCount: number;
  tabSwitchCount: number;
  totalBlurDurationSeconds: number;
}

export interface Pcl5ClusterScore {
  score: number;
  maxScore: number;
  percentage: number;
  symptomSeverity: 'Minimal' | 'Mild' | 'Moderate' | 'Severe';
}

export interface Pcl5ResultSummary {
  totalScore: number;
  maxScore: number;
  cutPoint: number;
  isClinicallySignificant: boolean;
  clusters: {
    B: Pcl5ClusterScore; // Intrusion (Items 1-5, max 20)
    C: Pcl5ClusterScore; // Avoidance (Items 6-7, max 8)
    D: Pcl5ClusterScore; // Negative alterations in cognitions and mood (Items 8-14, max 28)
    E: Pcl5ClusterScore; // Alterations in arousal and reactivity (Items 15-20, max 24)
  };
  functionalImpactTotal: number;
  functionalImpactAverage: number;
  functionalImpactProfile: Record<string, number>;
  sessionIntegrityRating: SessionIntegrityRating;
  eventCount: {
    green: number;
    yellow: number;
    orange: number;
    red: number;
  };
  sensorStats?: SensorMonitoringStats;
}

export interface ChatMessage {
  id: string;
  sender: 'aura' | 'user';
  text: string;
  timestamp: string;
}

export interface CompletedAssessmentRecord {
  id: string;
  date: string;
  indexTraumaLabel: string;
  totalScore: number;
  isClinicallySignificant: boolean;
  clusterScores: {
    intrusion: number;
    avoidance: number;
    negativeCognitions: number;
    arousal: number;
  };
  functionalImpactAvg: number;
  sessionIntegrityRating: SessionIntegrityRating;
  summaryText: string;
  detailedReport?: string;
  integrityReport?: string;
  eventsCount: number;
  sensorStats?: SensorMonitoringStats;
  responses: Record<number, number>;
  // Added later; records saved before these existed won't have them
  participantId?: string;
  cutPoint?: number;
  functionalProfile?: Record<string, number>;
  events?: ProctorEvent[];
}

export interface SessionConfiguration {
  version: string;
  sessionTimeoutMinutes: number;
  cameraLossGraceSeconds: number;
  faceAbsenceThresholdSeconds: number;
  requireScreenShare: boolean;
  allowVoiceInput: boolean;
  clinicalCutPoint: number;
  retentionPolicyDays: number;
}

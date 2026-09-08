export type WellbeingScore = number;
export type SafetyResponse = "Yes" | "Mostly" | "Unsure" | "No" | string;
export type UserRole = "participant" | "support_worker";

export type SupportPriority = 
  | "Routine" 
  | "Monitor" 
  | "Follow-up Recommended" 
  | "Urgent";

export type CaseStatus = 
  | "Stable" 
  | "Improving" 
  | "Needs follow-up" 
  | "Human review pending" 
  | "Urgent safety signal";

export type TrajectoryCategory = 
  | "Stable"
  | "Improving"
  | "Gradually Increasing"
  | "Rapid Change"
  | "Fluctuating"
  | "Recovering After Support";

export type LanguageCode = "en" | "hi" | "mr";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  language?: string;
  ageRange?: string;
  supportPreference?: string;
  consentGiven: boolean;
  createdAt: string;
  // Optional, always skippable — a trusted contact the participant chooses to
  // name for emergencies. Some atrocity survivors cannot safely name anyone,
  // so this is never required. Stored in Supabase Auth user_metadata only.
  emergencyContact?: string;
  // Counsellor-only, self-edited profile fields. Stored in Supabase Auth
  // user_metadata; surfaced on the support dashboard.
  languages?: string;
  availability?: string;
  maxCaseload?: number;
}

/**
 * Somatic complaints reported alongside the mood questions. Across much of
 * South Asia distress is voiced through the body — heaviness, heat, pain,
 * exhaustion — by people who will sincerely rate their mood as fine, so
 * asking only about feelings misses them entirely.
 */
export type SomaticSymptom =
  | "headaches"
  | "appetite_change"
  | "unexplained_pain"
  | "palpitations"
  | "exhaustion"
  | "none_reported";

/**
 * Questions about what a person did, not how they feel. Someone who will not
 * say "I feel hopeless" will still say they slept three hours and have not
 * left the house — behaviour is far harder to posture on than mood, and
 * these answers are what the concordance check weighs the self-report
 * against. Every field is optional: all of it is skippable, like the rest of
 * the check-in.
 */
export interface FunctionalSignals {
  /** Hours slept last night, 0-12. */
  sleepHours?: number;
  /** Meals eaten yesterday, 0-4. */
  mealsYesterday?: number;
  leftHome?: boolean;
  spokeToAnyone?: boolean;
  somaticSymptoms?: SomaticSymptom[];
}

/**
 * How the check-in was answered rather than what was answered. Collected
 * passively and disclosed on the consent gate; used only to mark a
 * submission low-confidence, never to raise anyone's distress score.
 */
export interface ResponseMetadata {
  /** Wall-clock seconds from first question to submission. */
  completionSeconds?: number;
  /** Whether the person said they were somewhere they could answer freely. */
  privateSpace?: boolean;
}

/** One signal weighed against what the participant reported about themselves. */
export interface ConcordanceSignal {
  key: string;
  label: string;
  /** The measured value, formatted for a support worker to read. */
  reading: string;
  verdict: "supports" | "contradicts" | "neutral";
  /** Why this reading disagrees, shown only when it does. */
  note?: string;
  /** Strong enough to warrant a second look on its own, with no corroboration. */
  strong?: boolean;
}

export interface ConcordanceResult {
  /** How the person rated themselves, bucketed. */
  claim: "fine" | "struggling" | "middling";
  signals: ConcordanceSignal[];
  contradicting: number;
  supporting: number;
  level: "aligned" | "partial" | "diverging" | "insufficient";
  /** Whether a support worker should look at this despite a low score. */
  needsSecondLook: boolean;
  /** Reasons to trust the whole submission less (privacy, straight-lining). */
  caveats: string[];
  summary: string;
  assessedAt: string;
}

export interface CheckIn {
  id: string;
  participantId: string;
  timestamp: string;
  wellbeing: WellbeingScore; // 1 (Very difficult) to 5 (Good)
  stress: WellbeingScore;    // 1 (Calm) to 5 (Very stressed)
  sleep: WellbeingScore;     // 1 (Very difficult) to 5 (Good)
  safety: SafetyResponse;   // 'Yes' | 'Mostly' | 'Unsure' | 'No'
  connection: WellbeingScore;// 1 (Isolated) to 5 (Well-connected)
  supportRequested: boolean;
  immediateSafetyConcern: boolean;
  calculatedScore?: number;
  aiComprehensiveAnalysis?: any;
  optionalNote?: string;
  notes?: string;
  shareNoteWithWorker?: boolean;
  voiceInputUsed?: boolean;
  reflection?: ParticipantReflection;
  analysis?: CheckInAnalysis;
  /** Behavioural and somatic answers — see FunctionalSignals. */
  functional?: FunctionalSignals;
  /** How the check-in was answered — see ResponseMetadata. */
  responseMeta?: ResponseMetadata;
}

export type LanguageSignalCategory =
  | "Positive / hopeful language"
  | "Neutral / ordinary language"
  | "Stress-related language"
  | "Overwhelm / burden language"
  | "Fear / uncertainty language"
  | "Social connection language"
  | "Sleep-related language"
  | "Safety-related language"
  | "Support-seeking language"
  | "Mixed language signal"
  | "None";

export interface GeminiAnalysisResult {
  traumaIndicators: TraumaIndicator[];
  distressSignals: DistressSignal[];
  riskBand: RiskBand;
  crisisFlag: boolean;
  rationale: string;
  confidence: "low" | "medium" | "high";
  suggestedHumanAction: string;
  emotionalState: string;
  language: string;
  uncertainty: boolean;
  evidence: string;
  isUrgent?: boolean;
}

export interface ReflectionAnalysisResult {
  sentiment: "positive" | "neutral" | "mixed" | "stressed" | "overwhelmed" | "safety_concern" | "none";
  languageSignal: LanguageSignalCategory;
  contributingPatterns: string[];
  keywords: string[];
  factors: string[];
  explanation: string;
  isDemoSample?: boolean;
  contextNotes?: string;
  hasUrgentSafetyMention?: boolean;
}

export type TraumaIndicator =
  | "physical_violence"
  | "sexual_violence"
  | "death_or_loss"
  | "forced_displacement"
  | "torture"
  | "witnessing_atrocity"
  | "psychological_abuse"
  | "none_detected";

export type DistressSignal =
  | "intrusive_memories"
  | "hypervigilance"
  | "emotional_numbing"
  | "dissociation"
  | "hopelessness"
  | "sleep_disturbance"
  | "survivor_guilt"
  | "social_withdrawal"
  | "none_detected";

export type RiskBand = "low" | "moderate" | "elevated" | "high";

export interface AcousticDeliverySummary {
  pitchVariabilityScore: number;
  speakingRateWpm: number;
  pauseRatio: number;
  energyScore: number;
  durationSeconds: number;
  voicedSampleCount: number;
}

export interface VoiceToneAnalysisResult {
  emotionalTone: string;
  toneConfidence: "low" | "medium" | "high";
  toneRationale: string;
  contentVsDeliveryAlignment: "aligned" | "mismatched" | "unclear";
  traumaIndicators: TraumaIndicator[];
  distressSignals: DistressSignal[];
  riskBand: RiskBand;
  crisisFlag: boolean;
  rationale: string;
  confidence: "low" | "medium" | "high";
  suggestedHumanAction: string;
  acousticFeatures: AcousticDeliverySummary;
}

export interface ParticipantReflection {
  id: string;
  participantId: string;
  type: "text" | "voice";
  transcript: string;
  audioRecorded: boolean;
  shareWithWorker: boolean;
  sentiment: string;
  timestamp: string;
  analysis: ReflectionAnalysisResult;
  aiAnalysis?: GeminiAnalysisResult;
  voiceToneAnalysis?: VoiceToneAnalysisResult;
}

export interface FactorContribution {
  name: string;
  impact: "high" | "medium" | "low" | "positive";
  description: string;
  weightPercent: number;
}

export type RecommendationCategory =
  | "ROUTINE"
  | "SLEEP"
  | "STRESS"
  | "SOCIAL"
  | "EMOTIONAL_SUPPORT"
  | "PROFESSIONAL_SUPPORT"
  | "SAFETY"
  | "FOLLOW_UP";

export interface Recommendation {
  category: RecommendationCategory;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  actionLabel?: string;
  actionType?: string;
}

export type DistressLevel =
  | "LOW"
  | "MILD"
  | "MODERATE"
  | "ELEVATED"
  | "HIGH"
  | "VERY_HIGH";

export interface CheckInAnalysis {
  checkInId: string;
  participantId: string;
  distressScore: number;
  /** The transparent rule-based score, before any AI adjustment. */
  ruleScore?: number;
  /** Points the AI moved the score by, bounded by AI_SCORE_ADJUSTMENT_LIMIT. */
  aiAdjustment?: number;
  /** Whether the AI was consulted at all — it only runs on a reflection. */
  aiConsulted?: boolean;
  /** The model's own 0-100 reading, before bounding. */
  aiRawScore?: number;
  /** True when the model wanted to move the score further than it was allowed. */
  aiClamped?: boolean;
  level: DistressLevel;
  levelLabel: string;
  previousScore?: number;
  change?: number;
  trend: "IMPROVING" | "STABLE" | "INCREASING" | "RAPID_INCREASE";
  factors: {
    stress?: number;
    sleep?: number;
    mood?: number;
    safety?: string;
    socialConnection?: number;
    functioning?: number;
  };
  factorPercentages: {
    stress: number;
    sleep: number;
    emotionalWellbeing: number;
    socialConnection: number;
    functioning: number;
  };
  contributingFactors: string[];
  explanation: string;
  explanationPoints: string[];
  recommendations: Recommendation[];
  primaryAction: string;
  supportiveMessage: string;
  requiresHumanReview: boolean;
  isExplicitSafetyConcern: boolean;
  createdAt: string;
}

/**
 * One weighted question's contribution to the distress score, carrying both
 * the general rule and the same rule with this participant's own answer
 * substituted, so the results screen can show the working rather than just
 * asserting a number.
 */
export interface ScoreTerm {
  key: string;
  label: string;
  /** What the participant answered, e.g. "3/5" or "Unsure". */
  response: string;
  /** The rule with their answer substituted, e.g. "((3 - 1) / 4) x 20". */
  expression: string;
  /** The general rule, e.g. "((stress - 1) / 4) x 20". */
  formula: string;
  /** Points contributed, before the total is rounded. */
  points: number;
  /** Most this question can contribute. */
  maxPoints: number;
}

export interface ScoreBreakdown {
  terms: ScoreTerm[];
  /** Sum of every term, before rounding and clamping. */
  subtotal: number;
  /** The published score: subtotal rounded, then clamped to 0-100. */
  score: number;
  /** True when an immediate-safety answer pinned the score to 100 outright. */
  overridden: boolean;
  overrideReason?: string;
}

export interface RiskAnalysis {
  score: number;
  previousScore: number | null;
  change: number;
  level: SupportPriority;
  factors: string[];
  detailedFactors: FactorContribution[];
  recommendation: string;
  requiresHumanReview: boolean;
  trendDirection: "increasing" | "decreasing" | "stable";
  calculatedAt: string;
}

export interface TrajectoryAnalysis {
  currentScore: number;
  previousScore: number | null;
  movingAvg3: number;
  trend7: number[];
  rateOfChange: number;
  volatility: number;
  consecutiveWorsening: number;
  consecutiveImproving: number;
  recoveringAfterSupport: boolean;
  suddenChangeDetected: boolean;
  category: TrajectoryCategory;
  classification?: TrajectoryCategory;
  categoryRationale: string;
  summary: string;
  summaryDescription?: string;
}

export interface EarlyWarningForecast {
  currentScore: number;
  projectedMin: number;
  projectedMax: number;
  projectedMid: number;
  trajectory: "Increasing" | "Stable" | "Decreasing" | "Fluctuating";
  signal: string;
  recommendedAction: string;
  confidenceBand: "Low" | "Medium" | "High";
  historicalSeries: {
    label: string;
    score: number;
    isProjected?: boolean;
    min?: number;
    max?: number;
  }[];
}

export interface SupportRecommendation {
  primaryRecommendation: string;
  priority: SupportPriority;
  conversationFocus: string;
  resources: string[];
  rationale: string;
  factors?: string[];
  contributingFactors?: string[];
  requiresHumanReview: boolean;
}

export interface SupportNote {
  id: string;
  author: string;
  timestamp: string;
  text: string;
  actionTaken?: string;
}

export type AlertSeverity =
  | "GREEN"
  | "YELLOW"
  | "ORANGE"
  | "RED"
  | "routine"
  | "moderate"
  | "elevated"
  | "urgent";

export type AlertCategory =
  | "STABLE"
  | "IMPROVEMENT"
  | "MONITORING"
  | "ELEVATED"
  | "HIGH"
  | "PRIORITY"
  | "EARLY_WARNING"
  | "PERSISTENT_INCREASE"
  | "SAFETY_CONCERN"
  | "SUPPORT_REQUEST"
  | "FOLLOW_UP_DUE"
  | "RECOVERY";

export type AlertStatus =
  | "NEW"
  | "ACKNOWLEDGED"
  | "IN_REVIEW"
  | "FOLLOW_UP_ASSIGNED"
  | "MONITORING"
  | "RESOLVED"
  | "SAFETY_ESCALATED"
  | "pending_review"
  | "reviewed"
  | "escalated"
  | "dismissed";

export interface Alert {
  id: string;
  participantId: string;
  // Display name of the participant this alert is about, resolved at the data
  // layer (profiles.name) so staff-facing lists never fall back to a raw id.
  participantName?: string;
  // The participant's CURRENT assigned counsellor id, resolved at the data
  // layer so caseload scoping doesn't depend on a possibly-stale client list.
  participantAssignedWorker?: string | null;
  category?: AlertCategory;
  severity: AlertSeverity;
  title?: string;
  description?: string;
  reason: string;
  recommendedAction?: string;
  createdAt: string;
  updatedAt?: string;
  status: AlertStatus;
  assignedTo?: string;
  humanDecision?: "follow_up_scheduled" | "continue_monitoring" | "resolved" | "emergency_dispatched" | string;
  decisionNotes?: string;
  actionTaken?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  changeDelta?: number;
  score: number;
  occurrenceCount?: number;
  contributingFactors?: string[];
  trajectory?: string;
  requiresHumanReview?: boolean;
  notifyParticipant?: boolean;
  notifySupportWorker?: boolean;
  isDemoSample?: boolean;
}

export type NotificationCategory =
  | "all"
  | "unread"
  | "priority"
  | "support_request"
  | "follow_up"
  | "improvement"
  | "general";

export interface AppNotification {
  id: string;
  userId: string;
  participantId?: string;
  category: AlertCategory | "SYSTEM" | "REMINDER";
  filterCategory?: "priority" | "support_request" | "follow_up" | "improvement" | "general";
  severity: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "INFO";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionLabel?: string;
  actionView?: string;
  actionParticipantId?: string;
  metadata?: {
    score?: number;
    change?: number;
    factors?: string[];
    trajectory?: string;
  };
}

export interface ParticipantNotificationPreferences {
  checkInReminders: boolean;
  supportUpdates: boolean;
  followUpReminders: boolean;
  wellbeingUpdates: boolean;
  safetyGuidanceEnforced: boolean; // Always true
}

export interface WorkerNotificationPreferences {
  priorityAlerts: boolean;
  humanReviewAlerts: boolean;
  supportRequests: boolean;
  followUpReminders: boolean;
  dailySummary: boolean;
}

export interface InterventionFollowUp {
  id: string;
  participantId: string;
  alertId?: string;
  originalScore: number;
  interventionType: string;
  interventionDate: string;
  workerName: string;
  followUpScore?: number;
  followUpDate?: string;
  scoreDelta?: number;
  outcome: "improving" | "no_change" | "worsening" | "pending";
  outcomeLabel: string;
  notes: string;
}

export interface SupportTimelineEvent {
  id: string;
  dayLabel: string;
  date: string;
  type: "checkin" | "alert" | "review" | "intervention" | "followup" | "improvement";
  title: string;
  score?: number;
  details: string;
  actor?: string;
}

export type AuditEventActorRole =
  | "PARTICIPANT"
  | "SUPPORT_WORKER"
  | "ADMIN"
  | "SYSTEM";

export type AuditEventCategory =
  | "AUTH"
  | "CHECK_IN"
  | "ANALYSIS"
  | "ALERT"
  | "NOTIFICATION"
  | "PROFILE"
  | "SUPPORT"
  | "FOLLOW_UP"
  | "SAFETY"
  | "SYSTEM";

export type AuditCategory = AuditEventCategory;

export type AuditEventSeverity = "INFO" | "WARNING" | "HIGH";

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: AuditEventActorRole;
  actorName?: string;
  action: string;
  category: AuditEventCategory;
  participantId?: string;
  targetId?: string;
  description: string;
  severity?: AuditEventSeverity;
  metadata?: Record<string, unknown>;
  // Backwards compatibility helpers
  workerName?: string;
  details?: string;
}

export type AuditLogEntry = AuditEvent;

export interface ConsentPreferences {
  wellbeingCheckIns: boolean;
  supportWorkerSharing: boolean;
  optionalFreeTextSharing: boolean;
  optionalVoiceFeature: boolean;
  communityAggregateAnalytics: boolean;
  updatedAt: string;
}

export interface RegionPlanningData {
  regionId: string;
  name: string;
  code: string;
  activeParticipants: number;
  demandTrend: "increasing" | "stable" | "decreasing";
  demandScore: number;
  supportRequestsCount: number;
  recommendedCounselors: number;
  currentCounselors: number;
  signalNote: string;
}

export interface Participant {
  id: string;
  // Display name only (sourced from profiles.name, set at signup). `id`
  // remains the durable unique identifier used everywhere internally
  // (foreign keys, audit trail, URLs, anonymized oversight views) — this
  // field exists purely so staff-facing UI can show a person's name instead
  // of their raw ID. Optional because legacy/demo participant rows created
  // before the Supabase migration have no linked auth user / profile.
  name?: string;
  consentGiven: boolean;
  createdAt: string;
  preferredSupport: string;
  language: string;
  ageGroup: string;
  checkIns: CheckIn[];
  status: CaseStatus;
  notes: SupportNote[];
  assignedWorker?: string;
  lastReviewDate?: string;
  region?: string;
  consentPreferences?: ConsentPreferences;
  followUps?: InterventionFollowUp[];
}

/**
 * A direct message between a participant and their currently assigned
 * counselor. Restricted at the RLS level to just that pair — not
 * visible to other staff the way alerts/notes are (see the `messages`
 * table policies).
 */
export interface Message {
  id: string;
  participantId: string;
  senderId: string;
  senderRole: "participant" | "support_worker";
  body: string;
  read: boolean;
  createdAt: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  targetParticipantId: string;
  badge: string;
  accent: string;
  simulatedTrend: number[];
}

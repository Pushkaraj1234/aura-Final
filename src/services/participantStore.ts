import {
  Participant,
  CheckIn,
  Alert,
  User,
  SupportNote,
  CaseStatus,
  AlertStatus,
  AuditLogEntry,
  AuditEvent,
  InterventionFollowUp,
  ParticipantNotificationPreferences,
  WorkerNotificationPreferences
} from "../types";
import { calculateRawScore } from "./riskEngine";
import { evaluateCheckIn, AlertDecision } from "./alertEngine";
import { notificationService } from "./notificationService";
import { calculateCheckInAnalysis } from "./recommendationEngine";
import { CheckInAnalysis } from "../types";
import { auditService } from "./auditService";
import { apiService } from "./apiService";
import { syncEngine } from "./syncEngine";
import { MOCK_PARTICIPANTS, INITIAL_ALERTS } from "./mockData";

const PARTICIPANTS_KEY = "aura_participants_v2";
const ALERTS_KEY = "aura_alerts_v2";
const USERS_KEY = "aura_users_v2";
const FOLLOWUPS_KEY = "aura_followups_v2";
const NOTIF_PREFS_KEY = "aura_notif_prefs_v2";
const STORAGE_VER_KEY = "aura_storage_ver_v2";
const CURRENT_VERSION = "2.6";

// Helper to notify listeners of data state changes
const notifyChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aura_data_updated"));
  }
};

const getStoredParticipants = (): Participant[] => {
  try {
    const raw = localStorage.getItem(PARTICIPANTS_KEY);
    if (!raw || raw === "[]") {
      saveStoredParticipants(MOCK_PARTICIPANTS);
      return MOCK_PARTICIPANTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : MOCK_PARTICIPANTS;
  } catch {
    return MOCK_PARTICIPANTS;
  }
};

const saveStoredParticipants = (participants: Participant[]) => {
  try {
    localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(participants));
    notifyChange();
  } catch (e) {
    console.error("Failed to save participants to localStorage", e);
  }
};

const getStoredAlerts = (): Alert[] => {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    if (!raw || raw === "[]") {
      saveStoredAlerts(INITIAL_ALERTS);
      return INITIAL_ALERTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ALERTS;
  } catch {
    return INITIAL_ALERTS;
  }
};

const saveStoredAlerts = (alerts: Alert[]) => {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    notifyChange();
  } catch (e) {
    console.error("Failed to save alerts to localStorage", e);
  }
};

const getStoredAuditLogs = (): AuditLogEntry[] => {
  return auditService.getAuditEvents();
};

const saveStoredAuditLogs = (_logs: AuditLogEntry[]) => {
  // Persistence managed by auditService
};

const getStoredFollowUps = (): InterventionFollowUp[] => {
  try {
    const raw = localStorage.getItem(FOLLOWUPS_KEY);
    // No hardcoded sample: real follow-ups come from the backend (seeded with
    // real participant ids) via syncWithBackend, or are created when a
    // counsellor assigns a voluntary follow-up from an alert.
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const saveStoredFollowUps = (followUps: InterventionFollowUp[]) => {
  try {
    localStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(followUps));
    notifyChange();
  } catch (e) {
    console.error("Failed to save followUps to localStorage", e);
  }
};

let isInitialized = false;

export const participantStore = {
  // Initialize storage versioning and trigger backend sync
  init: () => {
    if (isInitialized) return;
    isInitialized = true;
    try {
      const ver = localStorage.getItem(STORAGE_VER_KEY);
      if (ver !== CURRENT_VERSION) {
        // The cached participants/alerts shape changed (names + assignment are
        // now resolved at the data layer). Drop the stale caches so the next
        // sync repopulates them cleanly instead of showing old id-only rows.
        localStorage.setItem(PARTICIPANTS_KEY, "[]");
        localStorage.setItem(ALERTS_KEY, "[]");
        // Also drop follow-ups: they are now pulled from the backend (real
        // participant ids) rather than a hardcoded local sample.
        localStorage.setItem(FOLLOWUPS_KEY, "[]");
        // Seed default demo notifications for demo workers
        notificationService.seedDemoNotifications();
        localStorage.setItem(STORAGE_VER_KEY, CURRENT_VERSION);
      }
    } catch (e) {
      console.warn("Storage init warning:", e);
    }
    // Asynchronously synchronize with FastAPI PostgreSQL backend
    participantStore.syncWithBackend().catch((err) => {
      console.warn("[ParticipantStore] Async backend sync notice:", err);
    });
  },

  syncWithBackend: async (): Promise<void> => {
    try {
      // 1. Check if authenticated before syncing
      const authSession = typeof localStorage !== "undefined" ? localStorage.getItem("aura_auth_session") : null;
      if (!authSession) {
        return; // Don't sync if not authenticated, suppresses the 401 warning
      }
      
      const user = JSON.parse(authSession);

      const isWorker = user.role === 'support_worker' || user.role === 'admin' || user.role === 'counselor';
      
      let backendParticipants;
      if (isWorker) {
        backendParticipants = await apiService.participants.getAll();
      } else {
        const participantData = await apiService.participants.getById(user.id);
        backendParticipants = participantData ? [participantData] : [];
      }
      if (Array.isArray(backendParticipants) && backendParticipants.length > 0) {
        const mapped: Participant[] = backendParticipants.map((bp: any) => ({
          id: bp.id,
          name: bp.name,
          consentGiven: (bp.consentGiven ?? bp.consent_given) ?? true,
          status: bp.status || "Stable",
          preferredSupport: bp.preferredSupport || bp.preferred_support || "Human counselor",
          language: bp.language || "English",
          ageGroup: bp.ageGroup || bp.age_group || "25-34",
          assignedWorker: bp.assignedWorker || bp.assigned_worker,
          lastReviewDate: bp.lastReviewDate || bp.last_review_date,
          createdAt: bp.createdAt || bp.created_at || new Date().toISOString(),
          notes: [],
          checkIns: []
        }));

        // Check-ins and support notes live in their own tables now — fetch and
        // merge by participant. RLS already scopes this to "my own" for a
        // participant or "everyone" for staff, so no extra filtering is needed.
        try {
          const allCheckIns = await apiService.checkIns.getAll();
          const byParticipant = new Map<string, CheckIn[]>();
          (allCheckIns || []).forEach((c: any) => {
            const pid = c.participantId || c.participant_id;
            if (!byParticipant.has(pid)) byParticipant.set(pid, []);
            byParticipant.get(pid)!.push(c);
          });
          mapped.forEach((p) => {
            p.checkIns = (byParticipant.get(p.id) || []).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        } catch (ciErr: any) {
          console.warn("[ParticipantStore] Check-in sync notice:", ciErr?.message || ciErr);
        }

        try {
          await Promise.all(
            mapped.map(async (p) => {
              p.notes = await apiService.participants.getNotes(p.id);
            })
          );
        } catch (noteErr: any) {
          console.warn("[ParticipantStore] Notes sync notice:", noteErr?.message || noteErr);
        }

        saveStoredParticipants(mapped);
      }

      // Pull intervention follow-ups from the backend so the Outcomes page
      // shows real records (real participant ids) rather than a stale local
      // sample. The backend is authoritative: a purely-local row is kept only
      // if it was created on this device and hasn't synced yet AND its
      // participant still exists — this drops orphaned rows left behind after a
      // dataset re-seed.
      try {
        const backendFollowUps = await apiService.followUps.getAll();
        if (Array.isArray(backendFollowUps)) {
          const localRows = getStoredFollowUps();
          const localById = new Map(localRows.map((f) => [f.id, f]));
          const validPids = new Set(getStoredParticipants().map((p) => p.id));

          const fromBackend: InterventionFollowUp[] = backendFollowUps.map((f: any) => {
            const local = localById.get(f.id);
            // A row a counsellor closed locally but hasn't pushed yet wins.
            if (local && local.outcome && local.outcome !== "pending") return local;
            return {
              id: f.id,
              participantId: f.participantId || f.participant_id,
              alertId: f.alertId || f.alert_id,
              originalScore: f.originalScore ?? f.original_score ?? 50,
              interventionType: f.interventionType || f.intervention_type || "Follow-up",
              interventionDate: f.interventionDate || f.intervention_date || new Date().toISOString(),
              workerName: f.workerName || f.worker_name || "Counselor",
              followUpScore: f.followUpScore ?? f.follow_up_score,
              followUpDate: f.followUpDate || f.follow_up_date,
              scoreDelta: f.scoreDelta ?? f.score_delta,
              outcome: f.outcome || "pending",
              outcomeLabel: f.outcomeLabel || f.outcome_label || "Scheduled Follow-up in Progress",
              notes: f.notes || "",
            };
          });

          const backendIds = new Set(fromBackend.map((m) => m.id));
          const localOnly = localRows.filter(
            (f) =>
              !backendIds.has(f.id) &&
              /^fup-\d/.test(f.id) &&                       // locally generated, not seed/synced
              (!validPids.size || validPids.has(f.participantId)) // participant still exists
          );

          saveStoredFollowUps([...fromBackend, ...localOnly]);
        }
      } catch (fuErr: any) {
        console.warn("[ParticipantStore] Follow-up sync notice:", fuErr?.message || fuErr);
      }

      if (isWorker) {
        const backendAlerts = await apiService.alerts.getAll();
        if (Array.isArray(backendAlerts) && backendAlerts.length > 0) {
          const mappedAlerts: Alert[] = backendAlerts.map((a: any) => ({
            id: a.id,
            participantId: a.participantId || a.participant_id,
            participantName: a.participantName || a.participant_name,
            participantAssignedWorker: a.participantAssignedWorker,
            category: a.category,
            severity: a.severity,
            title: a.title,
            reason: a.reason,
            description: a.description,
            recommendedAction: a.recommended_action,
            status: a.status,
            score: a.score,
            changeDelta: a.change_delta,
            assignedTo: a.assigned_to,
            humanDecision: a.human_decision,
            decisionNotes: a.decision_notes,
            actionTaken: a.action_taken,
            reviewedBy: a.reviewed_by,
            reviewedAt: a.reviewed_at,
            contributingFactors: a.contributing_factors,
            trajectory: a.trajectory,
            requiresHumanReview: a.requires_human_review,
            timestamp: a.createdAt || a.created_at,
            createdAt: a.createdAt || a.created_at
          }));
          saveStoredAlerts(mappedAlerts);
        }
      }
    } catch (err: any) {
      console.warn("[ParticipantStore] syncWithBackend error or offline:", err.message || err);
      const msg = err.message || "";
      if (msg.includes("Authentication required") || msg.includes("invalid token") || msg.includes("401") || msg.includes("credentials")) {
        console.warn("[ParticipantStore] Token invalid or expired. Redirecting to login screen.");
        if (typeof window !== "undefined") {
          localStorage.removeItem("aura_auth_session");
          localStorage.removeItem("aura_auth_token");
          window.dispatchEvent(new Event("aura_auth_updated"));
        }
      }
    }
  },

  getAllParticipants: (): Participant[] => {
    return getStoredParticipants();
  },

  getParticipantById: (participantId: string): Participant | null => {
    const participants = getStoredParticipants();
    return participants.find((p) => p.id === participantId) || null;
  },

  getParticipantForUser: (user: User): Participant => {
    const participants = getStoredParticipants();
    const existing = participants.find((p) => p.id === user.id);

    if (existing) {
      // Re-assert this participant exists server-side too — harmless no-op
      // (upsert) if it already does. This is what lets a participant record
      // that failed to persist earlier (e.g. signing up while Supabase email
      // confirmation was still pending, so there was no real session yet)
      // get created once a real session exists, without ever touching local
      // check-in history the way registerNewParticipant would.
      apiService.participants.create({ ...existing, userId: user.id }).catch(() => {});
      return existing;
    }

    // Special check for demo participant email
    if (user.email === "demo.participant@aura.demo") {
      const demoP = participants.find((p) => p.id === "P-1042");
      if (demoP) return demoP;
    }

    // New user without a participant record - create a fresh record with NO fake historical data
    const newParticipant: Participant = {
      id: user.id,
      name: user.name,
      consentGiven: user.consentGiven ?? true,
      createdAt: user.createdAt || new Date().toISOString(),
      preferredSupport: user.supportPreference || "In-app support information",
      language: user.language || "English",
      ageGroup: user.ageRange || "25-34",
      status: "Stable",
      notes: [],
      checkIns: []
    };

    const updated = [newParticipant, ...participants];
    saveStoredParticipants(updated);
    apiService.participants.create({ ...newParticipant, userId: user.id }).catch((err: any) => {
      console.warn("[ParticipantStore] New participant persist notice:", err?.message || err);
    });
    return newParticipant;
  },

  registerNewParticipant: (user: User): Participant => {
    const participants = getStoredParticipants();
    const existingIdx = participants.findIndex((p) => p.id === user.id);

    const newParticipant: Participant = {
      id: user.id,
      name: user.name,
      consentGiven: user.consentGiven ?? true,
      createdAt: user.createdAt || new Date().toISOString(),
      preferredSupport: user.supportPreference || "In-app support information",
      language: user.language || "English",
      ageGroup: user.ageRange || "25-34",
      status: "Stable",
      notes: [],
      checkIns: []
    };

    let updated: Participant[];
    if (existingIdx >= 0) {
      updated = [...participants];
      updated[existingIdx] = newParticipant;
    } else {
      updated = [newParticipant, ...participants];
    }

    saveStoredParticipants(updated);
    apiService.participants.create({ ...newParticipant, userId: user.id }).catch((err: any) => {
      console.warn("[ParticipantStore] Registered participant persist notice:", err?.message || err);
    });
    return newParticipant;
  },

  /**
   * CENTRAL CHECK-IN EVALUATION & NOTIFICATION PIPELINE
   */
  saveCheckIn: (checkIn: CheckIn): { participant: Participant; alert?: Alert; decision: AlertDecision; analysis: CheckInAnalysis } => {
    const participants = getStoredParticipants();
    const participantIndex = participants.findIndex((p) => p.id === checkIn.participantId);

    const existingCheckIns = participantIndex >= 0 ? participants[participantIndex].checkIns : [];
    const previousCheckIn = existingCheckIns.length > 0 ? existingCheckIns[existingCheckIns.length - 1] : null;

    // Run dynamic analysis and recommendation calculation
    const analysis = calculateCheckInAnalysis(checkIn, previousCheckIn, existingCheckIns);

    const enrichedCheckIn: CheckIn = {
      ...checkIn,
      calculatedScore: analysis.distressScore,
      analysis: analysis
    };

    let targetParticipant: Participant;

    if (participantIndex >= 0) {
      targetParticipant = {
        ...participants[participantIndex],
        checkIns: [...participants[participantIndex].checkIns, enrichedCheckIn]
      };
    } else {
      targetParticipant = {
        id: checkIn.participantId,
        consentGiven: true,
        createdAt: new Date().toISOString(),
        preferredSupport: "In-app support information",
        language: "English",
        ageGroup: "25-34",
        status: "Stable",
        notes: [],
        checkIns: [enrichedCheckIn]
      };
    }

    // RUN CENTRAL ALERT ENGINE
    const currentAlerts = getStoredAlerts();
    const decision = evaluateCheckIn(enrichedCheckIn, targetParticipant.checkIns, currentAlerts, targetParticipant.name);

    // Update participant status based on alert decision
    if (decision.alert.category === "SAFETY_CONCERN") {
      targetParticipant.status = "Urgent safety signal";
    } else if (decision.alert.category === "PRIORITY" || decision.alert.category === "HIGH" || decision.alert.category === "PERSISTENT_INCREASE") {
      targetParticipant.status = "Human review pending";
    } else if (decision.alert.category === "SUPPORT_REQUEST" || decision.alert.category === "EARLY_WARNING" || decision.alert.category === "ELEVATED") {
      targetParticipant.status = "Needs follow-up";
    } else if (decision.alert.category === "IMPROVEMENT" || decision.alert.category === "RECOVERY") {
      targetParticipant.status = "Improving";
    } else {
      targetParticipant.status = "Stable";
    }

    // Save updated participant
    if (participantIndex >= 0) {
      participants[participantIndex] = targetParticipant;
      saveStoredParticipants(participants);
    } else {
      saveStoredParticipants([targetParticipant, ...participants]);
    }

    // Save or update alert
    let updatedAlerts = [...currentAlerts];
    if (decision.isNewAlert) {
      if (decision.alert.requiresHumanReview || decision.alert.category === "SUPPORT_REQUEST" || decision.alert.category === "SAFETY_CONCERN") {
        updatedAlerts = [decision.alert, ...updatedAlerts];
        saveStoredAlerts(updatedAlerts);
      }
    } else {
      const idx = updatedAlerts.findIndex(a => a.id === decision.alert.id);
      if (idx >= 0) {
        updatedAlerts[idx] = decision.alert;
        saveStoredAlerts(updatedAlerts);
      }
    }

    // 1. RECORD AUDIT: CHECK_IN_SUBMITTED
    auditService.recordAuditEvent({
      actorId: enrichedCheckIn.participantId,
      actorRole: "PARTICIPANT",
      actorName: `Participant ${enrichedCheckIn.participantId}`,
      action: "CHECK_IN_SUBMITTED",
      category: "CHECK_IN",
      participantId: enrichedCheckIn.participantId,
      description: `Participant ${enrichedCheckIn.participantId} submitted a voluntary wellbeing check-in (Stress: ${enrichedCheckIn.stress}/5, Sleep: ${enrichedCheckIn.sleep}/5)`,
      severity: "INFO"
    });

    // 2. RECORD AUDIT: SUPPORT_REQUEST_CREATED (if requested)
    if (enrichedCheckIn.supportRequested) {
      auditService.recordAuditEvent({
        actorId: enrichedCheckIn.participantId,
        actorRole: "PARTICIPANT",
        actorName: `Participant ${enrichedCheckIn.participantId}`,
        action: "SUPPORT_REQUEST_CREATED",
        category: "SUPPORT",
        participantId: enrichedCheckIn.participantId,
        description: `Participant ${enrichedCheckIn.participantId} requested voluntary human support connection`,
        severity: "INFO"
      });
    }

    // 3. RECORD AUDIT: SAFETY_CONCERN_REPORTED (if flagged)
    if (enrichedCheckIn.safety === "No" || enrichedCheckIn.safety === "Unsure" || decision.alert.category === "SAFETY_CONCERN") {
      auditService.recordAuditEvent({
        actorId: enrichedCheckIn.participantId,
        actorRole: "PARTICIPANT",
        actorName: `Participant ${enrichedCheckIn.participantId}`,
        action: "SAFETY_CONCERN_REPORTED",
        category: "SAFETY",
        participantId: enrichedCheckIn.participantId,
        description: `Safety concern reported by participant ${enrichedCheckIn.participantId}`,
        severity: "HIGH"
      });
    }

    // 4. RECORD AUDIT: ANALYSIS_GENERATED
    auditService.recordAuditEvent({
      actorId: "SYSTEM",
      actorRole: "SYSTEM",
      actorName: "AURA AI Signal Engine",
      action: "ANALYSIS_GENERATED",
      category: "ANALYSIS",
      participantId: enrichedCheckIn.participantId,
      description: `AI Signal computed: distress score ${analysis.distressScore}/100 (${decision.alert.trajectory}, change: ${decision.alert.changeDelta >= 0 ? "+" + decision.alert.changeDelta : decision.alert.changeDelta} pts)`,
      severity: analysis.distressScore >= 75 ? "HIGH" : analysis.distressScore >= 50 ? "WARNING" : "INFO"
    });

    // 5. RECORD AUDIT: HIGH_DISTRESS_ALERT_CREATED (if score >= 75 or category HIGH / SAFETY)
    if (analysis.distressScore >= 75 || decision.alert.category === "HIGH" || decision.alert.severity === "urgent") {
      auditService.recordAuditEvent({
        actorId: "SYSTEM",
        actorRole: "SYSTEM",
        actorName: "AURA AI Signal Engine",
        action: "HIGH_DISTRESS_ALERT_CREATED",
        category: "ALERT",
        participantId: enrichedCheckIn.participantId,
        description: `High distress alert created for participant ${enrichedCheckIn.participantId} (Score: ${analysis.distressScore}/100) — routed to Counselor review queue`,
        severity: "HIGH"
      });
    }

    // DISPATCH NOTIFICATIONS
    // 1. Participant Notification (Calm & non-alarming)
    if (decision.participantNotification) {
      notificationService.createNotification({
        userId: enrichedCheckIn.participantId,
        participantId: enrichedCheckIn.participantId,
        category: decision.participantNotification.category,
        severity: decision.participantNotification.severity,
        title: decision.participantNotification.title,
        message: decision.participantNotification.message,
        actionLabel: decision.alert.category === "SAFETY_CONCERN" ? "View Emergency Help" : "View Wellbeing",
        actionView: decision.alert.category === "SAFETY_CONCERN" ? "emergency" : "participant_home",
        metadata: {
          score: analysis.distressScore,
          change: decision.alert.changeDelta,
          factors: decision.alert.contributingFactors,
          trajectory: decision.alert.trajectory
        }
      });
    }

    // 2. Counselor Notification. There's no real "which worker is on
    // duty" concept in this prototype, so this used to loop over hardcoded
    // placeholder ids ("worker_1", "worker_demo") that aren't real Supabase
    // auth users — notificationsTable.create silently dropped every one of
    // them (user_id is a real FK to auth.users), which is why alerts could
    // show a count while the notification panel stayed empty. Fixed: send a
    // single notification, targeted at the participant's real assigned
    // worker when that's an actual Supabase user id, otherwise broadcast
    // (user_id left null) — RLS already lets any signed-in counselor
    // read every notification row via is_staff(), so a broadcast row is
    // visible to whichever worker is logged in, matching how the Alerts
    // queue itself is already visible to all workers.
    if (decision.workerNotification) {
      const isRealWorkerId = (id?: string) =>
        !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      notificationService.createNotification({
        userId: isRealWorkerId(targetParticipant.assignedWorker) ? targetParticipant.assignedWorker! : "broadcast",
        participantId: enrichedCheckIn.participantId,
        category: decision.workerNotification.category,
        severity: decision.workerNotification.severity,
        title: decision.workerNotification.title,
        message: decision.workerNotification.message,
        actionLabel: "Review Participant",
        actionView: "detail",
        actionParticipantId: enrichedCheckIn.participantId,
        metadata: {
          score: analysis.distressScore,
          change: decision.alert.changeDelta,
          factors: decision.alert.contributingFactors,
          trajectory: decision.alert.trajectory
        }
      });
    }

    // Phase 5: Persist check-in securely via Offline-First Sync Engine
    // (includes the raw reflection + comprehensive AI analysis so the
    // trauma-informed screening / voice-tone results are not lost on sync —
    // supabaseService.checkIns.create fans the reflection out to its own table.)
    syncEngine.queueCheckIn(checkIn.participantId, {
      id: checkIn.id,
      participantId: checkIn.participantId,
      wellbeing: checkIn.wellbeing,
      stress: checkIn.stress,
      sleep: checkIn.sleep,
      safety: checkIn.safety,
      connection: checkIn.connection,
      supportRequested: checkIn.supportRequested || false,
      immediateSafetyConcern: checkIn.immediateSafetyConcern || false,
      calculatedScore: enrichedCheckIn.calculatedScore,
      notes: checkIn.notes || checkIn.optionalNote,
      optionalNote: checkIn.optionalNote,
      shareNoteWithWorker: checkIn.shareNoteWithWorker ?? true,
      voiceInputUsed: checkIn.voiceInputUsed ?? false,
      timestamp: checkIn.timestamp,
      aiComprehensiveAnalysis: checkIn.aiComprehensiveAnalysis,
      reflection: checkIn.reflection
    }).catch((err) => {
      console.warn("[ParticipantStore] Offline Sync Enqueue Failed:", err.message);
    });

    // Persist Risk Prediction to FastAPI backend
    apiService.risk.createPrediction({
      participantId: checkIn.participantId,
      // `||` treated a legitimate score of 0 — a genuinely calm check-in — as
      // missing and replaced it with 50. Use the analysis score, which is the
      // number actually shown to the participant and their counsellor.
      distressScore: analysis.distressScore,
      riskLevel: analysis.level || "MODERATE",
      trajectory: analysis.trend || "STABLE",
      confidence: 0.88,
      contributingFactors: analysis.contributingFactors || [],
      factorBreakdown: analysis.factorPercentages || {},
      explanation: analysis.explanation,
      requiresHumanReview: Boolean(analysis.requiresHumanReview || decision.alert.requiresHumanReview),
      isExplicitSafetyConcern: Boolean(analysis.isExplicitSafetyConcern || checkIn.immediateSafetyConcern || checkIn.safety === "No")
    }).catch((err) => {
      console.warn("[ParticipantStore] Risk prediction persist notice:", err.message);
    });

    // Persist alert if newly created
    if (decision.isNewAlert && (decision.alert.requiresHumanReview || decision.alert.category === "SUPPORT_REQUEST" || decision.alert.category === "SAFETY_CONCERN")) {
      apiService.alerts.create({
        participantId: decision.alert.participantId,
        category: decision.alert.category,
        severity: decision.alert.severity,
        title: decision.alert.title,
        reason: decision.alert.reason,
        description: decision.alert.description,
        recommendedAction: decision.alert.recommendedAction,
        score: decision.alert.score,
        changeDelta: decision.alert.changeDelta,
        assignedTo: decision.alert.assignedTo,
        status: decision.alert.status,
        requiresHumanReview: decision.alert.requiresHumanReview,
        contributingFactors: decision.alert.contributingFactors,
        trajectory: decision.alert.trajectory
      }).catch((err) => {
        console.warn("[ParticipantStore] Alert persist notice:", err.message);
      });
    }

    // Ensure the participant row exists (upsert is a no-op for existing rows)
    // before other tables that foreign-key against it, then persist the
    // status change that resulted from this check-in.
    apiService.participants.create({
      id: targetParticipant.id,
      userId: targetParticipant.id,
      consentGiven: targetParticipant.consentGiven,
      status: targetParticipant.status,
      preferredSupport: targetParticipant.preferredSupport,
      language: targetParticipant.language,
      ageGroup: targetParticipant.ageGroup,
      assignedWorker: targetParticipant.assignedWorker,
      createdAt: targetParticipant.createdAt,
    }).catch((err: any) => {
      console.warn("[ParticipantStore] Supabase participant upsert warning:", err?.message || err);
    });

    return { participant: targetParticipant, alert: decision.alert, decision, analysis };
  },

  updateParticipantStatus: (participantId: string, status: CaseStatus) => {
    const participants = getStoredParticipants();
    const idx = participants.findIndex((p) => p.id === participantId);
    if (idx >= 0) {
      participants[idx] = {
        ...participants[idx],
        status,
        lastReviewDate: new Date().toISOString()
      };
      saveStoredParticipants(participants);
    }
    // Persist to Supabase
    apiService.participants.update(participantId, { status }).catch((err) => {
      console.warn("[ParticipantStore] Participant status update notice:", err.message);
    });
  },

  addParticipantNote: (participantId: string, note: SupportNote) => {
    const participants = getStoredParticipants();
    const idx = participants.findIndex((p) => p.id === participantId);
    if (idx >= 0) {
      participants[idx] = {
        ...participants[idx],
        notes: [note, ...(participants[idx].notes || [])]
      };
      saveStoredParticipants(participants);

      auditService.recordAuditEvent({
        actorId: "SW-001",
        actorRole: "SUPPORT_WORKER",
        actorName: note.author || "Counselor",
        participantId,
        action: "SUPPORT_NOTE_ADDED",
        category: "SUPPORT",
        description: `Support case note recorded for participant ${participantId}: ${note.text.substring(0, 100)}`,
        severity: "INFO"
      });
    }
    // Persist note to Supabase
    apiService.participants.addNote(participantId, {
      author: note.author,
      text: note.text,
      actionTaken: note.actionTaken
    }).catch((err) => {
      console.warn("[ParticipantStore] Participant note persist notice:", err.message);
    });
  },

  deleteParticipantNote: (participantId: string, noteId: string) => {
    const participants = getStoredParticipants();
    const idx = participants.findIndex((p) => p.id === participantId);
    if (idx >= 0) {
      const originalLength = (participants[idx].notes || []).length;
      participants[idx] = {
        ...participants[idx],
        notes: (participants[idx].notes || []).filter(n => n.id !== noteId)
      };
      if ((participants[idx].notes || []).length < originalLength) {
        saveStoredParticipants(participants);
        auditService.recordAuditEvent({
          actorId: "SW-001",
          actorRole: "SUPPORT_WORKER",
          actorName: "Counselor",
          participantId,
          action: "SUPPORT_NOTE_DELETED",
          category: "SUPPORT",
          description: `Support case note deleted for participant ${participantId}`,
          severity: "WARNING"
        });
      }
    }
  },

  assignWorker: (participantId: string, workerName: string) => {
    const participants = getStoredParticipants();
    const idx = participants.findIndex((p) => p.id === participantId);
    if (idx >= 0) {
      participants[idx] = {
        ...participants[idx],
        assignedWorker: workerName
      };
      saveStoredParticipants(participants);

      auditService.recordAuditEvent({
        actorId: "SW-001",
        actorRole: "SUPPORT_WORKER",
        actorName: workerName,
        participantId,
        action: "WORKER_ASSIGNED",
        category: "SUPPORT",
        description: `Counselor ${workerName} assigned to participant ${participantId}`,
        severity: "INFO"
      });
    }
    // Persist to Supabase
    apiService.participants.update(participantId, { assignedWorker: workerName }).catch((err) => {
      console.warn("[ParticipantStore] Assign worker persist notice:", err.message);
    });
  },

  getAlerts: (): Alert[] => {
    return getStoredAlerts();
  },

  /**
   * Complete Human Review Workflow Action
   */
  updateAlertStatus: (
    alertId: string,
    status: AlertStatus,
    decisionNotes: string,
    actionTaken: string,
    // Real callers (AlertsPage) always pass the actual logged-in worker's
    // name — this default is only a defensive fallback for a caller that
    // omits it, so it stays a neutral label rather than a specific person.
    reviewedBy = "Counselor"
  ) => {
    const alerts = getStoredAlerts();
    const idx = alerts.findIndex((a) => a.id === alertId);
    if (idx >= 0) {
      const alert = alerts[idx];
      const now = new Date().toISOString();

      alerts[idx] = {
        ...alert,
        status,
        decisionNotes,
        actionTaken,
        reviewedAt: now,
        reviewedBy,
        updatedAt: now
      };
      saveStoredAlerts(alerts);

      // Record Specific Audit Events based on action
      if (status === "ACKNOWLEDGED" || status === "IN_REVIEW") {
        auditService.recordAuditEvent({
          actorId: "SW-001",
          actorRole: "SUPPORT_WORKER",
          actorName: reviewedBy,
          participantId: alert.participantId,
          action: "ALERT_ACKNOWLEDGED",
          category: "ALERT",
          description: `Counselor acknowledged alert for ${alert.participantId}`,
          severity: "INFO"
        });
      } else if (status === "RESOLVED") {
        auditService.recordAuditEvent({
          actorId: "SW-001",
          actorRole: "SUPPORT_WORKER",
          actorName: reviewedBy,
          participantId: alert.participantId,
          action: "ALERT_RESOLVED",
          category: "ALERT",
          description: `Alert resolved for ${alert.participantId}`,
          severity: "INFO"
        });
      } else if (status === "FOLLOW_UP_ASSIGNED") {
        auditService.recordAuditEvent({
          actorId: "SW-001",
          actorRole: "SUPPORT_WORKER",
          actorName: reviewedBy,
          participantId: alert.participantId,
          action: "FOLLOW_UP_ASSIGNED",
          category: "FOLLOW_UP",
          description: `Follow-up assigned for ${alert.participantId}`,
          severity: "INFO"
        });
      } else if (status === "SAFETY_ESCALATED") {
        auditService.recordAuditEvent({
          actorId: "SW-001",
          actorRole: "SUPPORT_WORKER",
          actorName: reviewedBy,
          participantId: alert.participantId,
          action: "SAFETY_WORKFLOW_TRIGGERED",
          category: "SAFETY",
          description: `Emergency safety protocol triggered for participant ${alert.participantId}`,
          severity: "HIGH"
        });
      }

      // Record General Participant Review Audit Event
      auditService.recordAuditEvent({
        actorId: "SW-001",
        actorRole: "SUPPORT_WORKER",
        actorName: reviewedBy,
        participantId: alert.participantId,
        action: "PARTICIPANT_REVIEWED",
        category: "SUPPORT",
        description: `Counselor reviewed participant ${alert.participantId}`,
        details: `Action: ${actionTaken}. Notes: ${decisionNotes}`,
        severity: "INFO"
      });

      // If follow-up was assigned, update participant status and notify
      if (status === "FOLLOW_UP_ASSIGNED" || actionTaken.toLowerCase().includes("follow-up")) {
        participantStore.updateParticipantStatus(alert.participantId, "Needs follow-up");
        
        // Add follow-up record
        participantStore.addFollowUp({
          participantId: alert.participantId,
          alertId: alert.id,
          originalScore: alert.score,
          interventionType: actionTaken || "Scheduled Follow-up",
          interventionDate: now,
          workerName: reviewedBy,
          outcome: "pending",
          outcomeLabel: "Scheduled Follow-up in Progress",
          notes: decisionNotes || "Follow-up initiated during human review."
        });

        // Notify participant gently
        notificationService.createNotification({
          userId: alert.participantId,
          participantId: alert.participantId,
          category: "FOLLOW_UP_DUE",
          severity: "INFO",
          title: "Follow-up Scheduled",
          message: "Your counselor has scheduled a voluntary follow-up check-in.",
          actionLabel: "View Details",
          actionView: "participant_home"
        });
      } else if (status === "RESOLVED") {
        participantStore.updateParticipantStatus(alert.participantId, "Stable");
      }

      // Persist alert status to Supabase
      apiService.alerts.update(alertId, {
        status,
        decisionNotes,
        actionTaken,
        reviewedBy
      }).catch((err) => {
        console.warn("[ParticipantStore] Alert status backend update notice:", err.message);
      });

      // Mark participant reviewed
      apiService.participants.markReviewed(alert.participantId).catch((err) => {
        console.warn("[ParticipantStore] Mark reviewed backend notice:", err.message);
      });
    }
  },

  // Backward compatibility method
  updateAlertDecision: (
    alertId: string,
    decision: "follow_up_scheduled" | "continue_monitoring" | "resolved" | "emergency_dispatched",
    notes: string
  ) => {
    const statusMap: Record<string, AlertStatus> = {
      follow_up_scheduled: "FOLLOW_UP_ASSIGNED",
      continue_monitoring: "MONITORING",
      resolved: "RESOLVED",
      emergency_dispatched: "SAFETY_ESCALATED"
    };

    const actionMap: Record<string, string> = {
      follow_up_scheduled: "Scheduled 1-on-1 counselor follow-up",
      continue_monitoring: "Marked for ongoing voluntary monitoring",
      resolved: "Case resolved after support interaction",
      emergency_dispatched: "Escalated to humanitarian safety protocol"
    };

    participantStore.updateAlertStatus(
      alertId,
      statusMap[decision] || "ACKNOWLEDGED",
      notes,
      actionMap[decision] || decision,
      "Dr. Sarah Jenkins, MSW"
    );
  },

  // Audit Logs (delegated to centralized auditService)
  getAuditLogs: (): AuditLogEntry[] => {
    return auditService.getAuditEvents();
  },

  addAuditLog: (entry: any): AuditLogEntry => {
    return auditService.recordAuditEvent({
      ...entry,
      action: entry.action || "ACTION_RECORDED",
      category: entry.category || "SUPPORT",
      description: entry.details || entry.description || "Audit entry"
    });
  },

  // Follow-ups & Outcomes
  getFollowUps: (): InterventionFollowUp[] => {
    return getStoredFollowUps();
  },

  addFollowUp: (followUp: Omit<InterventionFollowUp, "id">): InterventionFollowUp => {
    const followUps = getStoredFollowUps();
    const newFollowUp: InterventionFollowUp = {
      id: `fup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...followUp
    };
    const updated = [newFollowUp, ...followUps];
    saveStoredFollowUps(updated);

    // Persist to Supabase
    apiService.followUps.create({
      participantId: followUp.participantId,
      alertId: followUp.alertId,
      originalScore: followUp.originalScore,
      interventionType: followUp.interventionType,
      interventionDate: followUp.interventionDate,
      workerName: followUp.workerName,
      outcome: followUp.outcome,
      outcomeLabel: followUp.outcomeLabel,
      notes: followUp.notes
    }).catch((err) => {
      console.warn("[ParticipantStore] FollowUp backend persist notice:", err.message);
    });

    return newFollowUp;
  },

  updateFollowUp: (id: string, updates: Partial<InterventionFollowUp>) => {
    const followUps = getStoredFollowUps();
    const idx = followUps.findIndex(f => f.id === id);
    if (idx >= 0) {
      followUps[idx] = { ...followUps[idx], ...updates };
      saveStoredFollowUps(followUps);

      apiService.followUps.update(followUps[idx].id, updates).catch((err: any) => {
        console.warn("[ParticipantStore] FollowUp update persist notice:", err?.message || err);
      });

      auditService.recordAuditEvent({
        actorId: "SW-001",
        actorRole: "SUPPORT_WORKER",
        actorName: "Dr. Sarah Jenkins, MSW",
        participantId: followUps[idx].participantId,
        action: "FOLLOW_UP_UPDATED",
        category: "FOLLOW_UP",
        description: `Follow-up outcome updated for participant ${followUps[idx].participantId} (${updates.outcomeLabel || updates.outcome || "updated"})`,
        severity: "INFO"
      });
    }
  },

  // Notification Preferences
  getParticipantNotificationPreferences: (participantId: string): ParticipantNotificationPreferences => {
    try {
      const raw = localStorage.getItem(`${NOTIF_PREFS_KEY}_${participantId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      checkInReminders: true,
      supportUpdates: true,
      followUpReminders: true,
      wellbeingUpdates: true,
      safetyGuidanceEnforced: true
    };
  },

  saveParticipantNotificationPreferences: (participantId: string, prefs: ParticipantNotificationPreferences) => {
    try {
      localStorage.setItem(`${NOTIF_PREFS_KEY}_${participantId}`, JSON.stringify({ ...prefs, safetyGuidanceEnforced: true }));
      notifyChange();
    } catch (e) {
      console.error("Failed to save participant notification preferences", e);
    }
  },

  getWorkerNotificationPreferences: (workerId: string): WorkerNotificationPreferences => {
    try {
      const raw = localStorage.getItem(`${NOTIF_PREFS_KEY}_worker_${workerId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      priorityAlerts: true,
      humanReviewAlerts: true,
      supportRequests: true,
      followUpReminders: true,
      dailySummary: true
    };
  },

  saveWorkerNotificationPreferences: (workerId: string, prefs: WorkerNotificationPreferences) => {
    try {
      localStorage.setItem(`${NOTIF_PREFS_KEY}_worker_${workerId}`, JSON.stringify(prefs));
      notifyChange();
    } catch (e) {
      console.error("Failed to save worker notification preferences", e);
    }
  },

  // Reset a specific participant's data (clears checkins for new participant, or resets demo participant)
  resetParticipantData: (participantId: string) => {
    const participants = getStoredParticipants();
    const idx = participants.findIndex((p) => p.id === participantId);
    if (idx >= 0) {
      participants[idx] = {
        ...participants[idx],
        checkIns: [],
        status: "Stable",
        notes: []
      };
      saveStoredParticipants(participants);
      const alerts = getStoredAlerts();
      const filteredAlerts = alerts.filter(
        (a) => a.participantId !== participantId
      );
      saveStoredAlerts(filteredAlerts);
      notificationService.clearNotifications(participantId);
    }
  },

  getLatestAnalysisForParticipant: (participantId: string): CheckInAnalysis | null => {
    const p = participantStore.getParticipantById(participantId);
    if (!p || p.checkIns.length === 0) return null;
    const latest = p.checkIns[p.checkIns.length - 1];
    if (latest.analysis) return latest.analysis;
    const prev = p.checkIns.length > 1 ? p.checkIns[p.checkIns.length - 2] : null;
    return calculateCheckInAnalysis(latest, prev, p.checkIns);
  },

  /**
   * The latest check-in and its analysis for a signed-in person, resolved the
   * same way every participant screen resolves their record.
   *
   * getLatestAnalysisForParticipant looks a participant up by id alone, which
   * only finds a record whose id happens to equal the auth user id. The demo
   * participant is stored as P-1042 under a different user id, and any record
   * rehydrated from Supabase can be keyed differently too, so that lookup
   * returned null for them and the results screen — including the score
   * breakdown — silently refused to open for anyone but the accounts where
   * the two ids coincided.
   *
   * Returning the pair together also keeps them consistent: the breakdown is
   * always derived from the very check-in handed back beside it, never from
   * whichever one happened to be left in state by an earlier session.
   */
  getLatestResultForUser: (
    user: User
  ): { checkIn: CheckIn; analysis: CheckInAnalysis } | null => {
    const p = participantStore.getParticipantForUser(user);
    const checkIns = p?.checkIns || [];
    if (checkIns.length === 0) return null;

    const latest = checkIns[checkIns.length - 1];
    const prev = checkIns.length > 1 ? checkIns[checkIns.length - 2] : null;
    const analysis = latest.analysis || calculateCheckInAnalysis(latest, prev, checkIns);
    if (!analysis) return null;

    return { checkIn: latest, analysis };
  },

  // User management for persistent cross-login lookup
  getRegisteredUsers: (): User[] => {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  findUserByEmail: (email: string): User | null => {
    const users = participantStore.getRegisteredUsers();
    return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  },

  saveUser: (user: User) => {
    try {
      const users = participantStore.getRegisteredUsers();
      const idx = users.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
      if (idx >= 0) {
        users[idx] = user;
      } else {
        users.push(user);
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error("Failed to save user", e);
    }
  }
};

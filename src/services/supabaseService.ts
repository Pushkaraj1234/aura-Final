import { supabase } from "./supabaseClient";
import { calculateRawScore, SCORE_VERSION } from "./riskEngine";
import {
  CheckIn,
  Participant,
  Alert,
  SupportNote,
  InterventionFollowUp,
  AppNotification,
  AuditEvent,
  ConsentPreferences,
  Message,
} from "../types";
import {
  scoreInstrument,
  type Instrument,
  type InstrumentAdministration,
  type ItemResponses,
} from "./instruments";

/**
 * Typed data-access layer over the real Supabase Postgres schema
 * (participants, check_ins, reflections, alerts, notifications,
 * interventions, follow_ups, consents, support_notes, support_resources,
 * audit_logs, risk_predictions, risk_history). Row Level Security enforces
 * that a participant only ever sees their own rows, while a support_worker /
 * admin (checked via the `profiles` table) can see everything.
 *
 * This replaces the earlier prototype that stored everything as opaque JSON
 * blobs in a single generic "items" table.
 */

async function getActiveUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;
  return data.session.user.id;
}

function warn(op: string, err: any) {
  if (err) console.warn(`[Supabase] ${op}:`, err.message || err);
}

// ---------------------------------------------------------------------------
// PARTICIPANTS
// ---------------------------------------------------------------------------
function participantFromRow(row: any, name?: string): Participant {
  return {
    id: row.id,
    name,
    consentGiven: row.consent_given,
    createdAt: row.created_at,
    preferredSupport: row.preferred_support,
    language: row.language,
    ageGroup: row.age_group,
    checkIns: [],
    status: row.status,
    notes: [],
    assignedWorker: row.assigned_worker,
    lastReviewDate: row.last_review_date,
    region: row.region,
    state: row.state || undefined,
    district: row.district || undefined,
  };
}

// profiles.id is a uuid column. Legacy/demo participant rows created before
// the Supabase migration carry plain ids like "P-1003" (no linked auth user),
// and querying `profiles.id in (...)` — or even `.eq(...)` — with one of
// those throws a Postgres "invalid input syntax for type uuid" error for the
// WHOLE request, not just that one row. Left unguarded, one legacy row in
// the batch silently wiped out every real participant's name (the request
// errors, gets caught, and the name map ends up empty for everyone). Only
// ever query profiles for ids that are actually uuid-shaped.
const isUuid = (id?: string | null) =>
  !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const participantsTable = {
  async getAll(): Promise<Participant[]> {
    const { data, error } = await supabase.from("participants").select("*").order("created_at", { ascending: false });
    if (error) {
      warn("participants.getAll", error);
      return [];
    }
    const rows = data || [];

    // A participant's real name (set at signup, stored in profiles.name —
    // never on the participants table itself) is what counselors/admins
    // should see in the UI instead of the raw participant id. The id itself
    // is untouched everywhere else (foreign keys, audit trail, anonymized
    // oversight views) — this is purely an additional display label. For a
    // real signed-up participant, participants.id === profiles.id (both the
    // auth user's uuid), matching the same join adminRouter.ts already uses
    // for GET /admin/users. Legacy/demo rows with no linked auth user simply
    // get no match here and fall back to showing their id, as before.
    const ids = rows.map((r: any) => r.id).filter(isUuid);
    let nameById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", ids);
      if (profileErr) warn("participants.getAll (profile names)", profileErr);
      nameById = new Map((profiles || []).map((p: any) => [p.id, p.name]));
    }

    return rows.map((row: any) => participantFromRow(row, nameById.get(row.id) || undefined));
  },

  async getById(id: string): Promise<Participant | null> {
    const { data, error } = await supabase.from("participants").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      if (error) warn("participants.getById", error);
      return null;
    }
    let name: string | undefined;
    if (isUuid(id)) {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", id)
        .maybeSingle();
      if (profileErr) warn("participants.getById (profile name)", profileErr);
      name = profile?.name || undefined;
    }
    return participantFromRow(data, name);
  },

  async upsert(participant: Partial<Participant> & { id: string; userId?: string }): Promise<Participant | null> {
    const payload: any = {
      id: participant.id,
      consent_given: participant.consentGiven ?? true,
      status: participant.status || "Stable",
      preferred_support: participant.preferredSupport,
      language: participant.language,
      age_group: participant.ageGroup,
      last_review_date: participant.lastReviewDate,
      region: participant.region,
      updated_at: new Date().toISOString(),
    };
    // Assignment is deliberately NOT part of the default payload.
    //
    // This upsert is called on almost every participant render to re-assert
    // that the record exists. It sends whatever the browser has cached, so
    // including assigned_worker here meant a stale cache silently wrote its
    // old counsellor back over the server's current value — an admin could
    // unassign someone and the participant's next page load would undo it,
    // with no assignment_history row to show what happened. Assignment is
    // owned by the admin flow and by select_counsellor(); a caller that wants
    // to change it must say so explicitly.
    if ("assignedWorker" in participant) {
      payload.assigned_worker = participant.assignedWorker;
    }
    if (participant.userId) payload.user_id = participant.userId;
    if (participant.createdAt) payload.created_at = participant.createdAt;
    // Sent only when known, like assignment above: a cached record that has
    // not loaded the person's area yet must never blank it on the server.
    if (participant.state) payload.state = participant.state;
    if (participant.district) payload.district = participant.district;

    const { data, error } = await supabase.from("participants").upsert(payload).select().maybeSingle();
    if (error) {
      warn("participants.upsert", error);
      return null;
    }
    return data ? participantFromRow(data) : null;
  },

  async update(id: string, updates: Partial<Participant>): Promise<void> {
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.assignedWorker !== undefined) payload.assigned_worker = updates.assignedWorker;
    if (updates.lastReviewDate !== undefined) payload.last_review_date = updates.lastReviewDate;
    if (updates.consentGiven !== undefined) payload.consent_given = updates.consentGiven;
    if (updates.preferredSupport !== undefined) payload.preferred_support = updates.preferredSupport;
    const { error } = await supabase.from("participants").update(payload).eq("id", id);
    warn("participants.update", error);
  },

  async markReviewed(id: string): Promise<void> {
    const { error } = await supabase
      .from("participants")
      .update({ status: "Stable", last_review_date: new Date().toISOString() })
      .eq("id", id);
    warn("participants.markReviewed", error);
  },
};

// ---------------------------------------------------------------------------
// CHECK-INS
// ---------------------------------------------------------------------------
function checkInFromRow(row: any): CheckIn {
  return {
    id: row.id,
    participantId: row.participant_id,
    timestamp: row.occurred_at,
    wellbeing: row.wellbeing,
    stress: row.stress,
    sleep: row.sleep,
    safety: row.safety,
    connection: row.connection,
    supportRequested: row.support_requested,
    immediateSafetyConcern: row.immediate_safety_concern,
    calculatedScore: row.calculated_score,
    aiComprehensiveAnalysis: row.ai_analysis,
    notes: row.notes,
    optionalNote: row.optional_note,
    shareNoteWithWorker: row.share_note_with_worker,
    voiceInputUsed: row.voice_input_used,
  };
}

export const checkInsTable = {
  async getAll(participantId?: string): Promise<CheckIn[]> {
    let query = supabase.from("check_ins").select("*").order("occurred_at", { ascending: true });
    if (participantId) query = query.eq("participant_id", participantId);
    const { data, error } = await query;
    if (error) {
      warn("checkIns.getAll", error);
      return [];
    }
    return (data || []).map(checkInFromRow);
  },

  async create(checkIn: Partial<CheckIn> & { participantId: string }): Promise<CheckIn | null> {
    const payload = {
      id: checkIn.id || `chk-${Date.now()}`,
      participant_id: checkIn.participantId,
      wellbeing: checkIn.wellbeing ?? 3,
      stress: checkIn.stress ?? 3,
      sleep: checkIn.sleep ?? 3,
      safety: checkIn.safety ?? "Mostly",
      connection: checkIn.connection ?? 3,
      support_requested: checkIn.supportRequested ?? false,
      immediate_safety_concern: checkIn.immediateSafetyConcern ?? false,
      // Recomputed rather than defaulted. A missing score used to be stored as
      // 50 — a number nobody's answers produced, sitting in the middle of the
      // scale and reading as "moderate distress" for someone who might be
      // calm or in crisis.
      calculated_score: calculateRawScore(checkIn as CheckIn),
      // Which model produced that number. Rows written before step 7 existed
      // inferred stress from wellbeing and sleep, and the column defaults to 1
      // for them, so a trend can show where the measurement changed.
      score_version: checkIn.scoreVersion ?? SCORE_VERSION,
      notes: checkIn.notes || checkIn.optionalNote || "",
      optional_note: checkIn.optionalNote || "",
      share_note_with_worker: checkIn.shareNoteWithWorker ?? true,
      voice_input_used: checkIn.voiceInputUsed ?? false,
      ai_analysis: checkIn.aiComprehensiveAnalysis ?? null,
      occurred_at: checkIn.timestamp || new Date().toISOString(),
    };
    const { data, error } = await supabase.from("check_ins").upsert(payload).select().maybeSingle();
    if (error) {
      warn("checkIns.create", error);
      return null;
    }

    // Fan the embedded voluntary reflection (text/voice transcript + Gemini
    // trauma-informed screening + voice-tone/acoustic delivery analysis, when
    // present) out into its own table so it isn't lost once the check-in is saved.
    const reflection = checkIn.reflection;
    if (reflection && typeof reflection.transcript === "string" && reflection.transcript.trim().length > 0) {
      const voiceTone = reflection.voiceToneAnalysis;
      const textAnalysis = reflection.aiAnalysis;
      const llmSource = voiceTone || textAnalysis;
      await reflectionsTable.create({
        id: reflection.id,
        checkInId: payload.id,
        participantId: checkIn.participantId,
        type: reflection.type || "text",
        transcript: reflection.transcript,
        audioRecorded: !!reflection.audioRecorded,
        shareWithWorker: reflection.shareWithWorker ?? true,
        sentiment: reflection.analysis?.sentiment,
        languageSignal: reflection.analysis?.languageSignal,
        contributingPatterns: reflection.analysis?.contributingPatterns,
        keywords: reflection.analysis?.keywords,
        factors: reflection.analysis?.factors,
        explanation: reflection.analysis?.explanation,
        hasUrgentSafetyMention: reflection.analysis?.hasUrgentSafetyMention,
        acoustic: voiceTone?.acousticFeatures
          ? {
              pitchVariabilityScore: voiceTone.acousticFeatures.pitchVariabilityScore,
              speakingRateWpm: voiceTone.acousticFeatures.speakingRateWpm,
              pauseRatio: voiceTone.acousticFeatures.pauseRatio,
              energyScore: voiceTone.acousticFeatures.energyScore,
            }
          : undefined,
        llm: llmSource
          ? {
              emotionalTone: voiceTone?.emotionalTone || textAnalysis?.emotionalState,
              toneConfidence: voiceTone?.toneConfidence,
              traumaIndicators: llmSource.traumaIndicators,
              distressSignals: llmSource.distressSignals,
              riskBand: llmSource.riskBand,
              crisisFlag: llmSource.crisisFlag,
              rationale: llmSource.rationale,
              confidence: llmSource.confidence,
              suggestedHumanAction: llmSource.suggestedHumanAction,
            }
          : undefined,
      });
    }

    return data ? checkInFromRow(data) : null;
  },
};

// ---------------------------------------------------------------------------
// REFLECTIONS (text + voice, incl. LLM trauma-informed & tone analysis)
// ---------------------------------------------------------------------------
export const reflectionsTable = {
  async create(reflection: {
    id?: string;
    checkInId?: string;
    participantId: string;
    type: "text" | "voice";
    transcript: string;
    audioRecorded: boolean;
    shareWithWorker: boolean;
    sentiment?: string;
    languageSignal?: string;
    contributingPatterns?: string[];
    keywords?: string[];
    factors?: string[];
    explanation?: string;
    hasUrgentSafetyMention?: boolean;
    acoustic?: {
      pitchVariabilityScore?: number;
      speakingRateWpm?: number;
      pauseRatio?: number;
      energyScore?: number;
    };
    llm?: {
      emotionalTone?: string;
      toneConfidence?: string;
      traumaIndicators?: string[];
      distressSignals?: string[];
      riskBand?: string;
      crisisFlag?: boolean;
      rationale?: string;
      confidence?: string;
      suggestedHumanAction?: string;
    };
  }) {
    const payload = {
      id: reflection.id || `ref-${Date.now()}`,
      check_in_id: reflection.checkInId,
      participant_id: reflection.participantId,
      type: reflection.type,
      transcript: reflection.transcript,
      audio_recorded: reflection.audioRecorded,
      share_with_worker: reflection.shareWithWorker,
      sentiment: reflection.sentiment,
      language_signal: reflection.languageSignal,
      contributing_patterns: reflection.contributingPatterns || [],
      keywords: reflection.keywords || [],
      factors: reflection.factors || [],
      explanation: reflection.explanation,
      has_urgent_safety_mention: reflection.hasUrgentSafetyMention ?? false,
      acoustic_pitch_variability: reflection.acoustic?.pitchVariabilityScore,
      acoustic_speaking_rate: reflection.acoustic?.speakingRateWpm,
      acoustic_pause_ratio: reflection.acoustic?.pauseRatio,
      acoustic_energy: reflection.acoustic?.energyScore,
      llm_emotional_tone: reflection.llm?.emotionalTone,
      llm_tone_confidence: reflection.llm?.toneConfidence,
      llm_trauma_indicators: reflection.llm?.traumaIndicators || [],
      llm_distress_signals: reflection.llm?.distressSignals || [],
      llm_risk_band: reflection.llm?.riskBand,
      llm_crisis_flag: reflection.llm?.crisisFlag ?? false,
      llm_rationale: reflection.llm?.rationale,
      llm_confidence: reflection.llm?.confidence,
      llm_suggested_action: reflection.llm?.suggestedHumanAction,
    };
    const { data, error } = await supabase.from("reflections").insert(payload).select().maybeSingle();
    warn("reflections.create", error);
    return data;
  },

  async getAll(participantId?: string) {
    let query = supabase.from("reflections").select("*").order("submitted_at", { ascending: false });
    if (participantId) query = query.eq("participant_id", participantId);
    const { data, error } = await query;
    if (error) warn("reflections.getAll", error);
    return data || [];
  },
};

// ---------------------------------------------------------------------------
// ALERTS
// ---------------------------------------------------------------------------
function alertFromRow(row: any, name?: string, assignedWorker?: string | null): Alert {
  return {
    id: row.id,
    participantId: row.participant_id,
    participantName: name,
    participantAssignedWorker: assignedWorker,
    category: row.category,
    severity: row.severity,
    title: row.title,
    description: row.description,
    reason: row.reason,
    recommendedAction: row.recommended_action,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    assignedTo: row.assigned_to,
    humanDecision: row.human_decision,
    decisionNotes: row.decision_notes,
    actionTaken: row.action_taken,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    // The two response clocks. These columns existed and were never read,
    // which meant slaEngine saw every alert as unacknowledged and would have
    // reported a queue of total breaches whatever the team actually did.
    acknowledgedAt: row.acknowledged_at,
    contactAttemptedAt: row.contact_attempted_at,
    changeDelta: row.change_delta,
    score: row.score,
    contributingFactors: row.contributing_factors,
    trajectory: row.trajectory,
    requiresHumanReview: row.requires_human_review,
  };
}

export const alertsTable = {
  async getAll(participantId?: string, status?: string): Promise<Alert[]> {
    let query = supabase.from("alerts").select("*").order("created_at", { ascending: false });
    if (participantId) query = query.eq("participant_id", participantId);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      warn("alerts.getAll", error);
      return [];
    }
    const rows = data || [];

    // Resolve, at the data layer, each alert's participant name (profiles.name)
    // AND that participant's current assigned counsellor (participants.
    // assigned_worker) — so staff lists always show a real name and caseload
    // scoping never depends on a stale client-side participants array. Staff
    // RLS lets a counsellor/admin read every profile and participant row.
    const uuidIds = Array.from(new Set(rows.map((r: any) => r.participant_id))).filter(isUuid);
    const allIds = Array.from(new Set(rows.map((r: any) => r.participant_id)));
    let nameById = new Map<string, string>();
    let workerById = new Map<string, string | null>();
    if (uuidIds.length > 0) {
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, name").in("id", uuidIds);
      if (pErr) warn("alerts.getAll (participant names)", pErr);
      nameById = new Map((profiles || []).map((p: any) => [p.id, p.name]));
    }
    if (allIds.length > 0) {
      const { data: parts, error: paErr } = await supabase
        .from("participants")
        .select("id, assigned_worker")
        .in("id", allIds);
      if (paErr) warn("alerts.getAll (participant assignment)", paErr);
      workerById = new Map((parts || []).map((p: any) => [p.id, p.assigned_worker || null]));
    }
    return rows.map((row: any) =>
      alertFromRow(
        row,
        nameById.get(row.participant_id) || undefined,
        workerById.has(row.participant_id) ? workerById.get(row.participant_id) : undefined
      )
    );
  },

  async create(alert: Partial<Alert> & { participantId: string }): Promise<Alert | null> {
    const payload = {
      id: alert.id || `ALT-${Date.now()}`,
      participant_id: alert.participantId,
      category: alert.category || "GENERAL_DISTRESS",
      severity: alert.severity || "YELLOW",
      title: alert.title || "Wellbeing Alert",
      reason: alert.reason || "Alert generated from system evaluation",
      description: alert.description || "",
      recommended_action: alert.recommendedAction || "",
      status: alert.status || "NEW",
      score: alert.score ?? 50,
      change_delta: alert.changeDelta,
      assigned_to: alert.assignedTo,
      contributing_factors: alert.contributingFactors || [],
      trajectory: alert.trajectory,
      requires_human_review: alert.requiresHumanReview ?? true,
    };
    const { data, error } = await supabase.from("alerts").upsert(payload).select().maybeSingle();
    if (error) {
      warn("alerts.create", error);
      return null;
    }
    return data ? alertFromRow(data) : null;
  },

  async update(id: string, updates: Partial<Alert>): Promise<void> {
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.humanDecision !== undefined) payload.human_decision = updates.humanDecision;
    if (updates.decisionNotes !== undefined) payload.decision_notes = updates.decisionNotes;
    if (updates.actionTaken !== undefined) payload.action_taken = updates.actionTaken;
    if (updates.reviewedBy !== undefined) {
      payload.reviewed_by = updates.reviewedBy;
      payload.reviewed_at = new Date().toISOString();
    }
    if (updates.contactAttemptedAt !== undefined) {
      payload.contact_attempted_at = updates.contactAttemptedAt;
    }
    // The acknowledgement clock stops the first time a human takes the alert
    // on, and never restarts. Two rules make the number worth reporting:
    //
    // It is set here rather than by the caller, so every path that acts on an
    // alert stamps it and none can forget. And it is written with coalesce so
    // a later edit cannot move it forward — an alert acknowledged after six
    // hours and revisited next week must still read as six hours, or the
    // breach rate improves every time someone reopens an old case.
    const acknowledging =
      updates.acknowledgedAt !== undefined ||
      updates.reviewedBy !== undefined ||
      updates.humanDecision !== undefined ||
      (updates.status !== undefined && updates.status !== "NEW");
    if (acknowledging) {
      const stamp = updates.acknowledgedAt || new Date().toISOString();
      const { data: existing } = await supabase
        .from("alerts")
        .select("acknowledged_at")
        .eq("id", id)
        .maybeSingle();
      if (!existing?.acknowledged_at) payload.acknowledged_at = stamp;
    }
    const { error } = await supabase.from("alerts").update(payload).eq("id", id);
    warn("alerts.update", error);
  },
};

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------
function notificationFromRow(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    participantId: row.participant_id,
    category: row.category,
    filterCategory: row.filter_category,
    severity: row.severity,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    read: row.read,
    actionLabel: row.action_label,
    actionView: row.action_view,
    actionParticipantId: row.action_participant_id,
    metadata: row.metadata_json,
  };
}

export const notificationsTable = {
  async getAll(unreadOnly = false): Promise<AppNotification[]> {
    let query = supabase.from("notifications").select("*").order("created_at", { ascending: false });
    if (unreadOnly) query = query.eq("read", false);
    const { data, error } = await query;
    if (error) {
      warn("notifications.getAll", error);
      return [];
    }
    return (data || []).map(notificationFromRow);
  },

  async create(notif: {
    userId: string;
    participantId?: string;
    category: string;
    filterCategory?: string;
    severity: string;
    title: string;
    message: string;
    actionLabel?: string;
    actionView?: string;
    actionParticipantId?: string;
    metadata?: any;
  }): Promise<void> {
    // notifications.user_id is a real FK to auth.users(id), so a synthetic
    // placeholder id (e.g. "worker_1", "broadcast") can't be written there —
    // route those as a broadcast notification (user_id: null) instead of
    // dropping them. RLS's is_staff() clause already lets any signed-in
    // counselor read every notification regardless of user_id, so a
    // broadcast row still reaches whichever worker is logged in.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notif.userId);
    const { error } = await supabase.from("notifications").insert({
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: isUuid ? notif.userId : null,
      participant_id: notif.participantId,
      category: notif.category,
      filter_category: notif.filterCategory,
      severity: notif.severity,
      title: notif.title,
      message: notif.message,
      action_label: notif.actionLabel,
      action_view: notif.actionView,
      action_participant_id: notif.actionParticipantId,
      metadata_json: notif.metadata,
    });
    warn("notifications.create", error);
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    warn("notifications.markRead", error);
  },

  async markAllRead(): Promise<void> {
    const userId = await getActiveUserId();
    if (!userId) return;
    const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    warn("notifications.markAllRead", error);
  },
};

// ---------------------------------------------------------------------------
// INTERVENTIONS & FOLLOW-UPS
// ---------------------------------------------------------------------------
export const interventionsTable = {
  async getAll(participantId?: string) {
    let query = supabase.from("interventions").select("*").order("created_at", { ascending: false });
    if (participantId) query = query.eq("participant_id", participantId);
    const { data, error } = await query;
    if (error) warn("interventions.getAll", error);
    return data || [];
  },
  async create(intervention: any) {
    const { data, error } = await supabase
      .from("interventions")
      .insert({
        id: intervention.id || `intv-${Date.now()}`,
        participant_id: intervention.participantId,
        alert_id: intervention.alertId,
        intervention_type: intervention.interventionType,
        assigned_worker: intervention.assignedWorker,
        intervention_date: intervention.date || new Date().toISOString(),
        outcome: intervention.outcome || "in_progress",
        notes: intervention.notes || "",
        previous_risk: intervention.previousRisk,
      })
      .select()
      .maybeSingle();
    warn("interventions.create", error);
    return data;
  },
};

function followUpFromRow(row: any): InterventionFollowUp {
  return {
    id: row.id,
    participantId: row.participant_id,
    alertId: row.alert_id,
    originalScore: row.original_score,
    interventionType: row.intervention_type,
    interventionDate: row.intervention_date,
    workerName: row.worker_name,
    followUpScore: row.follow_up_score,
    followUpDate: row.follow_up_date,
    scoreDelta: row.score_delta,
    outcome: row.outcome,
    outcomeLabel: row.outcome_label,
    notes: row.notes,
  };
}

export const followUpsTable = {
  async getAll(participantId?: string): Promise<InterventionFollowUp[]> {
    let query = supabase.from("follow_ups").select("*").order("created_at", { ascending: false });
    if (participantId) query = query.eq("participant_id", participantId);
    const { data, error } = await query;
    if (error) {
      warn("followUps.getAll", error);
      return [];
    }
    return (data || []).map(followUpFromRow);
  },

  async create(followUp: Partial<InterventionFollowUp> & { participantId: string }): Promise<InterventionFollowUp | null> {
    const payload = {
      id: followUp.id || `fup-${Date.now()}`,
      participant_id: followUp.participantId,
      alert_id: followUp.alertId,
      original_score: followUp.originalScore ?? 50,
      intervention_type: followUp.interventionType || "Follow-up",
      intervention_date: followUp.interventionDate || new Date().toISOString(),
      worker_name: followUp.workerName || "Counselor",
      outcome: followUp.outcome || "pending",
      outcome_label: followUp.outcomeLabel || "In Progress",
      notes: followUp.notes || "",
    };
    const { data, error } = await supabase.from("follow_ups").upsert(payload).select().maybeSingle();
    if (error) {
      warn("followUps.create", error);
      return null;
    }
    return data ? followUpFromRow(data) : null;
  },

  async update(id: string, updates: Partial<InterventionFollowUp>): Promise<void> {
    const payload: any = {};
    if (updates.followUpScore !== undefined) payload.follow_up_score = updates.followUpScore;
    if (updates.followUpDate !== undefined) payload.follow_up_date = updates.followUpDate;
    if (updates.scoreDelta !== undefined) payload.score_delta = updates.scoreDelta;
    if (updates.outcome !== undefined) payload.outcome = updates.outcome;
    if (updates.outcomeLabel !== undefined) payload.outcome_label = updates.outcomeLabel;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    const { error } = await supabase.from("follow_ups").update(payload).eq("id", id);
    warn("followUps.update", error);
  },
};

// ---------------------------------------------------------------------------
// CONSENTS
// ---------------------------------------------------------------------------
export const consentsTable = {
  async get(participantId: string): Promise<ConsentPreferences | null> {
    const { data, error } = await supabase.from("consents").select("*").eq("participant_id", participantId).maybeSingle();
    if (error || !data) {
      if (error) warn("consents.get", error);
      return null;
    }
    // The three voice columns were backfilled from optional_voice_feature, so
    // they are authoritative. The fallback to the old column covers a row
    // written by an older client that has not been through the split.
    const legacyVoice = Boolean(data.optional_voice_feature);
    return {
      wellbeingCheckIns: data.wellbeing_check_ins,
      supportWorkerSharing: data.support_worker_sharing,
      optionalFreeTextSharing: data.optional_free_text_sharing,
      optionalVoiceFeature: legacyVoice,
      voiceTranscription: data.voice_transcription ?? legacyVoice,
      voiceAcousticAnalysis: data.voice_acoustic_analysis ?? legacyVoice,
      voiceAudioRetention: data.voice_audio_retention ?? legacyVoice,
      communityAggregateAnalytics: data.community_aggregate_analytics,
      updatedAt: data.updated_at,
    };
  },

  async upsert(participantId: string, prefs: Partial<ConsentPreferences>, status = "active"): Promise<void> {
    const userId = await getActiveUserId();
    const payload: any = {
      id: `cst-${participantId}`,
      participant_id: participantId,
      user_id: userId,
      status,
      updated_at: new Date().toISOString(),
    };
    if (prefs.wellbeingCheckIns !== undefined) payload.wellbeing_check_ins = prefs.wellbeingCheckIns;
    if (prefs.supportWorkerSharing !== undefined) payload.support_worker_sharing = prefs.supportWorkerSharing;
    if (prefs.optionalFreeTextSharing !== undefined) payload.optional_free_text_sharing = prefs.optionalFreeTextSharing;
    if (prefs.voiceTranscription !== undefined) payload.voice_transcription = prefs.voiceTranscription;
    if (prefs.voiceAcousticAnalysis !== undefined) payload.voice_acoustic_analysis = prefs.voiceAcousticAnalysis;
    if (prefs.voiceAudioRetention !== undefined) payload.voice_audio_retention = prefs.voiceAudioRetention;
    // The deprecated column is kept in step rather than frozen, so anything
    // still reading it sees something true rather than a stale snapshot. It
    // is true only when all three parts are permitted, which is what it
    // originally meant.
    const voiceParts = [prefs.voiceTranscription, prefs.voiceAcousticAnalysis, prefs.voiceAudioRetention];
    if (voiceParts.some((p) => p !== undefined)) {
      payload.optional_voice_feature = voiceParts.every((p) => p === true);
    } else if (prefs.optionalVoiceFeature !== undefined) {
      payload.optional_voice_feature = prefs.optionalVoiceFeature;
    }
    if (prefs.communityAggregateAnalytics !== undefined) payload.community_aggregate_analytics = prefs.communityAggregateAnalytics;

    const { error } = await supabase.from("consents").upsert(payload);
    warn("consents.upsert", error);
  },

  async revoke(participantId: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from("consents")
      .update({ status: "revoked", revocation_reason: reason, revoked_at: new Date().toISOString() })
      .eq("participant_id", participantId);
    warn("consents.revoke", error);
  },
};

// ---------------------------------------------------------------------------
// SUPPORT NOTES
// ---------------------------------------------------------------------------
export const supportNotesTable = {
  async create(participantId: string, note: SupportNote): Promise<void> {
    const { error } = await supabase.from("support_notes").insert({
      id: note.id || `sn-${Date.now()}`,
      participant_id: participantId,
      author: note.author,
      occurred_at: note.timestamp || new Date().toISOString(),
      text: note.text,
      action_taken: note.actionTaken,
    });
    warn("supportNotes.create", error);
  },

  async getAll(participantId: string): Promise<SupportNote[]> {
    // Legacy demo records carry non-uuid ids (e.g. "P-1003"); PostgREST rejects
    // those against a uuid column with a 400, so skip the round-trip entirely.
    if (!isUuid(participantId)) return [];
    const { data, error } = await supabase
      .from("support_notes")
      .select("*")
      .eq("participant_id", participantId)
      .order("occurred_at", { ascending: false });
    if (error) {
      warn("supportNotes.getAll", error);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      author: row.author,
      timestamp: row.occurred_at,
      text: row.text,
      actionTaken: row.action_taken,
    }));
  },
};

// ---------------------------------------------------------------------------
// SUPPORT RESOURCES (public directory)
// ---------------------------------------------------------------------------
export const supportResourcesTable = {
  async getAll() {
    const { data, error } = await supabase.from("support_resources").select("*").order("name", { ascending: true });
    if (error) warn("supportResources.getAll", error);
    return data || [];
  },
  async create(resource: any) {
    const { data, error } = await supabase
      .from("support_resources")
      .insert({ id: resource.id || `res-${Date.now()}`, ...toResourceRow(resource) })
      .select()
      .maybeSingle();
    warn("supportResources.create", error);
    return data;
  },
  async update(id: string, updates: any) {
    const { error } = await supabase.from("support_resources").update(toResourceRow(updates)).eq("id", id);
    warn("supportResources.update", error);
  },
  async remove(id: string) {
    const { error } = await supabase.from("support_resources").delete().eq("id", id);
    warn("supportResources.delete", error);
  },
};

function toResourceRow(r: any) {
  const row: any = {};
  if (r.name !== undefined) row.name = r.name;
  if (r.resourceType !== undefined || r.resource_type !== undefined) row.resource_type = r.resourceType ?? r.resource_type;
  if (r.region !== undefined) row.region = r.region;
  if (r.language !== undefined) row.language = r.language;
  if (r.contactMethod !== undefined || r.contact_method !== undefined) row.contact_method = r.contactMethod ?? r.contact_method;
  if (r.phone !== undefined) row.phone = r.phone;
  if (r.website !== undefined) row.website = r.website;
  if (r.hours !== undefined) row.hours = r.hours;
  if (r.emergencyFlag !== undefined || r.emergency_flag !== undefined) row.emergency_flag = r.emergencyFlag ?? r.emergency_flag;
  if (r.accessibility !== undefined) row.accessibility = r.accessibility;
  if (r.verificationStatus !== undefined || r.verification_status !== undefined) row.verification_status = r.verificationStatus ?? r.verification_status;
  return row;
}

// ---------------------------------------------------------------------------
// AUDIT LOGS
// ---------------------------------------------------------------------------
export const auditLogsTable = {
  async create(entry: {
    actorId: string;
    actorRole: string;
    actorName?: string;
    action: string;
    category: string;
    participantId?: string;
    targetId?: string;
    description: string;
    severity?: string;
    metadata?: any;
  }): Promise<void> {
    const { error } = await supabase.from("audit_logs").insert({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      actor_name: entry.actorName,
      action: entry.action,
      category: entry.category,
      participant_id: entry.participantId,
      target_id: entry.targetId,
      description: entry.description,
      severity: entry.severity || "INFO",
      metadata_json: entry.metadata,
    });
    warn("auditLogs.create", error);
  },

  async getAll(category?: string, participantId?: string): Promise<AuditEvent[]> {
    let query = supabase.from("audit_logs").select("*").order("occurred_at", { ascending: false }).limit(200);
    if (category) query = query.eq("category", category);
    if (participantId) query = query.eq("participant_id", participantId);
    const { data, error } = await query;
    if (error) {
      warn("auditLogs.getAll", error);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.occurred_at,
      actorId: row.actor_id,
      actorRole: row.actor_role,
      actorName: row.actor_name,
      action: row.action,
      category: row.category,
      participantId: row.participant_id,
      targetId: row.target_id,
      description: row.description,
      severity: row.severity,
      metadata: row.metadata_json,
    }));
  },
};

// ---------------------------------------------------------------------------
// RISK PREDICTIONS
// ---------------------------------------------------------------------------
export const riskTable = {
  async createPrediction(pred: {
    participantId: string;
    distressScore: number;
    riskLevel: string;
    trajectory?: string;
    confidence?: number;
    changeDelta?: number;
    contributingFactors?: any;
    factorBreakdown?: any;
    explanation?: string;
    requiresHumanReview?: boolean;
    isExplicitSafetyConcern?: boolean;
  }): Promise<void> {
    const { error } = await supabase.from("risk_predictions").insert({
      id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      participant_id: pred.participantId,
      distress_score: pred.distressScore,
      risk_level: pred.riskLevel,
      trajectory: pred.trajectory,
      confidence: pred.confidence,
      change_delta: pred.changeDelta,
      contributing_factors: pred.contributingFactors || [],
      factor_breakdown: pred.factorBreakdown || {},
      explanation: pred.explanation,
      requires_human_review: pred.requiresHumanReview ?? true,
      is_explicit_safety_concern: pred.isExplicitSafetyConcern ?? false,
    });
    warn("risk.createPrediction", error);
  },

  async getPredictions(participantId?: string) {
    let query = supabase.from("risk_predictions").select("*").order("created_at", { ascending: false });
    if (participantId) query = query.eq("participant_id", participantId);
    const { data, error } = await query;
    if (error) warn("risk.getPredictions", error);
    return data || [];
  },

  async getHistory(participantId: string) {
    const { data, error } = await supabase
      .from("risk_history")
      .select("*")
      .eq("participant_id", participantId)
      .order("recorded_at", { ascending: true });
    if (error) warn("risk.getHistory", error);
    return data || [];
  },
};

// ---------------------------------------------------------------------------
// REGIONAL CONFLICT CONTEXT
// Read-only, public, non-identifying humanitarian statistics (UCDP via Our
// World in Data) -- see the regional_conflict_context migration. No
// participant data is involved, so this reads with the normal anon client
// like everything else in this file.
// ---------------------------------------------------------------------------
const regionalContextTable = {
  async getAll() {
    const { data, error } = await supabase
      .from("regional_conflict_context")
      .select("*")
      .order("deaths_estimate", { ascending: false });
    if (error) {
      warn("regionalContext.getAll", error);
      return [];
    }
    return data || [];
  },
};

// ---------------------------------------------------------------------------
// MESSAGES (participant <-> their currently assigned counselor)
// RLS on the `messages` table itself enforces the assigned-pair restriction
// (see the migration) — this layer just shapes rows to/from the app's types.
// ---------------------------------------------------------------------------
function messageFromRow(row: any): Message {
  return {
    id: row.id,
    participantId: row.participant_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    read: row.read,
    createdAt: row.created_at,
  };
}

export const messagesTable = {
  async getForParticipant(participantId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: true });
    if (error) {
      warn("messages.getForParticipant", error);
      return [];
    }
    return (data || []).map(messageFromRow);
  },

  // For a counselor's inbox view: fetch every conversation across all
  // of their assigned participants in one query instead of one per thread.
  async getForParticipants(participantIds: string[]): Promise<Message[]> {
    if (participantIds.length === 0) return [];
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .in("participant_id", participantIds)
      .order("created_at", { ascending: true });
    if (error) {
      warn("messages.getForParticipants", error);
      return [];
    }
    return (data || []).map(messageFromRow);
  },

  async send(input: {
    participantId: string;
    senderId: string;
    senderRole: "participant" | "support_worker";
    body: string;
  }): Promise<Message | null> {
    const body = input.body.trim();
    if (!body) return null;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        participant_id: input.participantId,
        sender_id: input.senderId,
        sender_role: input.senderRole,
        body,
      })
      .select()
      .maybeSingle();
    if (error) {
      warn("messages.send", error);
      return null;
    }
    return data ? messageFromRow(data) : null;
  },

  // Marks every message from the *other* party in a thread as read — call
  // this when the reader opens/views that conversation.
  async markThreadRead(participantId: string, readerRole: "participant" | "support_worker"): Promise<void> {
    const otherRole = readerRole === "participant" ? "support_worker" : "participant";
    const { error } = await supabase
      .from("messages")
      .update({ read: true })
      .eq("participant_id", participantId)
      .eq("sender_role", otherRole)
      .eq("read", false);
    warn("messages.markThreadRead", error);
  },
};

export const profilesTable = {
  // Used by the participant-side Messages view to show their assigned
  // worker's real name (participants.assigned_worker only stores an id).
  async getName(id?: string | null): Promise<string | null> {
    if (!id) return null;
    const { data, error } = await supabase.from("profiles").select("name").eq("id", id).maybeSingle();
    if (error) {
      warn("profiles.getName", error);
      return null;
    }
    return data?.name || null;
  },

  // Batch id -> name resolution (staff can read all profiles via is_staff()).
  // Used to show a counsellor's real name instead of a raw uuid in tables.
  async getNames(ids: Array<string | null | undefined>): Promise<Record<string, string>> {
    const uuids = Array.from(new Set(ids.filter((i): i is string => isUuid(i))));
    if (uuids.length === 0) return {};
    const { data, error } = await supabase.from("profiles").select("id, name").in("id", uuids);
    if (error) {
      warn("profiles.getNames", error);
      return {};
    }
    const out: Record<string, string> = {};
    (data || []).forEach((r: any) => {
      if (r?.id && r?.name) out[r.id] = r.name;
    });
    return out;
  },
};

// ---------------------------------------------------------------------------
// VALIDATED INSTRUMENT ADMINISTRATIONS
// ---------------------------------------------------------------------------

function administrationFromRow(row: any): InstrumentAdministration {
  return {
    id: row.id,
    participantId: row.participant_id,
    instrumentId: row.instrument_id,
    instrumentVersion: row.instrument_version,
    itemResponses: row.item_responses || {},
    rawScore: row.raw_score,
    scaledScore: row.scaled_score,
    administeredAt: row.administered_at,
  };
}

/**
 * There is no update here, matching the table, which has no UPDATE policy.
 * An administration is a measurement taken at a moment. It can be superseded
 * by a later one; it cannot be edited into a different answer.
 */
export const instrumentAdministrationsTable = {
  async getAll(participantId?: string): Promise<InstrumentAdministration[]> {
    let query = supabase
      .from("instrument_administrations")
      .select("*")
      .order("administered_at", { ascending: true });
    if (participantId) query = query.eq("participant_id", participantId);
    const { data, error } = await query;
    if (error) {
      warn("instrumentAdministrations.getAll", error);
      return [];
    }
    return (data || []).map(administrationFromRow);
  },

  /**
   * Writes one completed administration.
   *
   * Scoring happens here rather than being accepted from the caller, so a
   * stored raw/scaled pair always agrees with the stored item responses. A
   * screen that computed its own total and sent it could drift from the
   * scoring rule, and the resulting row would be unfalsifiable: the responses
   * would say one thing and the total another, with no way to know which was
   * wrong. scoreInstrument throws on an incomplete set, which is the correct
   * outcome; a partial instrument is not a measurement.
   */
  async create(
    participantId: string,
    instrument: Instrument,
    responses: ItemResponses,
    administeredAt?: string
  ): Promise<InstrumentAdministration | null> {
    const score = scoreInstrument(instrument, responses);
    const payload = {
      id: `ins-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      participant_id: participantId,
      instrument_id: instrument.id,
      instrument_version: instrument.version,
      item_responses: responses,
      raw_score: score.raw,
      scaled_score: score.scaled,
      administered_at: administeredAt || new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("instrument_administrations")
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) {
      warn("instrumentAdministrations.create", error);
      return null;
    }
    return data ? administrationFromRow(data) : null;
  },
};

export const supabaseService = {
  getActiveUserId,
  instrumentAdministrations: instrumentAdministrationsTable,
  participants: participantsTable,
  checkIns: checkInsTable,
  reflections: reflectionsTable,
  alerts: alertsTable,
  notifications: notificationsTable,
  interventions: interventionsTable,
  followUps: followUpsTable,
  consents: consentsTable,
  supportNotes: supportNotesTable,
  supportResources: supportResourcesTable,
  auditLogs: auditLogsTable,
  risk: riskTable,
  regionalContext: regionalContextTable,
  messages: messagesTable,
  profiles: profilesTable,
};

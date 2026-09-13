import { supabase } from "./supabaseClient";
import {
  CounsellorDirectoryEntry,
  CounsellorProfile,
  CounsellingSession,
  MatchingQuizAnswers,
  MatchingQuizResponse,
  OwnReview,
  PublicReview,
  SessionFormat,
  SupportTag,
  SwitchFeedback,
} from "../types";

/**
 * Data access for counsellor self-selection.
 *
 * Reads go through the counsellor_directory and counsellor_reviews_public
 * views rather than the underlying tables. That is not a convenience: the views
 * are a fixed projection, so there is no query in this file that could be
 * widened later into returning a counsellor's email or a reviewer's identity.
 *
 * Choosing a counsellor goes through the select_counsellor() function, because
 * it has to update the assignment and append to assignment_history together.
 */

const PHOTO_BUCKET = "counsellor-photos";
const PHOTO_URL_TTL_SECONDS = 60 * 60;

function warn(op: string, err: any) {
  if (err) console.warn(`[Selection] ${op}:`, err.message || err);
}

/** Photos live in a private bucket, so every URL is short-lived and signed. */
async function signPhoto(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, PHOTO_URL_TTL_SECONDS);
  if (error) {
    warn("signPhoto", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

async function directoryFromRows(rows: any[]): Promise<CounsellorDirectoryEntry[]> {
  return Promise.all(
    (rows || []).map(async (r) => ({
      workerId: r.worker_id,
      displayName: r.display_name || "Counsellor",
      photoUrl: await signPhoto(r.photo_path),
      bio: r.bio,
      specialties: r.specialties || [],
      languages: r.languages || [],
      sessionFormats: (r.session_formats || []) as SessionFormat[],
      yearsExperience: r.years_experience,
      gender: r.gender,
      acceptingNewClients: !!r.accepting_new_clients,
      ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg),
      ratingCount: r.rating_count === null ? null : Number(r.rating_count),
    }))
  );
}

export const counsellorSelectionService = {
  async listTags(): Promise<SupportTag[]> {
    const { data, error } = await supabase
      .from("support_tags")
      .select("tag, label, sort_order")
      .order("sort_order");
    warn("listTags", error);
    return (data || []).map((r: any) => ({ tag: r.tag, label: r.label, sortOrder: r.sort_order }));
  },

  async listCounsellors(): Promise<CounsellorDirectoryEntry[]> {
    const { data, error } = await supabase
      .from("counsellor_directory")
      .select("*")
      .order("display_name");
    warn("listCounsellors", error);
    return directoryFromRows(data || []);
  },

  async getCounsellor(workerId: string): Promise<CounsellorDirectoryEntry | null> {
    const { data, error } = await supabase
      .from("counsellor_directory")
      .select("*")
      .eq("worker_id", workerId)
      .maybeSingle();
    warn("getCounsellor", error);
    if (!data) return null;
    return (await directoryFromRows([data]))[0] ?? null;
  },

  /** Published reviews only, and only once a counsellor has at least five. */
  async listReviews(workerId: string): Promise<PublicReview[]> {
    const { data, error } = await supabase
      .from("counsellor_reviews_public")
      .select("*")
      .eq("worker_id", workerId)
      .order("reviewed_month", { ascending: false });
    warn("listReviews", error);
    return (data || []).map((r: any) => ({
      workerId: r.worker_id,
      rating: r.rating,
      body: r.body,
      reviewedMonth: r.reviewed_month,
    }));
  },

  // -------------------------------------------------------------------------
  // Quiz — preference data, owned by the person who answered it
  // -------------------------------------------------------------------------

  async saveQuiz(participantId: string, answers: MatchingQuizAnswers): Promise<boolean> {
    const { error } = await supabase.from("matching_quiz_responses").insert({
      participant_id: participantId,
      looking_for: answers.lookingFor,
      preferred_languages: answers.preferredLanguages,
      gender_preference: answers.genderPreference,
      preferred_formats: answers.preferredFormats,
      start_urgency: answers.startUrgency,
    });
    warn("saveQuiz", error);
    return !error;
  },

  /** The most recent answers, so a returning user sees their shortlist again. */
  async latestQuiz(participantId: string): Promise<MatchingQuizResponse | null> {
    const { data, error } = await supabase
      .from("matching_quiz_responses")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    warn("latestQuiz", error);
    if (!data) return null;
    return {
      id: data.id,
      participantId: data.participant_id,
      lookingFor: data.looking_for || [],
      preferredLanguages: data.preferred_languages || [],
      genderPreference: data.gender_preference,
      preferredFormats: data.preferred_formats || [],
      startUrgency: data.start_urgency,
      createdAt: data.created_at,
    };
  },

  /**
   * Clears every stored answer. Offered because preference data someone no
   * longer wants kept should be deletable by them without asking anyone.
   */
  async clearQuiz(participantId: string): Promise<boolean> {
    const { error } = await supabase
      .from("matching_quiz_responses")
      .delete()
      .eq("participant_id", participantId);
    warn("clearQuiz", error);
    return !error;
  },

  // -------------------------------------------------------------------------
  // Choosing and switching
  // -------------------------------------------------------------------------

  /** Returns null on success, or a message safe to show the user. */
  async chooseCounsellor(workerId: string): Promise<string | null> {
    const { error } = await supabase.rpc("select_counsellor", { p_worker: workerId });
    if (error) {
      warn("chooseCounsellor", error);
      return error.message?.includes("accepting new clients")
        ? "That counsellor has just stopped accepting new clients. Please choose another."
        : "We could not change your counsellor just now. Please try again.";
    }
    return null;
  },

  /**
   * Optional note about the counsellor a person has just moved away from.
   *
   * Deliberately separate from submitReview: a review needs a completed
   * session behind it, and most switches have none. Returns null on success,
   * or a message safe to show the user.
   */
  async submitSwitchFeedback(input: {
    participantId: string;
    previousWorkerId: string;
    newWorkerId?: string | null;
    rating?: number | null;
    body?: string;
  }): Promise<string | null> {
    const body = input.body?.trim() || null;
    if (!input.rating && !body) return "Please add a rating or a few words first.";

    const { error } = await supabase.from("counsellor_switch_feedback").insert({
      participant_id: input.participantId,
      previous_worker_id: input.previousWorkerId,
      new_worker_id: input.newWorkerId || null,
      rating: input.rating || null,
      body,
    });
    if (error) {
      warn("submitSwitchFeedback", error);
      return "We could not save that just now. Please try again.";
    }
    return null;
  },

  /** The person's own notes back, so they can see what they have already said. */
  async listSwitchFeedback(): Promise<SwitchFeedback[]> {
    const { data, error } = await supabase
      .from("my_switch_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    warn("listSwitchFeedback", error);
    return (data || []).map((r: any) => ({
      id: r.id,
      previousWorkerId: r.previous_worker_id,
      newWorkerId: r.new_worker_id,
      rating: r.rating,
      body: r.body,
      createdAt: r.created_at,
    }));
  },

  // -------------------------------------------------------------------------
  // Sessions and reviews
  // -------------------------------------------------------------------------

  async listSessions(participantId: string): Promise<CounsellingSession[]> {
    const { data, error } = await supabase
      .from("counselling_sessions")
      .select("*")
      .eq("participant_id", participantId)
      .order("held_at", { ascending: false, nullsFirst: false });
    warn("listSessions", error);
    return (data || []).map((r: any) => ({
      id: r.id,
      participantId: r.participant_id,
      workerId: r.worker_id,
      scheduledAt: r.scheduled_at,
      heldAt: r.held_at,
      status: r.status,
      format: r.format,
      createdAt: r.created_at,
    }));
  },

  /** A participant's own reviews, used to show what is still awaiting review. */
  async listOwnReviews(participantId: string): Promise<OwnReview[]> {
    const { data, error } = await supabase
      .from("counsellor_reviews")
      .select("id, session_id, worker_id, rating, body, status, created_at")
      .eq("reviewer_id", participantId);
    warn("listOwnReviews", error);
    return (data || []).map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      workerId: r.worker_id,
      rating: r.rating,
      body: r.body,
      status: r.status,
      createdAt: r.created_at,
    }));
  },

  /**
   * Submits a review. Eligibility is not checked here — it is enforced by the
   * insert policy, which requires a completed session that belongs to this
   * participant and this counsellor. Checking it in the UI as well would only
   * hide the real rule.
   */
  async submitReview(input: {
    sessionId: string;
    workerId: string;
    participantId: string;
    rating: number;
    body?: string;
  }): Promise<string | null> {
    const { error } = await supabase.from("counsellor_reviews").insert({
      session_id: input.sessionId,
      worker_id: input.workerId,
      reviewer_id: input.participantId,
      rating: input.rating,
      body: input.body?.trim() || null,
      status: "pending",
    });
    if (error) {
      warn("submitReview", error);
      if (error.code === "23505") return "You have already reviewed this session.";
      return "We could not save your review. Only completed sessions can be reviewed.";
    }
    return null;
  },

  // -------------------------------------------------------------------------
  // Counsellor's own profile
  // -------------------------------------------------------------------------

  async getOwnProfile(workerId: string): Promise<CounsellorProfile | null> {
    const { data, error } = await supabase
      .from("counsellor_profiles")
      .select("*")
      .eq("worker_id", workerId)
      .maybeSingle();
    warn("getOwnProfile", error);
    if (!data) return null;
    return {
      workerId: data.worker_id,
      displayName: data.display_name,
      photoPath: data.photo_path,
      photoUrl: await signPhoto(data.photo_path),
      bio: data.bio,
      specialties: data.specialties || [],
      languages: data.languages || [],
      sessionFormats: (data.session_formats || []) as SessionFormat[],
      yearsExperience: data.years_experience,
      gender: data.gender,
      acceptingNewClients: !!data.accepting_new_clients,
      maxCaseload: data.max_caseload,
      published: !!data.published,
    };
  },

  async saveOwnProfile(profile: CounsellorProfile): Promise<string | null> {
    const { error } = await supabase.from("counsellor_profiles").upsert({
      worker_id: profile.workerId,
      display_name: profile.displayName || null,
      photo_path: profile.photoPath || null,
      bio: profile.bio || null,
      specialties: profile.specialties,
      languages: profile.languages,
      session_formats: profile.sessionFormats,
      years_experience: profile.yearsExperience ?? null,
      gender: profile.gender || null,
      accepting_new_clients: profile.acceptingNewClients,
      max_caseload: profile.maxCaseload ?? null,
      published: profile.published,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      warn("saveOwnProfile", error);
      return error.message;
    }
    return null;
  },

  async uploadPhoto(workerId: string, file: File): Promise<string | null> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    // Folder named for the worker's own id — the storage policy requires it.
    const path = `${workerId}/profile.${ext}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      warn("uploadPhoto", error);
      return null;
    }
    return path;
  },

  async listWorkerSessions(workerId: string): Promise<CounsellingSession[]> {
    const { data, error } = await supabase
      .from("counselling_sessions")
      .select("*")
      .eq("worker_id", workerId)
      .order("scheduled_at", { ascending: false, nullsFirst: false });
    warn("listWorkerSessions", error);
    return (data || []).map((r: any) => ({
      id: r.id,
      participantId: r.participant_id,
      workerId: r.worker_id,
      scheduledAt: r.scheduled_at,
      heldAt: r.held_at,
      status: r.status,
      format: r.format,
      createdAt: r.created_at,
    }));
  },

  async logSession(input: {
    participantId: string;
    workerId: string;
    heldAt: string;
    format: SessionFormat;
  }): Promise<string | null> {
    const { error } = await supabase.from("counselling_sessions").insert({
      participant_id: input.participantId,
      worker_id: input.workerId,
      held_at: input.heldAt,
      scheduled_at: input.heldAt,
      status: "completed",
      format: input.format,
    });
    if (error) {
      warn("logSession", error);
      return error.message;
    }
    return null;
  },
};

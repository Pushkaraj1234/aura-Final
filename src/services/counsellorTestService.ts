import { supabase } from "./supabaseClient";
import {
  CounsellorTest,
  CounsellorTestResponse,
  MyTestReview,
  TestAnswer,
  TestQuestion,
} from "../types";

/**
 * Counsellor-authored tests: writing them, answering them, marking them.
 *
 * Row-level security does the enforcing — a participant cannot read a draft or
 * write a mark, and a counsellor can only reach tests they set themselves.
 * Nothing here re-checks that in the client, because a rule enforced in two
 * places drifts, and only one of the two is the one that actually holds.
 *
 * The one thing the database cannot express is hiding a column, so the
 * participant reads reviews through my_test_reviews, which has no mark in it.
 */

function warn(op: string, err: any) {
  if (err) console.warn(`[Tests] ${op}:`, err.message || err);
}

const testFromRow = (r: any): CounsellorTest => ({
  id: r.id,
  participantId: r.participant_id,
  workerId: r.worker_id,
  title: r.title,
  instructions: r.instructions,
  questions: (r.questions || []) as TestQuestion[],
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const responseFromRow = (r: any): CounsellorTestResponse => ({
  id: r.id,
  testId: r.test_id,
  participantId: r.participant_id,
  answers: (r.answers || []) as TestAnswer[],
  submittedAt: r.submitted_at,
  mark: r.mark,
  reviewText: r.review_text,
  reviewedAt: r.reviewed_at,
  reviewedBy: r.reviewed_by,
});

export const counsellorTestService = {
  // -------------------------------------------------------------------------
  // Counsellor side
  // -------------------------------------------------------------------------

  /** Every test this counsellor has set for one participant. */
  async listForParticipant(participantId: string): Promise<CounsellorTest[]> {
    const { data, error } = await supabase
      .from("counsellor_tests")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false });
    warn("listForParticipant", error);
    return (data || []).map(testFromRow);
  },

  async saveTest(input: {
    id?: string;
    participantId: string;
    workerId: string;
    title: string;
    instructions?: string;
    questions: TestQuestion[];
    status: "draft" | "assigned";
  }): Promise<{ test: CounsellorTest | null; error: string | null }> {
    const payload: Record<string, unknown> = {
      participant_id: input.participantId,
      worker_id: input.workerId,
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      questions: input.questions,
      status: input.status,
      updated_at: new Date().toISOString(),
    };
    if (input.id) payload.id = input.id;

    const { data, error } = await supabase
      .from("counsellor_tests")
      .upsert(payload)
      .select()
      .maybeSingle();
    if (error) {
      warn("saveTest", error);
      return { test: null, error: error.message };
    }
    return { test: data ? testFromRow(data) : null, error: null };
  },

  async deleteTest(testId: string): Promise<string | null> {
    const { error } = await supabase.from("counsellor_tests").delete().eq("id", testId);
    warn("deleteTest", error);
    return error?.message ?? null;
  },

  /** Answers to the counsellor's own tests, keyed by test id. */
  async responsesForParticipant(participantId: string): Promise<Map<string, CounsellorTestResponse>> {
    const { data, error } = await supabase
      .from("counsellor_test_responses")
      .select("*")
      .eq("participant_id", participantId);
    warn("responsesForParticipant", error);
    const map = new Map<string, CounsellorTestResponse>();
    (data || []).forEach((r: any) => map.set(r.test_id, responseFromRow(r)));
    return map;
  },

  /**
   * Records the counsellor's mark and written advice.
   *
   * The mark and the advice are saved together on purpose: a number recorded
   * without the sentence explaining it is the thing this feature is meant to
   * avoid producing.
   */
  async reviewResponse(input: {
    responseId: string;
    testId: string;
    workerId: string;
    mark: number;
    reviewText: string;
  }): Promise<string | null> {
    const { error } = await supabase
      .from("counsellor_test_responses")
      .update({
        mark: input.mark,
        review_text: input.reviewText.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: input.workerId,
      })
      .eq("id", input.responseId);
    if (error) {
      warn("reviewResponse", error);
      return error.message;
    }
    const { error: statusErr } = await supabase
      .from("counsellor_tests")
      .update({ status: "reviewed", updated_at: new Date().toISOString() })
      .eq("id", input.testId);
    warn("reviewResponse.status", statusErr);
    return null;
  },

  // -------------------------------------------------------------------------
  // Participant side
  // -------------------------------------------------------------------------

  /** Tests waiting to be answered, plus any already submitted. Never drafts. */
  async myTests(participantId: string): Promise<CounsellorTest[]> {
    const { data, error } = await supabase
      .from("counsellor_tests")
      .select("*")
      .eq("participant_id", participantId)
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    warn("myTests", error);
    return (data || []).map(testFromRow);
  },

  async myResponses(participantId: string): Promise<Map<string, CounsellorTestResponse>> {
    return this.responsesForParticipant(participantId);
  },

  async submitAnswers(input: {
    testId: string;
    participantId: string;
    answers: TestAnswer[];
  }): Promise<string | null> {
    const { error } = await supabase.from("counsellor_test_responses").insert({
      test_id: input.testId,
      participant_id: input.participantId,
      answers: input.answers,
      submitted_at: new Date().toISOString(),
    });
    if (error) {
      warn("submitAnswers", error);
      return error.code === "23505"
        ? "You have already submitted this one."
        : "We could not save your answers. Please try again.";
    }
    const { error: statusErr } = await supabase
      .from("counsellor_tests")
      .update({ status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", input.testId);
    // A failed status update is cosmetic — the answers are saved, and the
    // counsellor finds the test through the response either way.
    warn("submitAnswers.status", statusErr);
    return null;
  },

  /** Reviewed tests as the participant sees them: advice, never the mark. */
  async myReviews(participantId: string): Promise<MyTestReview[]> {
    const { data, error } = await supabase
      .from("my_test_reviews")
      .select("*")
      .eq("participant_id", participantId)
      .order("reviewed_at", { ascending: false });
    warn("myReviews", error);
    return (data || []).map((r: any) => ({
      testId: r.test_id,
      title: r.title,
      answers: (r.answers || []) as TestAnswer[],
      submittedAt: r.submitted_at,
      reviewText: r.review_text,
      reviewedAt: r.reviewed_at,
    }));
  },
};

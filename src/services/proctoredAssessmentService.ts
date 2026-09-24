import { supabase } from "./supabaseClient";
import { CompletedAssessmentRecord } from "../features/proctoredAssessment/types";
import {
  buildAssessmentRow,
  recordFromRow,
  ProctoredAssessmentInput,
} from "../features/proctoredAssessment/utils/persistence";

/**
 * Reads and writes completed proctored trauma assessments
 * (public.proctored_assessments).
 *
 * Row-level security decides who sees what, exactly as for check-ins: a
 * participant reads and writes only their own rows, staff read their
 * caseload. Nothing is cached on the device, so a shared phone never shows
 * one person's results to the next.
 */
export const proctoredAssessmentService = {
  /** Oldest first, which is the order the history comparison expects. */
  async listForParticipant(participantId: string): Promise<{ records: CompletedAssessmentRecord[]; error: string | null }> {
    const { data, error } = await supabase
      .from("proctored_assessments")
      .select("*")
      .eq("participant_id", participantId)
      .order("administered_at", { ascending: true });
    if (error) {
      console.warn("[Supabase] proctoredAssessments.listForParticipant:", error.message);
      return { records: [], error: error.message };
    }
    return { records: (data || []).map(recordFromRow), error: null };
  },

  /**
   * Saves one completed session. Scores are recomputed from the raw answers
   * in buildAssessmentRow, never trusted from the screen that showed them.
   */
  async save(input: ProctoredAssessmentInput): Promise<{ record: CompletedAssessmentRecord | null; error: string | null }> {
    const id = `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row = buildAssessmentRow(input, id);
    const { data, error } = await supabase
      .from("proctored_assessments")
      .insert(row)
      .select()
      .maybeSingle();
    if (error) {
      console.warn("[Supabase] proctoredAssessments.save:", error.message);
      return { record: null, error: error.message };
    }
    return { record: recordFromRow(data || row), error: null };
  },
};

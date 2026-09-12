import { supabase } from "./supabaseClient";
import { GuardianAnswer, GuardianConcern } from "./guardianQuestions";

/**
 * Guardian assessments, from the counsellor's side.
 *
 * The link token is generated and hashed in the counsellor's own browser, and
 * only the hash is sent. The plaintext exists in exactly one place — the link
 * shown once on screen for them to pass on — so the server never holds
 * something that would open the form.
 */

const TTL_DAYS = 14;

export interface GuardianAssessment {
  id: string;
  participantId: string;
  workerId: string;
  guardianLabel: string;
  status: "sent" | "submitted" | "revoked";
  expiresAt: string;
  createdAt: string;
  submittedAt?: string | null;
  answers?: GuardianAnswer[] | null;
  concernLevel?: GuardianConcern | null;
  aiSummary?: string | null;
}

/** What the participant is shown: that it was sent, and to whom. */
export interface GuardianNotice {
  id: string;
  guardianLabel: string;
  status: string;
  createdAt: string;
  submittedAt?: string | null;
}

function warn(op: string, err: any) {
  if (err) console.warn(`[Guardian] ${op}:`, err.message || err);
}

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const fromRow = (r: any): GuardianAssessment => ({
  id: r.id,
  participantId: r.participant_id,
  workerId: r.worker_id,
  guardianLabel: r.guardian_label,
  status: r.status,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
  submittedAt: r.submitted_at,
  answers: r.answers,
  concernLevel: r.concern_level,
  aiSummary: r.ai_summary,
});

export const guardianService = {
  /**
   * Creates an assessment and returns the link to hand over.
   *
   * The link is returned once and never recoverable: only its hash is stored,
   * so a counsellor who loses it issues a new one rather than looking the old
   * one up. That is the property that makes a leaked database useless.
   */
  async createLink(input: {
    participantId: string;
    workerId: string;
    guardianLabel: string;
  }): Promise<{ link: string | null; error: string | null }> {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const token = toBase64Url(raw);
    const tokenHash = await sha256Hex(token);

    const expires = new Date(Date.now() + TTL_DAYS * 24 * 3600 * 1000).toISOString();
    const { error } = await supabase.from("guardian_assessments").insert({
      participant_id: input.participantId,
      worker_id: input.workerId,
      guardian_label: input.guardianLabel.trim(),
      token_hash: tokenHash,
      expires_at: expires,
      status: "sent",
    });
    if (error) {
      warn("createLink", error);
      return { link: null, error: error.message };
    }
    return { link: `${window.location.origin}/?guardian=${token}`, error: null };
  },

  async listForParticipant(participantId: string): Promise<GuardianAssessment[]> {
    const { data, error } = await supabase
      .from("guardian_assessments")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false });
    warn("listForParticipant", error);
    return (data || []).map(fromRow);
  },

  /** Withdraws an unspent link. */
  async revoke(id: string): Promise<string | null> {
    const { error } = await supabase
      .from("guardian_assessments")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("status", "sent");
    warn("revoke", error);
    return error?.message ?? null;
  },

  /** The participant's own view: who was asked, and whether they replied. */
  async noticesForParticipant(participantId: string): Promise<GuardianNotice[]> {
    const { data, error } = await supabase
      .from("my_guardian_assessments")
      .select("*")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false });
    warn("noticesForParticipant", error);
    return (data || []).map((r: any) => ({
      id: r.id,
      guardianLabel: r.guardian_label,
      status: r.status,
      createdAt: r.created_at,
      submittedAt: r.submitted_at,
    }));
  },
};

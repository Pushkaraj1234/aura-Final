import { supabase } from "./supabaseClient";
import { projectSharedDates, toPlainDate } from "./recoveryDateProjection.js";
import type { RecoveryCaseBundle, RecoveryHearing, SharedCaseDate } from "../types/recovery";

/**
 * The narrow bridge between a survivor's own case file and the engine that
 * watches for distress.
 *
 * WHY THIS FILE EXISTS
 *
 * caseEvents.ts has always known that a court hearing is the one distress
 * spike that can be anticipated rather than discovered afterwards, and
 * escalationEngine.ts already raises someone in the days around one. But the
 * only hearing dates AURA held were the ones a counsellor happened to type in.
 * The survivor's own Recovery Hub — the place where the date is actually known
 * — was sealed off from staff, correctly and deliberately, which meant the
 * anticipating engine ran blind on precisely the people who knew when their
 * hearing was.
 *
 * WHAT CROSSES, AND WHAT DOES NOT
 *
 * Dates. That is the entire list.
 *
 * Not the FIR number, not the police station, not the caste certificate, not
 * the medical report, not the incident account, not the note the person wrote
 * themselves about which hearing this is. The projection that decides this
 * lives in `recoveryDateProjection.ts`, which imports no client and so cannot
 * send anything anywhere; the table it feeds has no free-text column to put
 * anything else in. The promise is kept by the schema and by a pure function,
 * not by this file remembering to keep it.
 *
 * THE GRANT IS THE PERSON'S, IN BOTH DIRECTIONS
 *
 * Sharing is off until they turn it on, per case, and turning it off deletes
 * what was shared — by database trigger, so withdrawal does not depend on a
 * follow-up request succeeding. A counsellor can read a shared date and can
 * neither add one nor remove one.
 *
 * WHAT IT IS NOT
 *
 * This is not a court integration. AURA has no connection to any court,
 * police or cause-list system: every date here is what the person wrote down,
 * and it is never presented as confirmed by anybody.
 */

export {
  mergeCaseEvents,
  projectSharedDates,
  sharedDatesToCaseEvents,
  toPlainDate,
} from "./recoveryDateProjection.js";
export type { SharedDateDraft } from "./recoveryDateProjection.js";

const fail = (op: string, error: { message?: string } | null): never => {
  throw new Error(`${op}: ${error?.message || "something went wrong"}`);
};

const toShared = (r: any): SharedCaseDate => ({
  id: r.id,
  caseId: r.case_id,
  ownerId: r.owner_id,
  kind: r.kind,
  onDate: r.on_date,
  sharedAt: r.shared_at,
});

const toHearing = (r: any): RecoveryHearing => ({
  id: r.id,
  caseId: r.case_id,
  hearingOn: r.hearing_on,
  note: r.note ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const recoveryDates = {
  /** Records a court date on the person's own file. */
  async addHearing(caseId: string, hearingOn: string, note?: string): Promise<RecoveryHearing> {
    const onDate = toPlainDate(hearingOn);
    if (!onDate) throw new Error("That does not look like a date.");

    const { data, error } = await supabase
      .from("recovery_hearings")
      .insert({
        id: `hr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        case_id: caseId,
        hearing_on: onDate,
        note: note?.trim() || null,
      })
      .select()
      .single();

    if (error || !data) fail("Could not save that date", error);
    return toHearing(data);
  },

  async removeHearing(caseId: string, hearingId: string): Promise<void> {
    const { error } = await supabase
      .from("recovery_hearings")
      .delete()
      .eq("id", hearingId)
      .eq("case_id", caseId);
    if (error) fail("Could not remove that date", error);
  },

  /**
   * Turns sharing on or off for a case.
   *
   * Turning it off does not need a second call to clear the shared rows: the
   * database trigger does that in the same transaction. Turning it on shares
   * nothing by itself — `syncSharedDates` does the projecting — so a caller
   * that stops halfway has shared nothing rather than something partial.
   */
  async setSharing(caseId: string, on: boolean): Promise<void> {
    const { error } = await supabase
      .from("recovery_cases")
      .update({ share_dates_with_counsellor: on })
      .eq("id", caseId);
    if (error) fail("Could not change that setting", error);
  },

  /**
   * Makes the shared rows match the case. Safe to call repeatedly.
   *
   * With sharing off this deletes everything, which makes it a second line of
   * defence behind the trigger rather than the only one.
   */
  async syncSharedDates(bundle: RecoveryCaseBundle): Promise<SharedCaseDate[]> {
    const caseId = bundle.case.id;
    const desired = projectSharedDates(bundle);

    const { data: existingRows, error: readError } = await supabase
      .from("recovery_shared_dates")
      .select("*")
      .eq("case_id", caseId);
    if (readError) fail("Could not check what is shared", readError);

    const existing = (existingRows ?? []).map(toShared);
    const desiredKeys = new Set(desired.map((d) => `${d.kind}|${d.onDate}`));

    const stale = existing.filter((e) => !desiredKeys.has(`${e.kind}|${e.onDate}`));
    if (stale.length > 0) {
      const { error } = await supabase
        .from("recovery_shared_dates")
        .delete()
        .in("id", stale.map((s) => s.id));
      if (error) fail("Could not withdraw a date", error);
    }

    const existingKeys = new Set(existing.map((e) => `${e.kind}|${e.onDate}`));
    const missing = desired.filter((d) => !existingKeys.has(`${d.kind}|${d.onDate}`));
    if (missing.length > 0) {
      const { error } = await supabase.from("recovery_shared_dates").insert(
        missing.map((m) => ({
          id: m.id,
          case_id: m.caseId,
          owner_id: m.ownerId,
          kind: m.kind,
          on_date: m.onDate,
        }))
      );
      if (error) fail("Could not share that date", error);
    }

    const { data: finalRows } = await supabase
      .from("recovery_shared_dates")
      .select("*")
      .eq("case_id", caseId)
      .order("on_date", { ascending: true });

    return (finalRows ?? []).map(toShared);
  },

  /**
   * The counsellor's read.
   *
   * Returns an empty map rather than throwing. A dashboard that cannot reach
   * this table should show the caseload it already has, not an error screen:
   * these dates add to an assessment, they are not a precondition for making
   * one.
   */
  async listForOwners(ownerIds: string[]): Promise<Map<string, SharedCaseDate[]>> {
    const byOwner = new Map<string, SharedCaseDate[]>();
    const ids = [...new Set((ownerIds || []).filter(Boolean))];
    if (ids.length === 0) return byOwner;

    const { data, error } = await supabase
      .from("recovery_shared_dates")
      .select("*")
      .in("owner_id", ids)
      .order("on_date", { ascending: true });

    if (error || !data) {
      console.warn("[recoveryDates] Shared dates unavailable:", error?.message);
      return byOwner;
    }

    for (const row of data) {
      const shared = toShared(row);
      const list = byOwner.get(shared.ownerId) || [];
      list.push(shared);
      byOwner.set(shared.ownerId, list);
    }
    return byOwner;
  },

  /** The same read for one person. */
  async listForOwner(ownerId: string): Promise<SharedCaseDate[]> {
    const byOwner = await recoveryDates.listForOwners([ownerId]);
    return byOwner.get(ownerId) || [];
  },
};

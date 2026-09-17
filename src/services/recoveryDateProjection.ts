import type { CaseEvent } from "../types/index.js";
import type { RecoveryCaseBundle, SharedCaseDate, SharedDateKind } from "../types/recovery";

/**
 * What crosses from a survivor's own case file to their counsellor.
 *
 * WHY THIS IS ITS OWN FILE
 *
 * Everything here is pure. It imports no client, opens no connection and
 * reads no session, which means the rule "only dates are shared" can be
 * tested directly against the function that enforces it, with a bundle full
 * of FIR numbers and incident accounts handed straight to it. A module that
 * could also make a network call would be a module where a later edit could
 * quietly send one.
 *
 * `recoveryDates.ts` does the talking to the database and re-exports these,
 * so callers have one import and this file keeps one job.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 * There is no path from an FIR number, a police station, a caste
 * certificate, a medical report, an incident account or a person's private
 * note to anything returned by `projectSharedDates`. Two fields go in — a
 * kind and a date — because those are the only two the receiving table has
 * columns for.
 */

/** Rows as they are written. `sharedAt` is assigned by the database. */
export type SharedDateDraft = Omit<SharedCaseDate, "sharedAt">;

/**
 * Deterministic, so re-running a sync produces the same row rather than a
 * duplicate under a new random id. The unique constraint would catch a
 * duplicate anyway; this makes the intent legible.
 */
const draftId = (kind: SharedDateKind, caseId: string, onDate: string) =>
  `sd-${caseId}-${kind}-${onDate}`;

/** A plain YYYY-MM-DD date, or null when the input is not a usable date. */
export const toPlainDate = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T12:00:00`);
  return Number.isFinite(parsed.getTime()) ? trimmed : null;
};

/**
 * Builds the shareable rows for a case.
 *
 * Returns nothing at all when the person has not turned sharing on, so the
 * grant is checked here as well as by the row level security policy and the
 * revocation trigger. Three independent places have to agree before a date
 * becomes visible to staff.
 */
export function projectSharedDates(bundle: RecoveryCaseBundle): SharedDateDraft[] {
  if (!bundle?.case?.shareDatesWithCounsellor) return [];

  const ownerId = bundle.case.ownerId;
  const caseId = bundle.case.id;
  const seen = new Set<string>();
  const rows: SharedDateDraft[] = [];

  const push = (kind: SharedDateKind, raw?: string | null) => {
    const onDate = toPlainDate(raw);
    if (!onDate) return;
    const key = `${kind}|${onDate}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ id: draftId(kind, caseId, onDate), caseId, ownerId, kind, onDate });
  };

  for (const hearing of bundle.hearings || []) push("hearing", hearing.hearingOn);
  push("fir_filed", bundle.fir?.firDate);

  return rows.sort((a, b) => a.onDate.localeCompare(b.onDate));
}

/**
 * Turns shared dates into the case events the escalation engine already reads.
 *
 * `note` is never set. There is nothing to put in it — a shared row carries no
 * text — and leaving it undefined means the counsellor's timeline cannot
 * render something the person did not choose to send.
 */
export function sharedDatesToCaseEvents(
  shared: SharedCaseDate[],
  participantId: string
): CaseEvent[] {
  return (shared || [])
    .map((row) => {
      const onDate = toPlainDate(row?.onDate);
      if (!onDate) return null;
      return {
        id: `shared-${row.id}`,
        participantId,
        type: row.kind === "fir_filed" ? "fir_filed" : "hearing",
        // Midday, so a date does not drift across a day boundary by timezone —
        // the same convention CaseEventsCard uses when a counsellor types one.
        date: new Date(`${onDate}T12:00:00`).toISOString(),
        recordedBy: "Shared by the participant",
        recordedAt: row.sharedAt,
        source: "participant_shared",
      } as CaseEvent;
    })
    .filter((e): e is CaseEvent => e !== null);
}

/**
 * Merges what the counsellor recorded with what the person shared.
 *
 * Where both hold the same kind of event on the same day the counsellor's row
 * wins: it may carry a note that is useful to them, and dropping it in favour
 * of a bare shared row would lose information without gaining any. The
 * person's date is then redundant rather than missing.
 */
export function mergeCaseEvents(
  counsellorEvents: CaseEvent[],
  sharedEvents: CaseEvent[]
): CaseEvent[] {
  const dayKey = (e: CaseEvent) => {
    const d = new Date(e.date);
    return Number.isFinite(d.getTime()) ? `${e.type}|${d.toISOString().slice(0, 10)}` : null;
  };

  const taken = new Set<string>();
  const merged: CaseEvent[] = [];

  for (const e of counsellorEvents || []) {
    const key = dayKey(e);
    if (key) taken.add(key);
    merged.push(e);
  }

  for (const e of sharedEvents || []) {
    const key = dayKey(e);
    if (!key || taken.has(key)) continue;
    taken.add(key);
    merged.push(e);
  }

  return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

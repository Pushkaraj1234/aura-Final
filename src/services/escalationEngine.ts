import { CaseEvent, CheckIn, ConcordanceResult } from "../types";
import { EngagementAssessment, EngagementSignal } from "./engagementSignals";
import { calculateRawScore } from "./riskEngine";
import {
  CASE_EVENT_LABELS,
  describeTiming,
  hearingImminent,
  readCaseEvents,
} from "./caseEvents";

/**
 * Turns signals into a recommendation a counsellor can act on.
 *
 * The distinction this exists to draw: "this person seems stressed" is not
 * something anyone can act on, and it is not what a caseworker with thirty
 * people needs. "Contact within 24 hours, because they have gone quiet for
 * eleven days against a three-day rhythm and their last check-in said they
 * did not feel safe" is. So every result carries a window and the specific
 * facts behind it, and a counsellor can disagree with any of them.
 *
 * Three properties are load-bearing:
 *
 *   1. Every level is reachable only through stated evidence. There is no
 *      score here and no model — a recommendation nobody can interrogate is
 *      one nobody should follow.
 *   2. It never contacts anyone. It raises a recommendation to a human, who
 *      decides. Reaching out to a person under threat at the wrong moment can
 *      itself be the harm.
 *   3. Silence alone cannot reach the top level. Someone who stopped using a
 *      wellbeing app may simply be safe and busy, and a system that treats
 *      every quiet account as an emergency will train the people reading it
 *      to ignore all of them.
 */

export type EscalationLevel = "none" | "watch" | "contact" | "urgent";

export interface Escalation {
  level: EscalationLevel;
  /** The window the recommendation is framed in. Null when there is none. */
  withinHours: number | null;
  /** One line a counsellor reads first. */
  headline: string;
  /** The specific facts. Never empty above "none". */
  evidence: string[];
  /** Which readings contributed, for the counsellor to know where to look. */
  basis: Array<"safety" | "engagement" | "concordance" | "distress" | "case">;
  assessedAt: string;
}

/** A stated distress score at or above this is high on its own. */
const HIGH_DISTRESS = 65;

const WINDOW: Record<EscalationLevel, number | null> = {
  none: null,
  watch: 168,
  contact: 72,
  urgent: 24,
};

const RANK: Record<EscalationLevel, number> = { none: 0, watch: 1, contact: 2, urgent: 3 };

const raise = (current: EscalationLevel, next: EscalationLevel): EscalationLevel =>
  RANK[next] > RANK[current] ? next : current;

export function assessEscalation(input: {
  checkIns: CheckIn[];
  engagement: EngagementAssessment;
  /** The concordance reading for their most recent check-in, if any. */
  concordance?: ConcordanceResult | null;
  /** Hearings and incidents recorded by a counsellor. */
  caseEvents?: CaseEvent[];
  now?: number;
}): Escalation {
  const now = input.now ?? Date.now();
  const evidence: string[] = [];
  const basis = new Set<Escalation["basis"][number]>();
  const caseReading = readCaseEvents(input.caseEvents || [], now);
  let level: EscalationLevel = "none";

  const ordered = [...(input.checkIns || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const latest = ordered.length ? ordered[ordered.length - 1] : null;

  // --- Safety, which outranks everything else ----------------------------
  if (latest?.immediateSafetyConcern) {
    level = raise(level, "urgent");
    basis.add("safety");
    evidence.push("Their most recent check-in reported an immediate safety concern.");
  } else if (latest?.safety === "No") {
    level = raise(level, "urgent");
    basis.add("safety");
    evidence.push("They reported not feeling safe where they are living.");
  } else if (latest?.safety === "Unsure") {
    level = raise(level, "contact");
    basis.add("safety");
    evidence.push("They were unsure whether they feel safe where they are living.");
  }

  if (latest?.supportRequested) {
    level = raise(level, "contact");
    basis.add("safety");
    evidence.push("They asked to be contacted by a counsellor.");
  }

  // --- Stated distress ---------------------------------------------------
  const score = latest ? calculateRawScore(latest) : null;
  if (score !== null && score >= HIGH_DISTRESS) {
    level = raise(level, "contact");
    basis.add("distress");
    evidence.push(`Their last check-in scored ${score}/100 on the questionnaire.`);
  }

  // --- Engagement: the part that works when they have stopped answering --
  const serious = input.engagement.signals.filter((s) => s.severity === "serious");
  const notable = input.engagement.signals.filter((s) => s.severity === "notable");

  const describe = (s: EngagementSignal) => `${s.label}: ${s.reading}.`;
  serious.forEach((s) => {
    basis.add("engagement");
    evidence.push(describe(s));
  });
  notable.forEach((s) => {
    basis.add("engagement");
    evidence.push(describe(s));
  });

  if (serious.length >= 2) level = raise(level, "contact");
  else if (serious.length === 1) level = raise(level, "contact");
  else if (notable.length >= 2) level = raise(level, "watch");
  else if (notable.length === 1) level = raise(level, "watch");

  // --- The case itself ---------------------------------------------------
  // A hearing is the only stressor here that can be seen coming. Raising it
  // beforehand is the difference between preparing someone and debriefing
  // them, and it is the whole reason a date is worth recording.
  if (hearingImminent(caseReading) && caseReading.daysToNextHearing !== null) {
    basis.add("case");
    const days = caseReading.daysToNextHearing;
    evidence.push(
      `Court hearing ${describeTiming(days)}${
        caseReading.hearingCount > 1
          ? ` — their ${caseReading.hearingCount === 2 ? "second" : `${caseReading.hearingCount}th`} on record`
          : ""
      }.`
    );
    level = raise(level, days <= 2 ? "contact" : "watch");
  }

  if (caseReading.recentHearing && caseReading.daysSinceRecentHearing !== null) {
    basis.add("case");
    evidence.push(
      `Court hearing ${describeTiming(-caseReading.daysSinceRecentHearing)} — the days after one are when distress tends to surface.`
    );
    level = raise(level, "watch");
  }

  // Threats and intimidation happen between check-ins, which is precisely the
  // interval the questionnaire cannot see into.
  if (caseReading.recentIncidents.length > 0) {
    basis.add("case");
    caseReading.recentIncidents.slice(0, 3).forEach((e) => {
      const days = Math.round((now - new Date(e.date).getTime()) / 86_400_000);
      evidence.push(
        `${CASE_EVENT_LABELS[e.type]} recorded ${describeTiming(-days)}${
          e.note ? ` — ${e.note}` : ""
        }.`
      );
    });
    // One incident warrants contact. More than one inside a fortnight is a
    // pattern of pressure, not an isolated event.
    level = raise(level, caseReading.recentIncidents.length >= 2 ? "urgent" : "contact");
  }

  // --- Concordance: the self-report not matching everything else ---------
  if (input.concordance?.needsSecondLook) {
    basis.add("concordance");
    evidence.push(`Concordance: ${input.concordance.summary}`);
    level = raise(level, "watch");
  }

  // --- Combination is what earns the top level ---------------------------
  // A person who has gone quiet AND was already struggling when last heard
  // from is the case this whole system exists to catch. Silence on its own
  // is not, however long it runs.
  const wasStruggling =
    (score !== null && score >= HIGH_DISTRESS) ||
    latest?.safety === "No" ||
    latest?.safety === "Unsure" ||
    caseReading.recentIncidents.length > 0 ||
    !!input.concordance?.needsSecondLook;

  if (hearingImminent(caseReading) && wasStruggling) {
    level = raise(level, "urgent");
    evidence.push(
      "A hearing is imminent for someone whose last check-in already gave reason for concern."
    );
  }

  if (serious.length >= 1 && wasStruggling) {
    level = raise(level, "urgent");
    evidence.push(
      "They have gone quiet since a check-in that already gave reason for concern."
    );
  }

  const headline =
    level === "urgent"
      ? "Escalation detected — contact recommended within 24 hours"
      : level === "contact"
        ? "Contact recommended within 72 hours"
        : level === "watch"
          ? "Worth watching over the next week"
          : "Nothing here needs action right now";

  return {
    level,
    withinHours: WINDOW[level],
    headline,
    evidence,
    basis: Array.from(basis),
    assessedAt: new Date(now).toISOString(),
  };
}

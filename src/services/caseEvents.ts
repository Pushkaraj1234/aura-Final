import { CaseEvent, CaseEventType } from "../types/index.js";

/**
 * Hearings and incidents — the parts of someone's case that happen between
 * check-ins.
 *
 * The original problem names three stressors: threats, intimidation, and
 * repeated court appearances. Two of them are discrete events that occur in
 * exactly the gap where crises are said to go undetected. The third is
 * different in a way worth building around: a hearing date is *known in
 * advance*, so it is the one distress spike that can be anticipated rather
 * than discovered afterwards.
 *
 * Nothing here decides anything. It turns dates into readings that the
 * escalation engine weighs alongside everything else, and every reading is
 * phrased so a counsellor can check it against what they already know.
 */

const DAY_MS = 86_400_000;

export const CASE_EVENT_LABELS: Record<CaseEventType, string> = {
  hearing: "Court hearing",
  threat: "Threat received",
  intimidation: "Intimidation",
  police_contact: "Police contact",
  other: "Other case event",
};

/** Types that are incidents done to the person, rather than scheduled dates. */
const INCIDENT_TYPES: CaseEventType[] = ["threat", "intimidation", "police_contact"];

export const isIncident = (type: CaseEventType): boolean => INCIDENT_TYPES.includes(type);

/**
 * How long before a hearing the pressure is treated as already present.
 *
 * Anticipatory distress does not begin on the morning of the date, and a
 * counsellor who only hears about it afterwards has missed the point of
 * knowing the date at all.
 */
export const HEARING_LEAD_DAYS = 7;

/** How long after a hearing to keep watching for the aftermath. */
export const HEARING_TAIL_DAYS = 5;

/** Incidents this recent are treated as live rather than historical. */
export const INCIDENT_RECENT_DAYS = 14;

const timeOf = (e: CaseEvent): number => new Date(e.date).getTime();

const valid = (events: CaseEvent[]): CaseEvent[] =>
  (events || []).filter((e) => e && Number.isFinite(timeOf(e)));

/** Whole days from now until the event. Negative when it has passed. */
export function daysUntil(event: CaseEvent, now = Date.now()): number {
  return Math.round((timeOf(event) - now) / DAY_MS);
}

export interface CaseEventReading {
  /** The next hearing still ahead, if there is one. */
  nextHearing: CaseEvent | null;
  daysToNextHearing: number | null;
  /** A hearing in the last HEARING_TAIL_DAYS, if there was one. */
  recentHearing: CaseEvent | null;
  daysSinceRecentHearing: number | null;
  /** Incidents within INCIDENT_RECENT_DAYS, most recent first. */
  recentIncidents: CaseEvent[];
  /** Total hearings on record — "repeated court appearances", counted. */
  hearingCount: number;
}

export function readCaseEvents(events: CaseEvent[], now = Date.now()): CaseEventReading {
  const list = valid(events);

  const hearings = list
    .filter((e) => e.type === "hearing")
    .sort((a, b) => timeOf(a) - timeOf(b));

  const upcoming = hearings.filter((e) => timeOf(e) >= now);
  const past = hearings.filter((e) => timeOf(e) < now);

  const nextHearing = upcoming.length ? upcoming[0] : null;
  const lastPast = past.length ? past[past.length - 1] : null;
  const daysSinceLast = lastPast ? Math.round((now - timeOf(lastPast)) / DAY_MS) : null;

  const recentIncidents = list
    .filter((e) => isIncident(e.type))
    .filter((e) => {
      const age = (now - timeOf(e)) / DAY_MS;
      return age >= 0 && age <= INCIDENT_RECENT_DAYS;
    })
    .sort((a, b) => timeOf(b) - timeOf(a));

  return {
    nextHearing,
    daysToNextHearing: nextHearing ? daysUntil(nextHearing, now) : null,
    recentHearing:
      lastPast && daysSinceLast !== null && daysSinceLast <= HEARING_TAIL_DAYS ? lastPast : null,
    daysSinceRecentHearing:
      lastPast && daysSinceLast !== null && daysSinceLast <= HEARING_TAIL_DAYS
        ? daysSinceLast
        : null,
    recentIncidents,
    hearingCount: hearings.length,
  };
}

/** A hearing close enough that the pressure is already on. */
export function hearingImminent(reading: CaseEventReading): boolean {
  return (
    reading.daysToNextHearing !== null &&
    reading.daysToNextHearing >= 0 &&
    reading.daysToNextHearing <= HEARING_LEAD_DAYS
  );
}

export const newCaseEventId = (): string =>
  `ce-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Phrases a date the way a counsellor would say it. */
export function describeTiming(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

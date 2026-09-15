import { Alert } from "../types";

/**
 * How long an alert is allowed to sit before somebody has answered it.
 *
 * FEATURE_AUDIT recorded "no response-time metric", and that was the whole of
 * it: an alert could be raised and never looked at, and nothing in the system
 * could tell you. A tool whose entire purpose is to bring a person to a human's
 * attention, with no way of knowing whether that ever happened, is measuring
 * its own input and calling it an outcome.
 *
 * Three bands, by severity:
 *
 *   urgent  (RED)     1 hour   - somebody is expected to look today, now
 *   contact (ORANGE)  24 hours - somebody reaches out within the day
 *   watch   (YELLOW)  7 days   - kept in view, not chased
 *
 * Two clocks, not one, because "seen" and "acted on" are different promises
 * and collapsing them lets a team acknowledge its way to a clean dashboard:
 *
 *   acknowledgedAt     - a human opened this and took it on
 *   contactAttemptedAt - a human actually tried to reach the person
 *
 * A breach is measured against acknowledgement, because that is the promise
 * the team controls. Whether someone picks up the phone is not something a
 * counsellor can guarantee inside an hour; whether they have looked at the
 * alert is.
 */

export type SlaBand = "urgent" | "contact" | "watch";

export interface SlaTarget {
  band: SlaBand;
  label: string;
  minutes: number;
}

export const SLA_TARGETS: Record<SlaBand, SlaTarget> = {
  urgent: { band: "urgent", label: "Within 1 hour", minutes: 60 },
  contact: { band: "contact", label: "Within 24 hours", minutes: 60 * 24 },
  watch: { band: "watch", label: "Within 7 days", minutes: 60 * 24 * 7 },
};

/**
 * Severity to band.
 *
 * Anything unrecognised is treated as `contact` rather than `watch`. An
 * unknown severity is a bug, and the safe direction for a bug in a system that
 * escalates distress is a tighter clock, not a looser one.
 */
export function bandFor(severity: string | undefined | null): SlaBand {
  switch ((severity || "").toUpperCase()) {
    case "RED":
      return "urgent";
    case "YELLOW":
      return "watch";
    case "ORANGE":
      return "contact";
    default:
      return "contact";
  }
}

export type SlaState = "met" | "pending" | "breached" | "closed";

export interface SlaStatus {
  band: SlaBand;
  target: SlaTarget;
  dueAt: string;
  state: SlaState;
  /** Minutes remaining until due. Negative once overdue. */
  minutesRemaining: number;
  /** Minutes from raising to acknowledgement, once that has happened. */
  minutesToAcknowledge: number | null;
  /** Whether anyone has actually tried to reach the person. */
  contactAttempted: boolean;
}

const MINUTE = 60 * 1000;

const parse = (iso: string | undefined | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/**
 * Where one alert stands against its clock.
 *
 * `closed` covers alerts resolved without an explicit acknowledgement, which
 * the older rows in this database contain. They are not counted as breaches:
 * marking historical data as failures of a policy that did not exist when it
 * was written would inflate the breach rate and teach nobody anything.
 */
export function slaStatus(alert: Alert, now: number = Date.now()): SlaStatus {
  const band = bandFor(alert.severity);
  const target = SLA_TARGETS[band];

  const raisedAt = parse(alert.createdAt) ?? now;
  const dueAtMs = raisedAt + target.minutes * MINUTE;
  const acknowledgedAt = parse(alert.acknowledgedAt);
  const contactAttempted = parse(alert.contactAttemptedAt) !== null;

  const common = {
    band,
    target,
    dueAt: new Date(dueAtMs).toISOString(),
    minutesRemaining: Math.round((dueAtMs - now) / MINUTE),
    contactAttempted,
  };

  if (acknowledgedAt !== null) {
    const minutesToAcknowledge = Math.round((acknowledgedAt - raisedAt) / MINUTE);
    return {
      ...common,
      state: acknowledgedAt <= dueAtMs ? "met" : "breached",
      minutesToAcknowledge,
    };
  }

  const status = (alert.status || "").toUpperCase();
  if (status === "RESOLVED" || status === "DISMISSED") {
    return { ...common, state: "closed", minutesToAcknowledge: null };
  }

  return {
    ...common,
    state: now > dueAtMs ? "breached" : "pending",
    minutesToAcknowledge: null,
  };
}

export interface SlaSummary {
  total: number;
  met: number;
  pending: number;
  breached: number;
  closed: number;
  /** Of alerts with a clock that finished, the share answered in time, 0-100. */
  metRate: number | null;
  /** Median minutes from raised to acknowledged, among those acknowledged. */
  medianMinutesToAcknowledge: number | null;
  /** Still open and past due. What a breach view shows. */
  breachedAlerts: Alert[];
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/**
 * The response-time metric the audit said did not exist.
 *
 * `metRate` deliberately excludes `closed` and `pending`. Closed-without-
 * acknowledgement cannot be judged, and pending has not finished yet; counting
 * either would let a team improve the number by leaving alerts open or by
 * resolving them without looking.
 */
export function summariseSla(alerts: Alert[], now: number = Date.now()): SlaSummary {
  let met = 0, pending = 0, breached = 0, closed = 0;
  const ackTimes: number[] = [];
  const breachedAlerts: Alert[] = [];

  for (const alert of alerts) {
    const status = slaStatus(alert, now);
    if (status.minutesToAcknowledge !== null) ackTimes.push(status.minutesToAcknowledge);

    switch (status.state) {
      case "met":
        met++;
        break;
      case "pending":
        pending++;
        break;
      case "closed":
        closed++;
        break;
      case "breached":
        breached++;
        breachedAlerts.push(alert);
        break;
    }
  }

  const judged = met + breached;
  return {
    total: alerts.length,
    met,
    pending,
    breached,
    closed,
    metRate: judged === 0 ? null : Math.round((met / judged) * 100),
    medianMinutesToAcknowledge: median(ackTimes),
    // Longest overdue first: the breach view exists to be worked down.
    breachedAlerts: breachedAlerts.sort(
      (a, b) => slaStatus(a, now).minutesRemaining - slaStatus(b, now).minutesRemaining
    ),
  };
}

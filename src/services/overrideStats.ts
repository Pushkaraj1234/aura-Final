import { Alert } from "../types";
import { MIN_GROUP_SIZE } from "./communityAggregates";

/**
 * How often a human disagreed with the system, computed from what humans
 * actually decided.
 *
 * WHAT THIS REPLACED
 *
 * The Community Insights page carried a panel headed "Model-Agreement &
 * Override Tracking" asserting that "caseworkers overrode the AI's risk score
 * in 4.2% of flagged check-ins this month (down from 5.3% last month)", that
 * this "low rate indicates high baseline clinical trust", that overrides split
 * 78/22 between false positives and false negatives, and that the thresholds
 * in alertConfig.ts "have been naturally recalibrating based on these override
 * logs to reduce alarm fatigue".
 *
 * None of it was measured. The last claim was worse than unmeasured: AURA has
 * no mechanism that recalibrates thresholds from override history. Those
 * values move when an administrator changes them in the settings panel, and
 * nowhere else. The page was describing a product that does not exist, in the
 * one place a reviewer would look for evidence that clinicians trust the
 * model.
 *
 * WHAT COUNTS AS AN OVERRIDE
 *
 * The system raised an alert; a human then recorded a decision on it. Choosing
 * to schedule a follow-up or dispatch help is agreement that the alert was
 * worth raising. Resolving it outright, or returning it to routine monitoring,
 * is a judgement that it was not. That is the only disagreement signal this
 * database holds, and reading it as such is a stretch a reader should be told
 * about rather than have hidden behind a percentage, so the UI says so.
 *
 * WHAT IT REFUSES TO SAY
 *
 * A rate over fewer than MIN_GROUP_SIZE decisions is withheld. There is no
 * month-on-month comparison, because that needs two months of decisions and
 * this database does not have one month. And there is no claim anywhere that a
 * low override rate means clinicians trust the model: it can equally mean
 * nobody is reviewing the alerts, and a dashboard cannot tell the difference.
 */

export type OverrideDirection = "agreed" | "stood_down";

/** Decisions that accept the alert as worth raising. */
const AGREEMENT: ReadonlySet<string> = new Set([
  "follow_up_scheduled",
  "emergency_dispatched",
]);

/** Decisions that judge it was not. */
const STAND_DOWN: ReadonlySet<string> = new Set([
  "resolved",
  "continue_monitoring",
]);

export interface OverrideStats {
  /** Alerts a human has recorded any decision on. The denominator. */
  decided: number;
  /** Alerts raised, decided or not. Context for how much is still unreviewed. */
  raised: number;
  agreed: number;
  stoodDown: number;
  /**
   * stoodDown / decided as a percentage, or null when there is too little to
   * divide. Null is not zero and must never render as zero.
   */
  overrideRate: number | null;
  /** Decisions that matched neither set, counted rather than silently dropped. */
  unclassified: number;
  suppressed: boolean;
}

export function computeOverrideStats(alerts: Alert[]): OverrideStats {
  const raised = alerts.length;
  let agreed = 0;
  let stoodDown = 0;
  let unclassified = 0;

  for (const alert of alerts) {
    const decision = (alert.humanDecision || "").trim();
    if (!decision) continue;
    if (AGREEMENT.has(decision)) agreed++;
    else if (STAND_DOWN.has(decision)) stoodDown++;
    else unclassified++;
  }

  const decided = agreed + stoodDown + unclassified;
  const classified = agreed + stoodDown;

  // Suppressed on the classified count, not the decided count: a rate whose
  // denominator is padded with decisions this module could not read would be
  // wrong in a way nobody could see.
  if (classified < MIN_GROUP_SIZE) {
    return {
      decided,
      raised,
      agreed: 0,
      stoodDown: 0,
      overrideRate: null,
      unclassified,
      suppressed: true,
    };
  }

  return {
    decided,
    raised,
    agreed,
    stoodDown,
    overrideRate: Math.round((stoodDown / classified) * 1000) / 10,
    unclassified,
    suppressed: false,
  };
}

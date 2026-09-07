/**
 * AURA Alert Engine Configuration
 * 
 * IMPORTANT:
 * Prototype thresholds only; not clinically validated.
 * These parameters govern the AI-assisted decision-support engine
 * for detecting change, classifying signals, and routing to human review.
 */

export const ALERT_CONFIG = {
  // Score Semantics (0 = lower reported distress, 100 = higher reported distress)
  LOW_DISTRESS_MAX: 15,    // 0-15: Low / Calmer reported distress
  MONITORING_MAX: 40,      // 16-40: Mild / Monitoring
  MILD_MAX: 40,            // 16-40: Mild
  MODERATE_MAX: 60,        // 41-60: Moderate
  ELEVATED_MAX: 74,        // 61-74: Elevated
  ALERT_THRESHOLD: 75,     // >= 75: Critical Alert Threshold (Priority Human Review)
  HIGH_MAX: 85,            // 75-85: High (Priority human review recommended)
  VERY_HIGH_THRESHOLD: 86, // >= 86: High-priority wellbeing signal
  VERY_HIGH_MAX: 100,      // 86-100: Very High (Priority human review)

  // Trajectory & Dynamic Change Detection
  SUDDEN_CHANGE_THRESHOLD: 15,       // Rapid upward jump between consecutive check-ins (e.g. +15 pts)
  PERSISTENT_INCREASE_COUNT: 3,      // Number of consecutive increases to flag persistent worsening
  PERSISTENT_ELEVATED_COUNT: 2,      // Number of consecutive check-ins > 40 to flag persistent elevation
  RECOVERY_DROP_THRESHOLD: 15,       // Meaningful reduction in distress after recorded support (e.g. -15 pts)
  IMPROVEMENT_DROP_THRESHOLD: 10,    // General meaningful downward improvement (e.g. -10 pts)

  // Deduplication & Grouping Window (Hours)
  DEDUPLICATION_WINDOW_HOURS: 24,

  // Non-clinical prototype disclaimer string
  DISCLAIMER: "AURA alerts are AI-assisted wellbeing signals based on voluntary participant data. They are not diagnoses. Important decisions require human review.",
  THRESHOLD_DISCLAIMER: "Prototype thresholds are demonstration rules and are not clinically validated."
};

// Immutable copy of the shipped defaults — used to show "modified vs default"
// in the admin UI and to support a reset.
export const ALERT_CONFIG_DEFAULTS = Object.freeze({ ...ALERT_CONFIG });

// The keys an administrator is allowed to tune from the admin panel. Kept in
// sync with ALERT_THRESHOLD_KEYS in server/adminRouter.ts.
export const TUNABLE_ALERT_KEYS = [
  "MONITORING_MAX",
  "MODERATE_MAX",
  "ELEVATED_MAX",
  "ALERT_THRESHOLD",
  "HIGH_MAX",
  "VERY_HIGH_THRESHOLD",
  "SUDDEN_CHANGE_THRESHOLD",
  "PERSISTENT_INCREASE_COUNT",
  "PERSISTENT_ELEVATED_COUNT",
  "RECOVERY_DROP_THRESHOLD",
  "IMPROVEMENT_DROP_THRESHOLD",
] as const;

export type TunableAlertKey = (typeof TUNABLE_ALERT_KEYS)[number];

/**
 * Merge admin-configured overrides into the live ALERT_CONFIG object in place.
 * Every consumer reads `ALERT_CONFIG.SOME_KEY` at call time and holds a
 * reference to this same object, so mutating it here propagates everywhere
 * without a rebuild. Only allowlisted, in-range numbers are applied.
 */
export function applyAlertThresholdOverrides(overrides: Partial<Record<TunableAlertKey, number>>): void {
  if (!overrides || typeof overrides !== "object") return;
  for (const key of TUNABLE_ALERT_KEYS) {
    const v = Number(overrides[key]);
    if (Number.isFinite(v) && v >= 0 && v <= 100) {
      (ALERT_CONFIG as Record<string, number | string>)[key] = Math.round(v);
    }
  }
}

let overridesLoaded = false;

/**
 * Fetch admin-configured alert thresholds from the server (public config
 * endpoint) and apply them. Safe to call more than once; best-effort — a
 * failure leaves the shipped defaults in place.
 */
export async function loadAlertThresholdOverrides(): Promise<void> {
  if (overridesLoaded) return;
  overridesLoaded = true;
  try {
    const res = await fetch("/api/admin/config/alert-thresholds");
    if (!res.ok) return;
    const body = await res.json();
    applyAlertThresholdOverrides(body?.thresholds || {});
  } catch {
    /* keep defaults */
  }
}

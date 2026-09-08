import { CheckIn, ConcordanceResult, ConcordanceSignal, SomaticSymptom } from "../types";
import { calculateRawScore } from "./riskEngine";
import { AI_SCORE_ADJUSTMENT_LIMIT } from "./recommendationEngine";

/**
 * Concordance — how much of the rest of the check-in agrees with what the
 * person said about themselves.
 *
 * The distress score answers "how bad do they say it is". That question is
 * useless for anyone who cannot or will not say. This answers a different
 * one: "does everything else we have match that answer?" — and it fires on
 * disagreement regardless of how low the distress score is, which is the
 * only way the quiet cases ever reach a human.
 *
 * Two rules hold this honest, and both are load-bearing:
 *
 *   1. It never overwrites the self-report. The stated score stays exactly
 *      as given; this sits beside it as a separate reading.
 *   2. It is a prompt for a support worker to look again, never a verdict
 *      about the participant and never shown to them as one. Nobody is told
 *      their answers look dishonest — most people here are not concealing
 *      anything, they are numb, frightened, or describing distress through
 *      their body instead of their mood.
 *
 * Deliberately rule-based rather than learned: every signal below can be
 * read, argued with and overruled by the worker, which is the standard the
 * rest of this system already holds itself to.
 */

/** Stated wellbeing at or above this reads as "I'm doing alright". */
const CLAIMS_FINE = 4;

/** Below this, the person is already telling us things are hard. */
const CLAIMS_STRUGGLING = 2;

const clampAgreement = (checkIn: CheckIn): "fine" | "struggling" | "middling" => {
  if (checkIn.wellbeing >= CLAIMS_FINE) return "fine";
  if (checkIn.wellbeing <= CLAIMS_STRUGGLING) return "struggling";
  return "middling";
};

const SOMATIC_LABELS: Record<SomaticSymptom, string> = {
  headaches: "headaches",
  appetite_change: "appetite change",
  unexplained_pain: "unexplained pain",
  palpitations: "racing heart",
  exhaustion: "exhaustion",
  none_reported: "none reported",
};

/**
 * Median gap in days between a person's own recent check-ins. Cadence is only
 * meaningful against their established rhythm — someone who has always been
 * sporadic is not withdrawing, and treating them as though they were would
 * bury the person who genuinely stopped.
 */
function medianGapDays(history: CheckIn[]): number | null {
  const times = history
    .map((c) => new Date(c.timestamp).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 4) return null;

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push((times[i] - times[i - 1]) / 86_400_000);
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

/**
 * @param checkIn  the submission being assessed
 * @param history  that participant's earlier check-ins, most recent last;
 *                 used only for their own cadence baseline
 */
export function assessConcordance(checkIn: CheckIn, history: CheckIn[] = []): ConcordanceResult {
  const claim = clampAgreement(checkIn);
  const signals: ConcordanceSignal[] = [];

  const add = (
    key: string,
    label: string,
    reading: string,
    verdict: ConcordanceSignal["verdict"],
    note?: string,
    strong = false
  ) => signals.push({ key, label, reading, verdict, note, strong });

  const fn = checkIn.functional;

  // --- Behavioural: function, not feeling -------------------------------
  if (fn?.sleepHours !== undefined) {
    const hrs = fn.sleepHours;
    if (hrs <= 4 && claim !== "struggling") {
      add("sleepHours", "Hours slept", `${hrs} hrs`, "contradicts",
        "Severely short sleep alongside a self-report that isn't low.");
    } else if (hrs <= 4) {
      add("sleepHours", "Hours slept", `${hrs} hrs`, "supports");
    } else {
      add("sleepHours", "Hours slept", `${hrs} hrs`, claim === "fine" ? "supports" : "neutral");
    }
  }

  if (fn?.mealsYesterday !== undefined) {
    const meals = fn.mealsYesterday;
    if (meals <= 1 && claim !== "struggling") {
      add("mealsYesterday", "Meals yesterday", `${meals}`, "contradicts",
        "Barely eating is a functional signal that rarely accompanies feeling well.");
    } else if (meals <= 1) {
      add("mealsYesterday", "Meals yesterday", `${meals}`, "supports");
    } else {
      add("mealsYesterday", "Meals yesterday", `${meals}`, claim === "fine" ? "supports" : "neutral");
    }
  }

  // Withdrawal counts only when both are true — staying in for one day is
  // ordinary; not leaving and speaking to nobody together is not.
  if (fn?.leftHome !== undefined && fn?.spokeToAnyone !== undefined) {
    const withdrawn = fn.leftHome === false && fn.spokeToAnyone === false;
    const reading = withdrawn ? "stayed in, spoke to nobody" : "left home or spoke to someone";
    if (withdrawn && claim !== "struggling") {
      add("withdrawal", "Contact with the world", reading, "contradicts",
        "Complete withdrawal reported alongside a self-report that isn't low.");
    } else {
      add("withdrawal", "Contact with the world", reading, withdrawn ? "supports" : "neutral");
    }
  }

  // --- Somatic: distress voiced through the body ------------------------
  const somatic = (fn?.somaticSymptoms || []).filter((s) => s !== "none_reported");
  if (fn?.somaticSymptoms?.length) {
    const reading = somatic.length
      ? somatic.map((s) => SOMATIC_LABELS[s]).join(", ")
      : "none reported";
    if (somatic.length >= 2 && claim !== "struggling") {
      add("somatic", "Physical symptoms", reading, "contradicts",
        "Several bodily symptoms reported by someone whose mood rating is not low — a very common way distress presents.");
    } else if (somatic.length >= 2) {
      add("somatic", "Physical symptoms", reading, "supports");
    } else {
      add("somatic", "Physical symptoms", reading, "neutral");
    }
  }

  // --- Voice: measured delivery, not words ------------------------------
  const voiceTone = checkIn.reflection?.voiceToneAnalysis;
  const acoustic = voiceTone?.acousticFeatures;

  // The voice-tone model already reports whether the words and the delivery
  // agree. A "mismatched" verdict is precisely this feature's subject —
  // someone saying they are fine in a voice that says otherwise — so it is
  // read straight through rather than re-derived.
  if (voiceTone?.contentVsDeliveryAlignment === "mismatched") {
    add("voiceAlignment", "Words vs. delivery", "mismatched", "contradicts",
      voiceTone.toneRationale || "What was said and how it was said do not line up.");
  } else if (voiceTone?.contentVsDeliveryAlignment === "aligned") {
    add("voiceAlignment", "Words vs. delivery", "aligned", "neutral");
  }

  if (acoustic) {
    if (acoustic.pitchVariabilityScore < 0.15) {
      add("voicePitch", "Voice: pitch range", `${acoustic.pitchVariabilityScore.toFixed(2)} — flat`,
        claim === "fine" ? "contradicts" : "supports",
        "Flat delivery is consistent with emotional blunting.");
    } else {
      add("voicePitch", "Voice: pitch range", `${acoustic.pitchVariabilityScore.toFixed(2)}`, "neutral");
    }

    if (acoustic.pauseRatio > 0.35) {
      add("voicePause", "Voice: pausing", `${acoustic.pauseRatio.toFixed(2)} — long pauses`,
        claim === "fine" ? "contradicts" : "supports");
    } else {
      add("voicePause", "Voice: pausing", `${acoustic.pauseRatio.toFixed(2)}`, "neutral");
    }
  }

  // --- Language in the written or spoken reflection ----------------------
  const sentiment = checkIn.reflection?.analysis?.sentiment;
  if (sentiment && sentiment !== "none") {
    const heavy = sentiment === "stressed" || sentiment === "overwhelmed" || sentiment === "safety_concern";
    add("reflection", "Reflection language", sentiment.replace(/_/g, " "),
      heavy && claim === "fine" ? "contradicts" : heavy ? "supports" : "neutral");
  }

  // --- The AI's own reading vs. the questionnaire ------------------------
  // The model is allowed to move the score by a bounded amount. When it wants
  // more room than that, the score is held at the limit — and the size of the
  // disagreement, which is the clinically interesting part, used to be
  // discarded. A model reading the reflection as much worse than the ratings
  // admit is the same phenomenon this whole engine is for, so it is recorded
  // as a signal instead of being clamped away in silence.
  const aiReading = Number(checkIn.aiComprehensiveAnalysis?.distressScore);
  if (Number.isFinite(aiReading)) {
    const gap = Math.round(aiReading) - calculateRawScore(checkIn);
    if (gap > AI_SCORE_ADJUSTMENT_LIMIT) {
      // Stands alone past twice the limit. A disagreement that wide is either
      // the model catching something in the text the ratings do not admit, or
      // the model misfiring — both are worth a human glance, and someone who
      // only wrote a reflection produces no behavioural answers to corroborate
      // it with, so requiring corroboration would mean it never fires.
      const standsAlone = gap > AI_SCORE_ADJUSTMENT_LIMIT * 2;
      add("aiGap", "AI reading of the reflection", `${gap} points above the questionnaire`,
        claim === "struggling" ? "supports" : "contradicts",
        "What was written or spoken reads as considerably more distressing than the ratings given.",
        standsAlone && claim !== "struggling");
    } else if (gap < -AI_SCORE_ADJUSTMENT_LIMIT) {
      // The mirror case. Not treated as hidden distress — someone whose words
      // read calmer than their ratings is not the person this queue is for.
      add("aiGap", "AI reading of the reflection", `${Math.abs(gap)} points below the questionnaire`, "neutral");
    }
  }

  // --- Cadence: withdrawal from the check-in itself ----------------------
  const baseline = medianGapDays(history);
  if (baseline !== null && history.length) {
    const last = history[history.length - 1];
    const gap = (new Date(checkIn.timestamp).getTime() - new Date(last.timestamp).getTime()) / 86_400_000;
    if (Number.isFinite(gap) && gap > Math.max(baseline * 3, baseline + 3)) {
      // Marked strong: withdrawal from the check-in itself is the one case
      // that produces no other signals by definition — the person is not
      // there to produce them. Requiring corroboration would guarantee that
      // whoever goes quiet is exactly whoever never gets looked at.
      add("cadence", "Check-in rhythm",
        `${gap.toFixed(0)}d gap vs their usual ${baseline.toFixed(0)}d`,
        "contradicts",
        "A long silence against this person's own established rhythm.",
        true);
    } else {
      add("cadence", "Check-in rhythm", `${gap.toFixed(0)}d gap`, "neutral");
    }
  }

  // --- Confidence caveats: reasons to trust the whole submission less ----
  const caveats: string[] = [];

  if (checkIn.responseMeta?.privateSpace === false) {
    caveats.push("Answered somewhere they could not speak freely.");
  }

  // Straight-lining: every scale answer identical AND submitted implausibly
  // fast. Either alone is unremarkable; together they say the form was
  // cleared rather than answered.
  const scaleAnswers = [checkIn.wellbeing, checkIn.sleep, checkIn.connection];
  const allSame = scaleAnswers.every((v) => v === scaleAnswers[0]);
  const secs = checkIn.responseMeta?.completionSeconds;
  if (allSame && secs !== undefined && secs < 25) {
    caveats.push(`Identical answers submitted in ${secs}s — may not reflect a considered response.`);
  }

  const contradicting = signals.filter((s) => s.verdict === "contradicts").length;
  const supporting = signals.filter((s) => s.verdict === "supports").length;
  const informative = contradicting + supporting;
  const hasStrong = signals.some((s) => s.verdict === "contradicts" && s.strong);

  let level: ConcordanceResult["level"];
  if (contradicting >= 3) level = "diverging";
  else if (hasStrong) level = "diverging";
  else if (informative < 2) level = "insufficient";
  else if (contradicting === 0) level = "aligned";
  else level = "partial";

  // The whole point of the feature: someone who says they are fine while
  // several other signals disagree is exactly the person the distress score
  // would never surface, so this must not be gated on that score being high.
  const needsSecondLook =
    hasStrong ||
    (claim === "fine" && contradicting >= 2) ||
    contradicting >= 3 ||
    caveats.length > 0;

  let summary: string;
  if (level === "insufficient" && caveats.length) {
    summary = "Too little to judge how well the self-report fits, and there is reason to trust this submission less than usual.";
  } else if (level === "insufficient") {
    summary = "Not enough signals this time to judge how well the self-report fits.";
  } else if (hasStrong && contradicting === 1) {
    summary = "They have gone quiet against their own usual rhythm.";
  } else if (level === "aligned") {
    summary = "Everything else recorded is consistent with what they reported.";
  } else if (claim === "fine") {
    summary = `Reported doing well, but ${contradicting} other signal${contradicting === 1 ? "" : "s"} point the other way.`;
  } else {
    summary = `${contradicting} signal${contradicting === 1 ? "" : "s"} sit worse than the self-report.`;
  }

  return {
    claim,
    signals,
    contradicting,
    supporting,
    level,
    needsSecondLook,
    caveats,
    summary,
    assessedAt: new Date().toISOString(),
  };
}

/**
 * The most recent check-in for a participant, assessed against everything
 * before it. Returns null when they have never checked in.
 */
export function assessLatest(checkIns: CheckIn[]): ConcordanceResult | null {
  if (!checkIns.length) return null;
  const ordered = [...checkIns].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const latest = ordered[ordered.length - 1];
  return assessConcordance(latest, ordered.slice(0, -1));
}

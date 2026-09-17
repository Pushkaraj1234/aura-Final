import {
  CheckIn,
  CheckInAnalysis,
  DistressLevel,
  Recommendation,
  RecommendationCategory
} from "../types";
import { ALERT_CONFIG } from "./alertConfig";
import { calculateRawScore } from "./riskEngine";
import { getActionGuide } from "./actionGuides";

/**
 * AURA Recommendation and Supportive Reflection Engine
 * 
 * IMPORTANT:
 * AURA is a non-diagnostic, decision-support prototype.
 * It provides non-clinical wellbeing summaries and compassionate guidance.
 * It does NOT replace medical or psychiatric evaluation.
 */

/**
 * Classifies numerical score into standard prototype distress level
 */
/**
 * How far the language model may move the rule-based distress score, in
 * points. It exists so the model can weigh what the five questions cannot see
 * — usually the reflection transcript — without being able to overwrite a
 * number the participant is shown a full derivation for. Safety escalation is
 * deliberately not routed through this and is not capped.
 */
export const AI_SCORE_ADJUSTMENT_LIMIT = 15;

/**
 * How much someone has to have actually written or said before the model is
 * allowed to move their score at all, and how much it has to be before it can
 * use the full limit.
 *
 * The model only ever reads the questionnaire answers plus whatever free text
 * the person wrote. The questionnaire is already scored, in full, by the
 * transparent formula — so anything the model adds on top has to come from the
 * free text, and it cannot be worth more than that text can support. A
 * sentence moving the score by a sixth of the whole scale is not a reading of
 * that sentence, it is the cap being spent on almost nothing.
 *
 * Below the floor the adjustment is zero: there is nothing to review. Between
 * the floor and the full-weight length the cap grows with what was actually
 * said, and the breakdown shows the person both numbers so the limit on their
 * own score is something they can check rather than take on trust.
 */
export const AI_EVIDENCE_FLOOR_CHARS = 40;
export const AI_EVIDENCE_FULL_WEIGHT_CHARS = 400;

/** The most the model may move a score, given the text it had to go on. */
export function aiAdjustmentCapFor(evidenceChars: number): number {
  if (!Number.isFinite(evidenceChars) || evidenceChars < AI_EVIDENCE_FLOOR_CHARS) return 0;
  const share = Math.min(1, evidenceChars / AI_EVIDENCE_FULL_WEIGHT_CHARS);
  return Math.round(AI_SCORE_ADJUSTMENT_LIMIT * share);
}

export function getDistressLevel(score: number): { level: DistressLevel; label: string } {
  if (score <= ALERT_CONFIG.LOW_DISTRESS_MAX) {
    return { level: "LOW", label: "Calmer Reported Distress" };
  } else if (score <= ALERT_CONFIG.MILD_MAX) {
    return { level: "MILD", label: "Mild / Monitoring" };
  } else if (score <= ALERT_CONFIG.MODERATE_MAX) {
    return { level: "MODERATE", label: "Moderate Reported Distress" };
  } else if (score <= ALERT_CONFIG.ELEVATED_MAX) {
    return { level: "ELEVATED", label: "Elevated Reported Distress" };
  } else if (score <= ALERT_CONFIG.HIGH_MAX) {
    return { level: "HIGH", label: "High Reported Distress" };
  } else {
    return { level: "VERY_HIGH", label: "High-Priority Wellbeing Signal" };
  }
}

/**
 * The rule behind each percentage bar, with the participant's own rating
 * substituted, so the results screen can show its working next to the bar
 * instead of asserting a number. Each factor is mapped into its own band —
 * the bands differ per factor, which is exactly why a bar reading 55% is not
 * 55 points of the distress score and cannot be read as one.
 *
 * Kept beside calculateFactorPercentages so the two are edited together; the
 * expressions below restate that function's arithmetic term for term.
 */
export function explainFactorPercentages(checkIn: CheckIn): Record<string, string> {
  return {
    stress: `15 + ((${checkIn.stress} − 1) ÷ 4) × 80`,
    sleep: `10 + ((5 − ${checkIn.sleep}) ÷ 4) × 80`,
    emotionalWellbeing: `10 + ((5 − ${checkIn.wellbeing}) ÷ 4) × 75`,
    socialConnection: `10 + ((5 − ${checkIn.connection}) ÷ 4) × 70`,
  };
}

/**
 * Calculates factor percentage representations for visual breakdown (Response Patterns)
 */
export function calculateFactorPercentages(checkIn: CheckIn) {
  // Stress: 1 (calm) -> 15%, 5 (very stressed) -> 95%
  const stressPct = Math.round(15 + ((checkIn.stress - 1) / 4) * 80);

  // Sleep concern: 5 (good) -> 10%, 1 (very difficult) -> 90%
  const sleepPct = Math.round(10 + ((5 - checkIn.sleep) / 4) * 80);

  // Emotional wellbeing concern: 5 (good) -> 10%, 1 (very difficult) -> 85%
  const wellbeingPct = Math.round(10 + ((5 - checkIn.wellbeing) / 4) * 75);

  // Social isolation concern: 5 (connected) -> 10%, 1 (isolated) -> 80%
  const socialPct = Math.round(10 + ((5 - checkIn.connection) / 4) * 70);

  // Functioning / strain proxy
  const functioningPct = Math.round((stressPct * 0.4 + wellbeingPct * 0.4 + sleepPct * 0.2));

  return {
    stress: Math.min(100, Math.max(10, stressPct)),
    sleep: Math.min(100, Math.max(10, sleepPct)),
    emotionalWellbeing: Math.min(100, Math.max(10, wellbeingPct)),
    socialConnection: Math.min(100, Math.max(10, socialPct)),
    functioning: Math.min(100, Math.max(10, functioningPct))
  };
}

/**
 * Generates explainable, understandable factors that contributed to the score
 */
export function generateContributingFactors(checkIn: CheckIn): { factors: string[]; explanationPoints: string[] } {
  const factors: string[] = [];
  const explanationPoints: string[] = [];

  // Perceived Safety
  if (checkIn.immediateSafetyConcern) {
    factors.push("Immediate safety alert recorded");
    explanationPoints.push("You indicated an immediate safety concern in your responses.");
  } else if (checkIn.safety === "No") {
    factors.push("Reported unsafe environment");
    explanationPoints.push("You reported not feeling safe in your current surroundings.");
  } else if (checkIn.safety === "Unsure") {
    factors.push("Safety uncertainty reported");
    explanationPoints.push("You expressed uncertainty regarding physical or emotional security.");
  }

  // Stress
  if (checkIn.stress >= 4) {
    factors.push("Elevated stress & overwhelm");
    explanationPoints.push("You reported high day-to-day stress or feeling overwhelmed.");
  } else if (checkIn.stress === 3) {
    factors.push("Moderate stress");
  }

  // Sleep
  if (checkIn.sleep <= 2) {
    factors.push("Disrupted sleep & rest");
    explanationPoints.push("You indicated restless or interrupted sleep recently.");
  }

  // Emotional Wellbeing
  if (checkIn.wellbeing <= 2) {
    factors.push("Challenging emotional state");
    explanationPoints.push("You noted a particularly difficult emotional or mental state today.");
  }

  // Social Connection
  if (checkIn.connection <= 2) {
    factors.push("Feelings of isolation");
    explanationPoints.push("You reported feeling mostly alone or lacking trusted connection.");
  }

  // Explicit Support Request
  if (checkIn.supportRequested) {
    factors.push("Voluntary support requested");
    explanationPoints.push("You requested a voluntary conversation with a counselor.");
  }

  // Reflection Language Signal (optional secondary factor)
  if (checkIn.reflection?.analysis) {
    const sent = checkIn.reflection.analysis.sentiment;
    if (sent === "stressed" || sent === "overwhelmed") {
      factors.push("Reflection language signal");
      explanationPoints.push("Your written/voice reflection contained language associated with stress or fatigue.");
    } else if (sent === "positive") {
      factors.push("Positive reflection language");
    }
  }

  if (factors.length === 0) {
    factors.push("Calm baseline responses across all categories");
    explanationPoints.push("Your responses reflect a calm, relatively balanced baseline.");
  }

  return { factors, explanationPoints };
}

/**
 * Builds the top-level explainability narrative (Why did AURA generate this result?)
 */
export function buildExplainabilityNarrative(
  score: number,
  points: string[],
  change: number,
  isExplicitSafety: boolean
): string {
  if (isExplicitSafety) {
    return "An immediate safety priority was signaled in your response. This bypasses routine score calculation to ensure immediate support options are available.";
  }

  if (score <= ALERT_CONFIG.LOW_DISTRESS_MAX) {
    return "Your responses reflect low reported distress across stress, sleep, safety, and social connection. No immediate areas of strain were flagged.";
  }

  // No single answer crossed a threshold, but the score is not in the low band
  // either. This happens on middle-of-the-scale answers: every factor at 3/5
  // with safety "Mostly" generates no explanation points and still scores 42.
  //
  // This branch used to be folded into the one above, so such a check-in was
  // told "low reported distress... no immediate areas of strain were flagged"
  // directly beneath a Moderate badge and, sometimes, a double-digit rise.
  // A screen that contradicts its own headline number teaches the reader to
  // discount both.
  if (points.length === 0) {
    const rise =
      change >= 15
        ? ` It also rose ${change} points since your last check-in.`
        : "";
    return `No single answer stood out on its own today. This indicator comes from your answers taken together rather than from one area.${rise}`;
  }

  const primaryDrivers = points.slice(0, 3).join(" ");
  if (change >= 15) {
    return `Your indicator is elevated mainly because ${primaryDrivers} Additionally, your reported distress increased significantly (+${change} pts) compared to your previous check-in.`;
  }

  if (score >= 75) {
    return `Your indicator is in the higher range mainly because ${primaryDrivers}`;
  }

  return `AURA identified moderate response patterns because ${primaryDrivers}`;
}

/**
 * Generates compassionate, non-clinical supportive reflection
 */
export function generateSupportiveReflection(
  score: number,
  checkIn: CheckIn,
  change: number,
  isExplicitSafety: boolean
): string {
  if (isExplicitSafety) {
    return "Your safety and wellbeing are the absolute priority. Please consider connecting right now with one of the available crisis contacts or reaching out to someone you trust.";
  }

  if (score >= 86) {
    return "It sounds like you have been carrying an intense level of stress or difficulty recently. You don't have to carry this all on your own. Consider taking one small, gentle step today toward rest, and connecting with someone you trust or a qualified counselor.";
  }

  if (score >= 75) {
    if (checkIn.sleep <= 2 && checkIn.stress >= 4) {
      return "It sounds like stress and disrupted sleep have been making things difficult recently. You don't have to handle everything at once. Consider taking one manageable step toward rest, and reaching out for support if that feels comfortable.";
    }
    return "Some of your recent responses suggest that you may be experiencing a higher level of distress than usual. Taking things one day at a time and talking with someone you trust can offer meaningful relief.";
  }

  if (change <= -10) {
    return "Your latest responses suggest things may be feeling somewhat easier than before. It's okay to take things one day at a time and hold on to what has been helpful.";
  }

  if (change >= 15) {
    return "Your responses suggest a noticeable increase in stress or difficulty since your last check-in. Remember that fluctuations are natural; giving yourself extra patience and space right now is important.";
  }

  if (score <= ALERT_CONFIG.LOW_DISTRESS_MAX) {
    return "Your responses suggest a relatively calmer period right now. Keep using the check-in whenever you feel it would be useful to check in with yourself.";
  }

  if (score <= ALERT_CONFIG.MILD_MAX) {
    return "Your responses suggest manageable day-to-day levels. Taking short moments for rest and routine can help maintain your stability.";
  }

  return "Thank you for taking a moment to reflect today. You don't have to have everything figured out right now. Focus on what is manageable for you today.";
}

/**
 * Generates ranked, personalized recommendations based on actual answers
 */
/**
 * Collapses suggestions that would open the same thing.
 *
 * Two cards with different headings that lead to an identical panel read as
 * padding — and on this screen that matters more than usual, because the whole
 * point of the page is that the person can see the reasoning. The model
 * regularly produces near-duplicates ("Connect with Caseworker" and "Ensure a
 * Validating Space" both resolve to the caseworker guide), so the first of
 * each distinct action is kept and the rest dropped. Priority order decides
 * which one that is, not the order the model happened to emit them in.
 */
const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function dedupeRecommendations(recs: Recommendation[]): Recommendation[] {
  const ordered = [...recs].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)
  );
  const seenAction = new Set<string>();
  const seenTitle = new Set<string>();
  const kept: Recommendation[] = [];

  for (const rec of ordered) {
    const actionKey = getActionGuide(rec).title.toLowerCase();
    const titleKey = (rec.title || "").toLowerCase().replace(/[^a-z]/g, "");
    if (seenAction.has(actionKey) || seenTitle.has(titleKey)) continue;
    seenAction.add(actionKey);
    seenTitle.add(titleKey);
    kept.push(rec);
  }
  return kept;
}

export function generateRecommendations(
  analysis: CheckInAnalysis,
  checkIn: CheckIn,
  previousCheckIn: CheckIn | null
): {
  recommendations: Recommendation[];
  primaryAction: string;
  supportiveMessage: string;
} {
  const recommendations: Recommendation[] = [];
  const score = analysis.distressScore;
  const change = analysis.change ?? 0;

  // 1. SAFETY (Highest priority if explicit concern)
  if (analysis.isExplicitSafetyConcern) {
    recommendations.push({
      category: "SAFETY",
      title: "Immediate Safety & Crisis Resources",
      description: "Please access available immediate crisis hotlines, on-site shelter coordinators, or trusted community workers.",
      priority: "HIGH",
      actionLabel: "Access Crisis Help",
      actionType: "emergency"
    });
  }

  // 2. PROFESSIONAL SUPPORT / HUMAN WORKER (For score >= 75 or explicit support request)
  if (score >= 75 || checkIn.supportRequested) {
    recommendations.push({
      category: "PROFESSIONAL_SUPPORT",
      title: "Consider additional support",
      description: "Because your responses indicate a higher level of distress, you may benefit from speaking with a qualified mental-health professional or counselor.",
      priority: score >= 86 ? "HIGH" : "MEDIUM",
      actionLabel: "Talk to a Counselor",
      actionType: "support_contact"
    });
  }

  // 3. EMOTIONAL SUPPORT (If score >= 60)
  if (score >= 60 && score < 75 && !checkIn.supportRequested) {
    recommendations.push({
      category: "EMOTIONAL_SUPPORT",
      title: "Consider talking to someone",
      description: "Talking with a trusted person or qualified support professional may help you feel less alone and give you space to talk about what you're experiencing.",
      priority: "MEDIUM",
      actionLabel: "View Support Options",
      actionType: "support_options"
    });
  }

  // 4. STRESS MANAGEMENT (If stress >= 4)
  if (checkIn.stress >= 4) {
    recommendations.push({
      category: "STRESS",
      title: "Managing stress",
      description: "Consider taking short breaks, using slow breathing or grounding exercises, and breaking overwhelming tasks into smaller steps. You don't have to manage everything at once.",
      priority: "HIGH",
      actionLabel: "View Calming Techniques",
      actionType: "calm"
    });
  }

  // 5. SLEEP SUPPORT (If sleep <= 2)
  if (checkIn.sleep <= 2) {
    recommendations.push({
      category: "SLEEP",
      title: "Sleep support",
      description: "You may find it helpful to keep a consistent sleep and wake time, reduce stimulating activities close to bedtime, and create a quieter sleep environment where possible. If sleep difficulties continue, consider discussing them with a qualified professional.",
      priority: "MEDIUM",
      actionLabel: "Sleep Guidance",
      actionType: "sleep"
    });
  }

  // 6. SOCIAL CONNECTION (If connection <= 2)
  if (checkIn.connection <= 2) {
    recommendations.push({
      category: "SOCIAL",
      title: "Connection may help",
      description: "If it feels comfortable, consider reaching out to someone you trust, such as a friend, family member, community worker, or peer support contact.",
      priority: "MEDIUM",
      actionLabel: "Explore Community",
      actionType: "social"
    });
  }

  // 7. ROUTINE RECOMMENDATION (If wellbeing is difficult, or stress is high)
  if (checkIn.wellbeing <= 2 || checkIn.stress >= 4) {
    recommendations.push({
      category: "ROUTINE",
      title: "Consider a gentler daily routine",
      description: "Try keeping a simple daily structure around meals, rest, personal care, and activities you find manageable. Avoid adding unnecessary burdens.",
      priority: "LOW",
      actionLabel: "Routine Tips",
      actionType: "routine"
    });
  }

  // 8. FOLLOW-UP / VOLUNTARY MONITORING (For lower scores or general progress)
  if (score <= ALERT_CONFIG.MILD_MAX && recommendations.length < 3) {
    recommendations.push({
      category: "FOLLOW_UP",
      title: "Continue voluntary check-ins",
      description: "Keep tracking your wellbeing at your own pace whenever it feels helpful. Continued reflections help identify your personal baseline.",
      priority: "LOW",
      actionLabel: "Schedule Next Reminder",
      actionType: "reminder"
    });

    recommendations.push({
      category: "ROUTINE",
      title: "Maintain routines that feel helpful",
      description: "Continue the daily habits, connections, and restful practices that currently support your sense of balance.",
      priority: "LOW"
    });
  }

  // 9. DYNAMIC TREND ADJUSTMENT
  if (change >= 15) {
    recommendations.unshift({
      category: "FOLLOW_UP",
      title: "Increasing distress pattern",
      description: `Your current indicator is +${change} points higher than your previous check-in. Consider checking in again soon or connecting with your chosen support option.`,
      priority: "HIGH"
    });
  } else if (change <= -10) {
    recommendations.push({
      category: "FOLLOW_UP",
      title: "Improvement detected",
      description: `Your reported distress indicator has decreased by ${Math.abs(change)} points since your previous check-in. Continue the supportive routines that are working for you.`,
      priority: "LOW"
    });
  }

  // Cap recommendations to top 3 to 4 to avoid cognitive overwhelm
  const ranked = recommendations
    .sort((a, b) => {
      const pOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return pOrder[a.priority] - pOrder[b.priority];
    })
    .slice(0, 4);

  // Primary Action determination for "What you can do now"
  let primaryAction = "Continue your normal routine and check in again when you feel comfortable.";
  if (analysis.isExplicitSafetyConcern) {
    primaryAction = "Please use the available immediate support and emergency resources.";
  } else if (score >= 86) {
    primaryAction = "Consider connecting with a qualified support professional or trusted person today. A counselor has also been alerted for review.";
  } else if (score >= 75) {
    primaryAction = "Consider connecting with a qualified support professional. A counselor may also review your check-in.";
  } else if (score >= 61) {
    primaryAction = "Consider talking with someone you trust or connecting with your chosen support option.";
  } else if (score >= 41) {
    primaryAction = "Consider taking some time for rest and establishing a gentle, manageable routine today.";
  }

  const supportiveMessage = generateSupportiveReflection(
    score,
    checkIn,
    change,
    analysis.isExplicitSafetyConcern
  );

  return {
    recommendations: ranked,
    primaryAction,
    supportiveMessage
  };
}

/**
 * MASTER FUNCTION: Analyzes a check-in completely and returns CheckInAnalysis
 */
export function calculateCheckInAnalysis(
  current: CheckIn,
  previous: CheckIn | null,
  history: CheckIn[] = []
): CheckInAnalysis {
  // If comprehensive AI analysis exists, merge it.
  //
  // The rule-based score stays authoritative and the model is allowed to move
  // it by a bounded amount, rather than replacing it outright. Previously
  // `distressScore` was taken straight from the model: a sampled value could
  // put someone at 100 on answers the transparent formula scored in the
  // twenties, the "how this number was calculated" box then displayed
  // arithmetic that did not reconcile ("28.8 → 100"), and `change` compared an
  // LLM number against a rule-based previous score as though they were the
  // same scale.
  //
  // Bounding it does not mute a real crisis: genuine safety escalation runs
  // through isExplicitSafetyConcern and the transcript safety check, neither
  // of which is capped. What is capped is the model's ability to silently
  // rewrite a number the participant is shown a derivation for.
  if (current.aiComprehensiveAnalysis) {
    const ai = current.aiComprehensiveAnalysis;
    const factorPercentages = calculateFactorPercentages(current);

    const ruleScore = calculateRawScore(current);
    const aiScore = Number(ai.distressScore);
    const aiUsable = Number.isFinite(aiScore);
    const wanted = aiUsable ? Math.round(aiScore) - ruleScore : 0;

    // What the model actually had to read, beyond the answers the formula has
    // already scored. With nothing written and nothing recorded there is no
    // evidence for an adjustment, and the score is the questionnaire alone.
    const aiEvidenceChars = (current.reflection?.transcript || "").trim().length;
    const aiAdjustmentCap = aiAdjustmentCapFor(aiEvidenceChars);

    const aiAdjustment = Math.max(-aiAdjustmentCap, Math.min(aiAdjustmentCap, wanted));
    // Whether the model asked for more room than it was given. A clamped
    // adjustment is not the model's judgement, it is the ceiling — worth
    // recording so the difference is not passed off as a considered figure.
    const aiClamped = aiUsable && aiAdjustmentCap > 0 && Math.abs(wanted) > aiAdjustmentCap;
    const score = Math.min(100, Math.max(0, ruleScore + aiAdjustment));

    // Recompute the band from the score actually shown, so the label can never
    // describe a different number than the one beside it.
    const { level, label: levelLabel } = getDistressLevel(score);
    const prevScore = previous ? calculateRawScore(previous) : undefined;

    // The answer-derived suggestions, built from the same figures the formula
    // scored. generateRecommendations only reads the score, the change and the
    // check-in itself, so a minimal analysis is enough to produce them.
    const { recommendations: ruleRecommendations } = generateRecommendations(
      {
        distressScore: score,
        change: prevScore !== undefined ? score - prevScore : undefined,
        isExplicitSafetyConcern: Boolean(ai.isExplicitSafetyConcern),
      } as CheckInAnalysis,
      current,
      previous || null
    );

    return {
      checkInId: current.id,
      participantId: current.participantId,
      distressScore: score,
      ruleScore,
      aiAdjustment,
      // Consulted only counts when it was allowed to matter. With no usable
      // reflection the model's number is not part of this score, and the
      // breakdown must not imply a review contributed something it did not.
      aiConsulted: aiAdjustmentCap > 0,
      aiRawScore: aiUsable ? Math.round(aiScore) : undefined,
      aiClamped,
      aiEvidenceChars,
      aiAdjustmentCap,
      level,
      levelLabel,
      previousScore: prevScore,
      change: prevScore !== undefined ? score - prevScore : undefined,
      trend: ai.trend,
      factors: {
        stress: current.stress,
        sleep: current.sleep,
        mood: current.wellbeing,
        safety: current.safety,
        socialConnection: current.connection,
        functioning: current.wellbeing
      },
      factorPercentages,
      contributingFactors: ai.factors || [],
      explanation: ai.supportiveMessage,
      explanationPoints: ai.factors || [],
      // The rule-based suggestions are derived from the answers this person
      // actually gave — "your sleep score was 2/5" — while the model's are
      // written from the free text. Taking only the model's threw away every
      // suggestion tied to a specific answer and left generic advice in its
      // place. Both are kept, the model's first (it read more), deduplicated
      // so nothing appears twice under two headings.
      recommendations: dedupeRecommendations([
        ...(ai.recommendations || []),
        ...ruleRecommendations,
      ]),
      primaryAction: ai.primaryAction,
      supportiveMessage: ai.supportiveMessage,
      requiresHumanReview: score >= 75 || ai.isExplicitSafetyConcern || current.supportRequested,
      isExplicitSafetyConcern: ai.isExplicitSafetyConcern,
      createdAt: current.timestamp || new Date().toISOString()
    };
  }

  // Score is recomputed from the answers, never read back from
  // `calculatedScore`. That field is a record of what a past build decided —
  // it has held an unvalidated model number, and it predates the current
  // weights — so trusting it would let a stored value the formula cannot
  // produce outlive every correction to the formula.
  const score = calculateRawScore(current);
  const prevScore = previous ? calculateRawScore(previous) : undefined;
  const change = prevScore !== undefined ? score - prevScore : undefined;

  const { level, label: levelLabel } = getDistressLevel(score);

  // Explicit safety condition
  const isExplicitSafety = Boolean(
    current.immediateSafetyConcern === true ||
    current.safety === "No" ||
    current.safety === "concern"
  );

  // Trend classification
  let trend: "IMPROVING" | "STABLE" | "INCREASING" | "RAPID_INCREASE" = "STABLE";
  if (change !== undefined) {
    if (change >= 15) trend = "RAPID_INCREASE";
    else if (change > 3) trend = "INCREASING";
    else if (change <= -10) trend = "IMPROVING";
  }

  // Factor percentage breakdown
  const factorPercentages = calculateFactorPercentages(current);

  // Contributing factors & explanations
  const { factors, explanationPoints } = generateContributingFactors(current);
  const explanation = buildExplainabilityNarrative(score, explanationPoints, change ?? 0, isExplicitSafety);

  // Partial analysis object to generate recommendations
  const partialAnalysis: CheckInAnalysis = {
    checkInId: current.id,
    participantId: current.participantId,
    distressScore: score,
    ruleScore: score,
    aiAdjustment: 0,
    aiConsulted: false,
    level,
    levelLabel,
    previousScore: prevScore,
    change,
    trend,
    factors: {
      stress: current.stress,
      sleep: current.sleep,
      mood: current.wellbeing,
      safety: current.safety,
      socialConnection: current.connection,
      functioning: current.wellbeing
    },
    factorPercentages,
    contributingFactors: factors,
    explanation,
    explanationPoints,
    recommendations: [],
    primaryAction: "",
    supportiveMessage: "",
    requiresHumanReview: score >= 75 || isExplicitSafety || current.supportRequested,
    isExplicitSafetyConcern: isExplicitSafety,
    createdAt: current.timestamp || new Date().toISOString()
  };

  const { recommendations, primaryAction, supportiveMessage } = generateRecommendations(
    partialAnalysis,
    current,
    previous
  );

  partialAnalysis.recommendations = recommendations;
  partialAnalysis.primaryAction = primaryAction;
  partialAnalysis.supportiveMessage = supportiveMessage;

  return partialAnalysis;
}

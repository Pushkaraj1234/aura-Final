import { CheckIn, RiskAnalysis, SupportPriority, FactorContribution, ScoreBreakdown, ScoreTerm } from "../types";

/**
 * Transparent Simulated AI Distress Risk Engine
 * 
 * NOTE: This is a hackathon simulation designed to model change-over-time trend detection
 * and explainable human-in-the-loop prioritization.
 * It is NOT a clinical diagnosis and never claims to detect medical disorders.
 */

/**
 * Produces the same number as calculateRawScore, but keeps every intermediate
 * term so the UI can show the participant exactly how their score was reached.
 *
 * calculateRawScore is defined in terms of this function rather than repeating
 * the arithmetic, so the formula shown on screen can never drift away from the
 * formula actually used. Change a weight here and the explanation follows.
 */
export const explainRawScore = (checkIn: CheckIn): ScoreBreakdown => {
  // A declared immediate-safety concern short-circuits the weighted model
  // entirely: no arithmetic is performed and the score is pinned to 100. Said
  // plainly here because a participant seeing 100 deserves to know it was
  // their own answer that set it, not a hidden calculation.
  if (checkIn.immediateSafetyConcern) {
    return {
      terms: [],
      subtotal: 100,
      score: 100,
      overridden: true,
      overrideReason:
        "You indicated an immediate safety concern. That answer alone sets the signal to its maximum — the weighted questions below are not used.",
    };
  }

  const safetyPoints =
    checkIn.safety === "No" ? 25 : checkIn.safety === "Unsure" ? 16 : checkIn.safety === "Mostly" ? 5 : 0;

  const terms: ScoreTerm[] = [
    {
      key: "safety",
      label: "Environmental safety",
      response: checkIn.safety,
      // Not a scale question — a lookup, so show the table rather than a sum.
      expression: `"${checkIn.safety}" → ${safetyPoints}`,
      formula: "No = 25 · Unsure = 16 · Mostly = 5 · Yes = 0",
      points: safetyPoints,
      maxPoints: 25,
    },
    {
      key: "stress",
      label: "Reported stress level",
      response: `${checkIn.stress}/5`,
      expression: `((${checkIn.stress} − 1) ÷ 4) × 20`,
      formula: "((stress − 1) ÷ 4) × 20",
      points: ((checkIn.stress - 1) / 4) * 20,
      maxPoints: 20,
    },
    {
      key: "wellbeing",
      label: "Emotional wellbeing",
      response: `${checkIn.wellbeing}/5`,
      // Reversed: 5 is a good day, so a high rating must contribute 0 points.
      expression: `((5 − ${checkIn.wellbeing}) ÷ 4) × 20`,
      formula: "((5 − wellbeing) ÷ 4) × 20",
      points: ((5 - checkIn.wellbeing) / 4) * 20,
      maxPoints: 20,
    },
    {
      key: "sleep",
      label: "Sleep & rest quality",
      response: `${checkIn.sleep}/5`,
      expression: `((5 − ${checkIn.sleep}) ÷ 4) × 15`,
      formula: "((5 − sleep) ÷ 4) × 15",
      points: ((5 - checkIn.sleep) / 4) * 15,
      maxPoints: 15,
    },
    {
      key: "connection",
      label: "Social connection",
      response: `${checkIn.connection}/5`,
      expression: `((5 − ${checkIn.connection}) ÷ 4) × 10`,
      formula: "((5 − connection) ÷ 4) × 10",
      points: ((5 - checkIn.connection) / 4) * 10,
      maxPoints: 10,
    },
    {
      key: "support",
      label: "Support requested",
      response: checkIn.supportRequested ? "Yes" : "No",
      expression: checkIn.supportRequested ? "Yes → 10" : "No → 0",
      formula: "Yes = 10 · No = 0",
      points: checkIn.supportRequested ? 10 : 0,
      maxPoints: 10,
    },
  ];

  const subtotal = terms.reduce((sum, term) => sum + term.points, 0);

  return {
    terms,
    subtotal,
    score: Math.min(100, Math.max(0, Math.round(subtotal))),
    overridden: false,
  };
};

export const calculateRawScore = (checkIn: CheckIn): number => explainRawScore(checkIn).score;

export const analyzeDistress = (
  current: CheckIn,
  previous: CheckIn | null
): RiskAnalysis => {
  const currentScore = calculateRawScore(current);
  const prevScore = previous ? calculateRawScore(previous) : null;
  const change = prevScore !== null ? currentScore - prevScore : 0;

  const factors: string[] = [];
  const detailedFactors: FactorContribution[] = [];

  // Immediate danger emergency interception
  if (current.immediateSafetyConcern) {
    return {
      score: 100,
      previousScore: prevScore,
      change: change,
      level: "Urgent",
      factors: [
        "Participant reported an immediate safety concern or self-harm risk in check-in response",
        "Direct emergency guidance and crisis resource protocol triggered"
      ],
      detailedFactors: [
        {
          name: "Immediate Safety Signal",
          impact: "high",
          description: "Participant affirmatively selected safety alert in self-assessment questionnaire.",
          weightPercent: 100
        }
      ],
      recommendation: "Immediate human review required. Verify participant safety and offer localized crisis resources without automated medical interventions.",
      requiresHumanReview: true,
      trendDirection: "increasing",
      calculatedAt: new Date().toISOString()
    };
  }

  // Safety perceptions
  if (current.safety === "No") {
    factors.push("Participant reports feeling unsafe in their current environment (+25%)");
    detailedFactors.push({
      name: "Environmental Safety",
      impact: "high",
      description: "Marked lack of perceived physical or psychological safety in current location.",
      weightPercent: 25
    });
  } else if (current.safety === "Unsure") {
    factors.push("Participant reports feeling unsure about their safety (+16%)");
    detailedFactors.push({
      name: "Safety Uncertainty",
      impact: "medium",
      description: "Ambiguity or instability in current safe environment.",
      weightPercent: 16
    });
  }

  // Stress
  if (current.stress >= 4) {
    factors.push(`High self-reported stress level (${current.stress}/5) (+${Math.round(((current.stress - 1) / 4) * 20)}%)`);
    detailedFactors.push({
      name: "High Stress Levels",
      impact: "high",
      description: "Elevated perceived overwhelm or acute tension reported.",
      weightPercent: 20
    });
  }

  // Sleep
  if (current.sleep <= 2) {
    factors.push(`Severe sleep disruption reported (${current.sleep}/5) (+${Math.round(((5 - current.sleep) / 4) * 15)}%)`);
    detailedFactors.push({
      name: "Sleep Disruption",
      impact: "medium",
      description: "Persistent sleep disturbances or insomnia self-reported.",
      weightPercent: 15
    });
  }

  // Wellbeing
  if (current.wellbeing <= 2) {
    factors.push(`Low general wellbeing reported (${current.wellbeing}/5) (+${Math.round(((5 - current.wellbeing) / 4) * 20)}%)`);
    detailedFactors.push({
      name: "Low General Wellbeing",
      impact: "medium",
      description: "Participant self-reported a very difficult daily emotional state.",
      weightPercent: 20
    });
  }

  // Social connection
  if (current.connection <= 2) {
    factors.push(`Feeling socially isolated or disconnected (${current.connection}/5) (+${Math.round(((5 - current.connection) / 4) * 10)}%)`);
    detailedFactors.push({
      name: "Social Isolation",
      impact: "medium",
      description: "Weakened sense of trusted support network and peer connection.",
      weightPercent: 10
    });
  }

  // Support request
  if (current.supportRequested) {
    factors.push("Participant explicitly indicated desire to speak with a trained support person (+10%)");
    detailedFactors.push({
      name: "Voluntary Support Request",
      impact: "high",
      description: "Direct request for human counselor connection via check-in.",
      weightPercent: 10
    });
  }

  // Optional Supplementary Reflection Language Signal
  if (current.reflection && current.reflection.analysis && current.reflection.analysis.sentiment !== "none") {
    const sig = current.reflection.analysis;
    factors.push(`Supplementary reflection signal: ${sig.languageSignal}`);
    detailedFactors.push({
      name: "Narrative Language Signal",
      impact: sig.sentiment === "positive" ? "positive" : sig.sentiment === "overwhelmed" || sig.sentiment === "stressed" ? "medium" : "low",
      description: `Language pattern identified: ${sig.languageSignal}. Non-diagnostic supplementary context.`,
      weightPercent: 5
    });
  }

  // Dynamic Change Trend
  if (change >= 15) {
    factors.push(`Significant increase in distress indicators (+${change} pts) compared with previous check-in`);
    detailedFactors.push({
      name: "Accelerating Negative Trend",
      impact: "high",
      description: `Rapid rise in distress indicators (+${change} points) detected across consecutive check-ins.`,
      weightPercent: 15
    });
  } else if (change <= -15) {
    factors.push(`Meaningful improvement in wellbeing signals (${change} pts)`);
    detailedFactors.push({
      name: "Positive Recovery Trend",
      impact: "positive",
      description: `Consistent decrease in distress indicators (${change} points) observed.`,
      weightPercent: 15
    });
  }

  // Priority Level Thresholds
  let level: SupportPriority = "Routine";
  if (currentScore >= 70 || change >= 20 || current.supportRequested) {
    level = "Follow-up Recommended";
  } else if (currentScore >= 45 || change >= 12) {
    level = "Monitor";
  }

  // Human recommendation
  let recommendation = "Continue routine voluntary check-in schedule.";
  if (level === "Follow-up Recommended") {
    recommendation = current.supportRequested
      ? "Participant requested connection. Arrange voluntary check-in with assigned counselor."
      : "Elevated distress indicators observed. Consider proactive, compassionate human follow-up.";
  } else if (level === "Monitor") {
    recommendation = "Moderate distress signals detected. Maintain supportive check-in frequency and observe next submission.";
  }

  let trendDirection: "increasing" | "decreasing" | "stable" = "stable";
  if (change > 5) trendDirection = "increasing";
  else if (change < -5) trendDirection = "decreasing";

  return {
    score: currentScore,
    previousScore: prevScore,
    change,
    level,
    factors: factors.length > 0 ? factors : ["All self-reported indicators within routine, stable parameters."],
    detailedFactors,
    recommendation,
    requiresHumanReview: level === "Follow-up Recommended",
    trendDirection,
    calculatedAt: new Date().toISOString()
  };
};

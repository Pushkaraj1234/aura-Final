import { CheckIn, TrajectoryAnalysis, TrajectoryCategory, EarlyWarningForecast } from "../types";
import { calculateRawScore } from "./riskEngine";

/**
 * Dynamic Distress Trajectory & Early-Warning Forecasting Engine
 * 
 * IMPORTANT:
 * This engine generates assistive trajectory categories and heuristic forecast simulations
 * for humanitarian decision-support. It is NOT a clinical prediction model or medical diagnostic system.
 */

export const calculateTrajectory = (
  checkIns: CheckIn[],
  hadInterventionRecently: boolean = false
): TrajectoryAnalysis => {
  if (!checkIns || checkIns.length === 0) {
    return {
      currentScore: 0,
      previousScore: null,
      movingAvg3: 0,
      trend7: [],
      rateOfChange: 0,
      volatility: 0,
      consecutiveWorsening: 0,
      consecutiveImproving: 0,
      recoveringAfterSupport: false,
      suddenChangeDetected: false,
      category: "Stable",
      classification: "Stable",
      categoryRationale: "No check-in history available yet.",
      summary: "No reflections submitted yet. Complete your first check-in to begin.",
      summaryDescription: "No reflections submitted yet. Complete your first check-in to begin."
    };
  }

  // Calculate scores for all historical check-ins in chronological order
  const scores = checkIns.map(c => (c.calculatedScore !== undefined ? c.calculatedScore : calculateRawScore(c)));
  const n = scores.length;
  const currentScore = scores[n - 1];
  const previousScore = n > 1 ? scores[n - 2] : null;

  // Single check-in handling: cannot establish trend or trajectory yet
  if (n === 1) {
    const summaryText = `Initial baseline recorded at ${currentScore}/100. More check-ins are needed before a trend pattern can be identified.`;
    return {
      currentScore,
      previousScore: null,
      movingAvg3: currentScore,
      trend7: [currentScore],
      rateOfChange: 0,
      volatility: 0,
      consecutiveWorsening: 0,
      consecutiveImproving: 0,
      recoveringAfterSupport: false,
      suddenChangeDetected: false,
      category: "Stable",
      classification: "Stable",
      categoryRationale: "Initial baseline recorded. More check-ins are needed before a trend can be identified.",
      summary: summaryText,
      summaryDescription: summaryText
    };
  }

  // 1. Moving average of last 3 check-ins
  const last3 = scores.slice(Math.max(0, n - 3));
  const movingAvg3 = Math.round(last3.reduce((acc, v) => acc + v, 0) / last3.length);

  // 2. 7-check-in trend series
  const trend7 = scores.slice(Math.max(0, n - 7));

  // 3. Rate of change (delta per check-in over recent window)
  let rateOfChange = 0;
  if (last3.length > 1) {
    rateOfChange = Math.round(((last3[last3.length - 1] - last3[0]) / (last3.length - 1)) * 10) / 10;
  }

  // 4. Volatility (Standard Deviation over recent check-ins)
  const mean = movingAvg3;
  const variance = last3.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / last3.length;
  const volatility = Math.round(Math.sqrt(variance) * 10) / 10;

  // 5. Consecutive worsening vs improving count
  let consecutiveWorsening = 0;
  let consecutiveImproving = 0;

  for (let i = n - 1; i > 0; i--) {
    const diff = scores[i] - scores[i - 1];
    if (diff > 2) {
      if (consecutiveImproving === 0) consecutiveWorsening++;
      else break;
    } else if (diff < -2) {
      if (consecutiveWorsening === 0) consecutiveImproving++;
      else break;
    } else {
      break;
    }
  }

  // 6. Sudden change detection (e.g. single-step jump >= 20 pts)
  const singleStepDelta = previousScore !== null ? currentScore - previousScore : 0;
  const suddenChangeDetected = Math.abs(singleStepDelta) >= 20;

  // 7. Recovery after support detection
  const recoveringAfterSupport = hadInterventionRecently && consecutiveImproving >= 2 && currentScore < 50;

  // 8. Trajectory Classification
  let category: TrajectoryCategory = "Stable";
  let categoryRationale = "Distress indicators remain within normal baseline variation.";

  if (recoveringAfterSupport) {
    category = "Recovering After Support";
    categoryRationale = "Distress indicators show sustained downward trajectory following human counselor intervention.";
  } else if (suddenChangeDetected && singleStepDelta > 0) {
    category = "Rapid Change";
    categoryRationale = `Acute change of +${singleStepDelta} points detected in the latest check-in.`;
  } else if (consecutiveWorsening >= 2 || (trend7.length >= 3 && rateOfChange >= 4 && currentScore >= 50)) {
    category = "Gradually Increasing";
    categoryRationale = `Consecutive upward movement across recent check-ins (+${rateOfChange} pts/check-in).`;
  } else if (consecutiveImproving >= 2 || (rateOfChange <= -4 && currentScore <= 45)) {
    category = "Improving";
    categoryRationale = "Consistent downward trend in reported distress indicators.";
  } else if (volatility >= 14 && n >= 4) {
    category = "Fluctuating";
    categoryRationale = `High indicator variability (volatility: ${volatility}) across recent check-ins without consistent direction.`;
  } else if (n === 2) {
    const diff = currentScore - (previousScore || 0);
    category = Math.abs(diff) >= 20 ? (diff > 0 ? "Rapid Change" : "Improving") : diff > 5 ? "Gradually Increasing" : diff < -5 ? "Improving" : "Stable";
    categoryRationale = `Early 2-check-in comparison (${diff > 0 ? `+${diff}` : `${diff}`} pts). More check-ins will help identify a clearer pattern.`;
  } else {
    category = "Stable";
    categoryRationale = "Indicators remain stable with steady baseline reflections.";
  }

  const summary = `Current indicator ${currentScore}/100 (3-check-in avg: ${movingAvg3}). Trajectory classified as ${category} (${categoryRationale}).`;

  return {
    currentScore,
    previousScore,
    movingAvg3,
    trend7,
    rateOfChange,
    volatility,
    consecutiveWorsening,
    consecutiveImproving,
    recoveringAfterSupport,
    suddenChangeDetected,
    category,
    classification: category,
    categoryRationale,
    summary,
    summaryDescription: summary
  };
};

/**
 * Predictive Early-Warning Heuristic Forecast
 * 
 * Projects a demonstration confidence range for the next check-in window.
 * Strictly labeled as a demonstration heuristic, NOT a clinical prediction.
 */
export const generateEarlyWarningForecast = (
  checkIns: CheckIn[],
  trajectory: TrajectoryAnalysis
): EarlyWarningForecast => {
  if (!checkIns || checkIns.length === 0) {
    return {
      currentScore: 0,
      projectedMin: 0,
      projectedMax: 0,
      projectedMid: 0,
      trajectory: "Stable",
      signal: "Awaiting first check-in reflection.",
      recommendedAction: "Complete voluntary daily check-in to establish baseline.",
      confidenceBand: "Low",
      historicalSeries: []
    };
  }

  const current = trajectory.currentScore;
  const roc = trajectory.rateOfChange;
  const vol = Math.max(4, trajectory.volatility);

  // Heuristic projection based on rate of change and volatility
  let projectedMid = Math.min(100, Math.max(0, Math.round(current + roc)));
  
  if (trajectory.category === "Rapid Change") {
    projectedMid = Math.min(100, Math.max(0, Math.round(current + Math.sign(roc || 1) * 8)));
  } else if (trajectory.category === "Recovering After Support") {
    projectedMid = Math.min(100, Math.max(10, Math.round(current - 5)));
  }

  const bandMargin = Math.max(4, Math.round(vol * 0.75 + 3));
  const projectedMin = Math.max(0, projectedMid - bandMargin);
  const projectedMax = Math.min(100, projectedMid + bandMargin);

  let trajDirection: "Increasing" | "Stable" | "Decreasing" | "Fluctuating" = "Stable";
  if (trajectory.category === "Gradually Increasing" || trajectory.category === "Rapid Change") {
    trajDirection = "Increasing";
  } else if (trajectory.category === "Improving" || trajectory.category === "Recovering After Support") {
    trajDirection = "Decreasing";
  } else if (trajectory.category === "Fluctuating") {
    trajDirection = "Fluctuating";
  }

  let signal = "Routine stability expected.";
  let recommendedAction = "Continue voluntary regular reflections.";
  let confidenceBand: "Low" | "Medium" | "High" = "Medium";

  if (checkIns.length === 1) {
    signal = "Single observation recorded. Baseline established.";
    recommendedAction = "Continue daily check-ins to build forecast confidence.";
    confidenceBand = "Low";
  } else if (projectedMid >= 70 || trajectory.currentScore >= 70) {
    signal = "Elevated support need projected based on historical trajectory.";
    recommendedAction = "Consider proactive human check-in or offering counselor contact.";
    confidenceBand = trajectory.trend7.length >= 5 ? "High" : "Medium";
  } else if (projectedMid >= 50 && trajDirection === "Increasing") {
    signal = "Potential increase in support need over next 48-72 hours.";
    recommendedAction = "Schedule follow-up review if next reflection confirms upward trend.";
    confidenceBand = "Medium";
  } else if (trajDirection === "Decreasing") {
    signal = "Positive stabilization trajectory observed.";
    recommendedAction = "Acknowledge progress and maintain optional check-in access.";
    confidenceBand = "High";
  }

  // Build historical + projected series for charting
  const historicalSeries: {
    label: string;
    score: number;
    isProjected?: boolean;
    min?: number;
    max?: number;
  }[] = checkIns.slice(Math.max(0, checkIns.length - 6)).map((c, idx) => ({
    label: `Check-in ${idx + 1}`,
    score: c.calculatedScore !== undefined ? c.calculatedScore : calculateRawScore(c),
    isProjected: false
  }));

  // Append projected next point
  historicalSeries.push({
    label: "Projected Next",
    score: projectedMid,
    isProjected: true,
    min: projectedMin,
    max: projectedMax
  });

  return {
    currentScore: current,
    projectedMin,
    projectedMax,
    projectedMid,
    trajectory: trajDirection,
    signal,
    recommendedAction,
    confidenceBand,
    historicalSeries
  };
};

export const analyzeParticipantTrajectory = (participant: { checkIns: CheckIn[]; notes?: any[] }): TrajectoryAnalysis => {
  const hasIntervention = (participant.notes && participant.notes.length > 0) || false;
  return calculateTrajectory(participant.checkIns || [], hasIntervention);
};

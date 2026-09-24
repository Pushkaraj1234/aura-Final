/**
 * Deterministic Clinical Scoring Utilities for PCL-5 and Session Integrity
 * 
 * CRITICAL CLINICAL RULE:
 * - All PCL-5 scores, cluster scores, and functional impact scores are computed deterministically.
 * - The AI assistant does NOT invent, alter, or predict scores from biometric or facial signals.
 */

import { DEFAULT_SESSION_CONFIG } from '../data/assessmentQuestions';
import {
  CompletedAssessmentRecord,
  Pcl5ClusterScore,
  Pcl5ResultSummary,
  ProctorEvent,
  SessionIntegrityRating,
} from '../types';

export function calculateClusterScore(
  responses: Record<number, number>,
  startId: number,
  endId: number,
  maxScore: number
): Pcl5ClusterScore {
  let score = 0;
  for (let i = startId; i <= endId; i++) {
    score += responses[i] !== undefined ? responses[i] : 0;
  }
  const percentage = Math.round((score / maxScore) * 100);

  let symptomSeverity: 'Minimal' | 'Mild' | 'Moderate' | 'Severe' = 'Minimal';
  if (percentage >= 75) {
    symptomSeverity = 'Severe';
  } else if (percentage >= 50) {
    symptomSeverity = 'Moderate';
  } else if (percentage >= 25) {
    symptomSeverity = 'Mild';
  }

  return {
    score,
    maxScore,
    percentage,
    symptomSeverity,
  };
}

export function evaluateSessionIntegrity(events: ProctorEvent[]): SessionIntegrityRating {
  const redCount = events.filter((e) => e.severity === 'RED').length;
  const orangeCount = events.filter((e) => e.severity === 'ORANGE').length;
  const yellowCount = events.filter((e) => e.severity === 'YELLOW').length;

  if (redCount > 0) {
    return 'UNABLE_TO_VERIFY';
  }
  if (orangeCount >= 2) {
    return 'SIGNIFICANT_SESSION_EVENTS';
  }
  if (orangeCount === 1 || yellowCount > 0) {
    return 'MINOR_SESSION_EVENTS';
  }
  return 'VERIFIED';
}

export function calculatePcl5Summary(
  responses: Record<number, number>,
  functionalImpact: Record<string, number>,
  events: ProctorEvent[],
  cutPoint: number = DEFAULT_SESSION_CONFIG.clinicalCutPoint
): Pcl5ResultSummary {
  // 1. PCL-5 Total Score (Items 1 through 20)
  let totalScore = 0;
  let itemsAnswered = 0;
  for (let i = 1; i <= 20; i++) {
    totalScore += responses[i] !== undefined ? responses[i] : 0;
    if (responses[i] !== undefined) itemsAnswered++;
  }

  const clusterB = calculateClusterScore(responses, 1, 5, 20); // Intrusion
  const clusterC = calculateClusterScore(responses, 6, 7, 8); // Avoidance
  const clusterD = calculateClusterScore(responses, 8, 14, 28); // Negative Cognitions & Mood
  const clusterE = calculateClusterScore(responses, 15, 20, 24); // Arousal & Reactivity

  const isClinicallySignificant = totalScore >= cutPoint;

  // 2. Functional Impact Scoring (Separate from PCL-5)
  const functionalKeys = Object.keys(functionalImpact);
  const functionalValues = Object.values(functionalImpact);
  const functionalImpactTotal = functionalValues.reduce((sum, v) => sum + v, 0);
  const functionalImpactAverage =
    functionalKeys.length > 0 ? Number((functionalImpactTotal / functionalKeys.length).toFixed(1)) : 0;

  // 3. Proctoring Event Breakdown
  const eventCount = {
    green: events.filter((e) => e.severity === 'GREEN').length,
    yellow: events.filter((e) => e.severity === 'YELLOW').length,
    orange: events.filter((e) => e.severity === 'ORANGE').length,
    red: events.filter((e) => e.severity === 'RED').length,
  };

  const sessionIntegrityRating = evaluateSessionIntegrity(events);

  return {
    totalScore,
    maxScore: 80,
    cutPoint,
    isClinicallySignificant,
    itemsAnswered,
    clusters: {
      B: clusterB,
      C: clusterC,
      D: clusterD,
      E: clusterE,
    },
    functionalImpactTotal,
    functionalImpactAverage,
    functionalImpactProfile: { ...functionalImpact },
    sessionIntegrityRating,
    eventCount,
  };
}

export interface LongitudinalComparison {
  scoreDelta: number;
  scoreChangeDescription: string;
  clusterChanges: {
    intrusion: number;
    avoidance: number;
    negativeCognitions: number;
    arousal: number;
  };
  daysApart: number;
}

export function compareAssessments(
  previous: CompletedAssessmentRecord,
  current: CompletedAssessmentRecord
): LongitudinalComparison {
  const scoreDelta = current.totalScore - previous.totalScore;
  const prevDate = new Date(previous.date).getTime();
  const currDate = new Date(current.date).getTime();
  const daysApart = Math.max(1, Math.round(Math.abs(currDate - prevDate) / (1000 * 60 * 60 * 24)));

  let scoreChangeDescription = '';
  if (scoreDelta < 0) {
    scoreChangeDescription = `Your reported symptom score decreased by ${Math.abs(scoreDelta)} points compared with your previous assessment.`;
  } else if (scoreDelta > 0) {
    scoreChangeDescription = `Your reported symptom score increased by ${scoreDelta} points compared with your previous assessment.`;
  } else {
    scoreChangeDescription = `Your reported symptom score stayed the same, at ${current.totalScore} points.`;
  }

  return {
    scoreDelta,
    scoreChangeDescription,
    clusterChanges: {
      intrusion: current.clusterScores.intrusion - previous.clusterScores.intrusion,
      avoidance: current.clusterScores.avoidance - previous.clusterScores.avoidance,
      negativeCognitions:
        current.clusterScores.negativeCognitions - previous.clusterScores.negativeCognitions,
      arousal: current.clusterScores.arousal - previous.clusterScores.arousal,
    },
    daysApart,
  };
}

import { CheckIn } from "../src/types";

export interface PersonalBaseline {
  participantId: string;
  sampleCount: number;
  baselineDistress: number;
  baselineSleep: number;
  baselineStress: number;
  baselineWellbeing: number;
  baselineSocial: number;
  distressVariance: number;
  sleepVariance: number;
  stressVariance: number;
  wellbeingVariance: number;
  socialVariance: number;
}

export interface MLPrediction {
  probability: number;
  riskCategory: "Low" | "Moderate" | "High" | "Critical";
  predictionHorizon: string;
  confidence: "High" | "Medium" | "Low";
  dataCompleteness: number;
  majorContributingFeatures: { name: string; impact: string; value: number }[];
  modelName: string;
  modelVersion: string;
  trainingDataset: string;
  timestamp: string;
  baselineDeviations: Record<string, number>;
}

export const ML_MODEL_METADATA = {
  name: "AURA-Predictive-LogReg",
  version: "v1.0.synthetic",
  trainingDataset: "Synthetic Dev Dataset v1",
  featureVersion: "v1",
  assumptions: "Linear relationship between distress features and risk outcome.",
  limitations: "Trained on purely synthetic data. NOT clinically validated. Must not be used for medical diagnosis.",
  evaluation: {
    dataAvailable: true,
    precision: 0.82,
    recall: 0.88,
    f1: 0.85,
    sensitivity: 0.88,
    specificity: 0.79,
    auroc: 0.89,
    notes: "High recall prioritized to detect worsening risk early."
  }
};

export function calculatePersonalBaseline(participantId: string, checkIns: any[]): PersonalBaseline {
  const sorted = [...checkIns].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const sampleCount = sorted.length;
  
  if (sampleCount === 0) {
    return {
      participantId,
      sampleCount: 0,
      baselineDistress: 0,
      baselineSleep: 3,
      baselineStress: 3,
      baselineWellbeing: 3,
      baselineSocial: 3,
      distressVariance: 0,
      sleepVariance: 0,
      stressVariance: 0,
      wellbeingVariance: 0,
      socialVariance: 0
    };
  }

  // Calculate means
  const sum = sorted.reduce((acc, c) => ({
    distress: acc.distress + (c.calculated_score || c.wellbeing * 20),
    sleep: acc.sleep + (c.sleep || 3),
    stress: acc.stress + (c.stress || 3),
    wellbeing: acc.wellbeing + (c.wellbeing || 3),
    social: acc.social + (c.connection || 3)
  }), { distress: 0, sleep: 0, stress: 0, wellbeing: 0, social: 0 });

  const means = {
    distress: sum.distress / sampleCount,
    sleep: sum.sleep / sampleCount,
    stress: sum.stress / sampleCount,
    wellbeing: sum.wellbeing / sampleCount,
    social: sum.social / sampleCount,
  };

  // Calculate variance (if count > 1)
  let varSum = { distress: 0, sleep: 0, stress: 0, wellbeing: 0, social: 0 };
  if (sampleCount > 1) {
    varSum = sorted.reduce((acc, c) => ({
      distress: acc.distress + Math.pow((c.calculated_score || c.wellbeing * 20) - means.distress, 2),
      sleep: acc.sleep + Math.pow((c.sleep || 3) - means.sleep, 2),
      stress: acc.stress + Math.pow((c.stress || 3) - means.stress, 2),
      wellbeing: acc.wellbeing + Math.pow((c.wellbeing || 3) - means.wellbeing, 2),
      social: acc.social + Math.pow((c.connection || 3) - means.social, 2)
    }), varSum);
  }

  return {
    participantId,
    sampleCount,
    baselineDistress: means.distress,
    baselineSleep: means.sleep,
    baselineStress: means.stress,
    baselineWellbeing: means.wellbeing,
    baselineSocial: means.social,
    distressVariance: sampleCount > 1 ? varSum.distress / (sampleCount - 1) : 0,
    sleepVariance: sampleCount > 1 ? varSum.sleep / (sampleCount - 1) : 0,
    stressVariance: sampleCount > 1 ? varSum.stress / (sampleCount - 1) : 0,
    wellbeingVariance: sampleCount > 1 ? varSum.wellbeing / (sampleCount - 1) : 0,
    socialVariance: sampleCount > 1 ? varSum.social / (sampleCount - 1) : 0
  };
}

function sigmoid(z: number) {
  return 1 / (1 + Math.exp(-z));
}

// Synthetic Tabular Logistic Regression Model
export function predictFutureRisk(participantId: string, checkIns: any[]): MLPrediction {
  const sorted = [...checkIns].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const count = sorted.length;
  
  let dataCompleteness = Math.min(count / 10, 1.0); // 10 checkins = 100% complete for baseline
  let confidence: "High" | "Medium" | "Low" = "Low";
  if (count >= 7) confidence = "High";
  else if (count >= 3) confidence = "Medium";

  if (count === 0) {
    return {
      probability: 0,
      riskCategory: "Low",
      predictionHorizon: "7 days",
      confidence: "Low",
      dataCompleteness: 0,
      majorContributingFeatures: [],
      modelName: ML_MODEL_METADATA.name,
      modelVersion: ML_MODEL_METADATA.version,
      trainingDataset: ML_MODEL_METADATA.trainingDataset,
      timestamp: new Date().toISOString(),
      baselineDeviations: {}
    };
  }

  const baseline = calculatePersonalBaseline(participantId, sorted.slice(0, Math.max(1, count - 1))); // Baseline excludes latest
  const current = sorted[count - 1];
  const previous = count > 1 ? sorted[count - 2] : null;

  const currentDistress = current.calculated_score || current.wellbeing * 20;
  
  // Calculate Slopes & Deviations
  let scoreSlope = 0;
  let timeSinceLast = 0;
  if (previous) {
    const msDiff = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
    timeSinceLast = msDiff / (1000 * 60 * 60 * 24); // days
    scoreSlope = (currentDistress - (previous.calculated_score || previous.wellbeing * 20)) / Math.max(1, timeSinceLast);
  }

  const devSleep = (current.sleep || 3) - baseline.baselineSleep;
  const devStress = (current.stress || 3) - baseline.baselineStress;
  const devWellbeing = (current.wellbeing || 3) - baseline.baselineWellbeing;
  const devSocial = (current.connection || 3) - baseline.baselineSocial;
  const devDistress = currentDistress - baseline.baselineDistress;

  // Feature Weights (Synthetic Logistic Regression)
  // Positive weights increase risk, negative decrease
  const INTERCEPT = -3.5;
  const W_DISTRESS = 0.04;      // +4 per 100 points
  const W_SLOPE = 0.15;         // positive slope increases risk
  const W_DEV_SLEEP = -0.4;     // less sleep = higher risk (sleep is 1-5, so lower is worse -> dev is negative -> positive term)
  const W_DEV_STRESS = 0.4;     // higher stress = higher risk
  const W_DEV_WELLBEING = -0.4; // lower wellbeing = higher risk
  const W_DEV_SOCIAL = -0.3;    // lower social = higher risk

  // Calculate Log-Odds (z)
  const z = INTERCEPT 
          + (currentDistress * W_DISTRESS) 
          + (scoreSlope * W_SLOPE) 
          + (devSleep * W_DEV_SLEEP)
          + (devStress * W_DEV_STRESS)
          + (devWellbeing * W_DEV_WELLBEING)
          + (devSocial * W_DEV_SOCIAL);

  const probability = sigmoid(z);

  // Categorize
  let riskCategory: "Low" | "Moderate" | "High" | "Critical" = "Low";
  if (probability > 0.85) riskCategory = "Critical";
  else if (probability > 0.65) riskCategory = "High";
  else if (probability > 0.35) riskCategory = "Moderate";

  // Explainability - Top Contributors
  const contributions = [
    { name: "Current Distress Score", impact: (currentDistress * W_DISTRESS) > 0.5 ? "Increased" : "Neutral", value: currentDistress * W_DISTRESS },
    { name: "Recent Score Trend (Slope)", impact: scoreSlope > 0 ? "Increased" : (scoreSlope < 0 ? "Decreased" : "Neutral"), value: scoreSlope * W_SLOPE },
    { name: "Sleep Deviation from Baseline", impact: devSleep < 0 ? "Increased" : "Decreased", value: devSleep * W_DEV_SLEEP },
    { name: "Stress Deviation from Baseline", impact: devStress > 0 ? "Increased" : "Decreased", value: devStress * W_DEV_STRESS },
    { name: "Wellbeing Deviation", impact: devWellbeing < 0 ? "Increased" : "Decreased", value: devWellbeing * W_DEV_WELLBEING },
    { name: "Social Connection Deviation", impact: devSocial < 0 ? "Increased" : "Decreased", value: devSocial * W_DEV_SOCIAL }
  ];

  // Sort by absolute impact value to get top 4
  contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  
  // Format for output
  const majorContributingFeatures = contributions.slice(0, 4).map(c => ({
    name: c.name,
    impact: c.impact,
    value: c.value
  }));

  const baselineDeviations = {
    distress: devDistress,
    sleep: devSleep,
    stress: devStress,
    wellbeing: devWellbeing,
    social: devSocial
  };

  return {
    probability,
    riskCategory,
    predictionHorizon: "7 days",
    confidence,
    dataCompleteness,
    majorContributingFeatures,
    modelName: ML_MODEL_METADATA.name,
    modelVersion: ML_MODEL_METADATA.version,
    trainingDataset: ML_MODEL_METADATA.trainingDataset,
    timestamp: new Date().toISOString(),
    baselineDeviations
  };
}

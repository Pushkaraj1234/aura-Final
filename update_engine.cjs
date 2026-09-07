const fs = require('fs');
let engine = fs.readFileSync('src/services/recommendationEngine.ts', 'utf8');

const updatedFunc = `export function calculateCheckInAnalysis(
  current: CheckIn,
  previous: CheckIn | null,
  history: CheckIn[] = []
): CheckInAnalysis {
  // If comprehensive AI analysis exists, merge it
  if (current.aiComprehensiveAnalysis) {
    const ai = current.aiComprehensiveAnalysis;
    const factorPercentages = calculateFactorPercentages(current);
    return {
      checkInId: current.id,
      participantId: current.participantId,
      distressScore: ai.distressScore,
      level: ai.level,
      levelLabel: ai.levelLabel,
      previousScore: previous ? (previous.calculatedScore ?? calculateRawScore(previous)) : undefined,
      change: previous ? ai.distressScore - (previous.calculatedScore ?? calculateRawScore(previous)) : undefined,
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
      recommendations: ai.recommendations || [],
      primaryAction: ai.primaryAction,
      supportiveMessage: ai.supportiveMessage,
      requiresHumanReview: ai.distressScore >= 75 || ai.isExplicitSafetyConcern || current.supportRequested,
      isExplicitSafetyConcern: ai.isExplicitSafetyConcern,
      createdAt: current.timestamp || new Date().toISOString()
    };
  }

  // Score is calculated from actual responses`;

engine = engine.replace(`export function calculateCheckInAnalysis(
  current: CheckIn,
  previous: CheckIn | null,
  history: CheckIn[] = []
): CheckInAnalysis {
  // Score is calculated from actual responses`, updatedFunc);

fs.writeFileSync('src/services/recommendationEngine.ts', engine);
console.log("Updated recommendationEngine.ts");

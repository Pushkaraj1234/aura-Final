import { CheckIn, TrajectoryAnalysis, SupportRecommendation, SupportPriority } from "../types";

/**
 * AI Support Recommendation Engine (Humanitarian Decision-Support)
 * 
 * Strict Ethical Principles:
 * 1. NEVER recommend medication.
 * 2. NEVER diagnose any mental-health or medical condition.
 * 3. NEVER recommend psychiatric treatments or clinical protocols autonomously.
 * 4. NEVER automatically contact law enforcement or authorities.
 * 5. ALWAYS require human review for non-routine support recommendations.
 */

/**
 * Nudge a non-urgent recommendation toward how the participant said they'd
 * prefer to be supported. Safety/urgent cases are never softened — those are
 * handled before this runs and skip it entirely.
 */
function applySupportPreference(
  rec: SupportRecommendation,
  preferredSupport?: string | null
): SupportRecommendation {
  const p = (preferredSupport || "").toLowerCase();
  if (!p || rec.priority === "Urgent") return rec;

  // Self-guided / in-app only: lead with resources, mention a counsellor is
  // available on request rather than as the default action.
  if (p.includes("in-app") || p.includes("self-guid") || p.includes("self guided")) {
    return {
      ...rec,
      primaryRecommendation:
        rec.priority === "Routine"
          ? "Share self-guided resources; a counsellor is available if they ask."
          : rec.primaryRecommendation,
      resources: Array.from(new Set(["Self-guided wellbeing & grounding library", ...rec.resources])),
      rationale: `${rec.rationale} Participant prefers in-app / self-guided support.`,
    };
  }

  // Human counsellor: strengthen the counsellor touchpoint.
  if (p.includes("counsel") || p.includes("human")) {
    return {
      ...rec,
      resources: Array.from(new Set(["Direct counsellor check-in", ...rec.resources])),
      rationale: `${rec.rationale} Participant prefers speaking with a human counsellor.`,
    };
  }

  // Trusted person: with consent, involve their nominated contact.
  if (p.includes("trusted") || p.includes("friend") || p.includes("community contact")) {
    return {
      ...rec,
      resources: Array.from(new Set([
        "With the participant's consent, involve their nominated trusted contact",
        ...rec.resources,
      ])),
      rationale: `${rec.rationale} Participant prefers support via a trusted person.`,
    };
  }

  return rec;
}

export const generateSupportRecommendation = (
  currentCheckIn?: CheckIn | null,
  trajectory?: TrajectoryAnalysis | null,
  previousSupportRequestCount: number = 0,
  preferredSupport?: string | null
): SupportRecommendation =>
  applySupportPreference(
    generateBaseRecommendation(currentCheckIn, trajectory, previousSupportRequestCount),
    preferredSupport
  );

const generateBaseRecommendation = (
  currentCheckIn?: CheckIn | null,
  trajectory?: TrajectoryAnalysis | null,
  previousSupportRequestCount: number = 0
): SupportRecommendation => {
  if (!currentCheckIn) {
    return {
      primaryRecommendation: "Awaiting baseline reflection or check-in.",
      priority: "Routine",
      conversationFocus: "Initial voluntary introduction, explaining safety protocols, and setting preferences",
      resources: [
        "AURA Welcome & Safety Guide",
        "Confidentiality and Consent Overview",
        "24/7 Crisis Support Numbers"
      ],
      rationale: "No check-ins have been logged yet for this participant.",
      requiresHumanReview: false
    };
  }

  const traj = trajectory || {
    direction: "stable" as const,
    rateOfChange: 0,
    consecutiveIncreases: 0,
    confidence: "Low" as const,
    category: "Stable Low Distress" as const,
    summaryDescription: "Baseline reflection recorded.",
    currentScore: currentCheckIn.calculatedScore || 30,
    previousScore: null,
    pointsCount: 1,
    recoveringAfterSupport: false
  };

  // Case 1: Immediate safety concern reported directly by participant
  if (currentCheckIn.immediateSafetyConcern || currentCheckIn.safety === "No") {
    return {
      primaryRecommendation: "Follow emergency/safety protocol and seek immediate human assistance.",
      priority: "Urgent",
      conversationFocus: "Immediate physical and emotional safety, grounding, and crisis support access",
      resources: [
        "National 24/7 Crisis Helplines directory",
        "On-site humanitarian welfare officer contact",
        "Guided grounding and immediate safety plan"
      ],
      rationale: "Participant self-reported immediate safety concern or acute distress.",
      requiresHumanReview: true
    };
  }

  // Case 2: Repeated voluntary support requests
  if (currentCheckIn.supportRequested && previousSupportRequestCount >= 1) {
    return {
      primaryRecommendation: "Prioritize human follow-up.",
      priority: "Follow-up Recommended",
      conversationFocus: "Direct counselor check-in regarding recurring support requests",
      resources: [
        "Humanitarian case worker direct messaging",
        "Scheduled 1-on-1 support conversation",
        "Community peer circle"
      ],
      rationale: "Participant has voluntarily requested support across consecutive check-ins.",
      requiresHumanReview: true
    };
  }

  // Case 3: Sudden deterioration or rapid change
  if (traj.category === "Rapid Change" || (traj.previousScore !== null && traj.currentScore - traj.previousScore >= 18)) {
    return {
      primaryRecommendation: "Flag for prompt human review.",
      priority: "Follow-up Recommended",
      conversationFocus: "Recent acute changes in daily routine, environmental factors, or sudden stressors",
      resources: [
        "Counselor review queue",
        "Optional wellbeing check-in scheduling",
        "Environmental safety & shelter support"
      ],
      rationale: `Rapid upward change of +${traj.rateOfChange * 2} pts detected over recent check-ins.`,
      requiresHumanReview: true
    };
  }

  // Case 4: Increasing stress trajectory
  if (currentCheckIn.stress >= 4 || traj.category === "Gradually Increasing") {
    return {
      primaryRecommendation: "Consider a supportive human check-in.",
      priority: "Follow-up Recommended",
      conversationFocus: "Exploring root causes of persistent stress and daily coping strategies",
      resources: [
        "4-4-4 diaphragmatic breathing guide",
        "Community stress management resources",
        "Optional counselor conversation"
      ],
      rationale: `Self-reported stress is elevated (${currentCheckIn.stress}/5) with an upward trajectory.`,
      requiresHumanReview: true
    };
  }

  // Case 5: Severe sleep disruption
  if (currentCheckIn.sleep <= 2) {
    return {
      primaryRecommendation: "Consider discussing wellbeing and available support resources with a trained worker.",
      priority: "Monitor",
      conversationFocus: "Sleep environment, noise/light conditions, and restorative rest routines",
      resources: [
        "Sleep hygiene & night-time relaxation audio",
        "Comfort and shelter assistance inquiry",
        "Community health worker contact"
      ],
      rationale: `Persistent sleep disruption reported (${currentCheckIn.sleep}/5), which can impact emotional resilience.`,
      requiresHumanReview: false
    };
  }

  // Case 6: Reduced social connection / isolation
  if (currentCheckIn.connection <= 2) {
    return {
      primaryRecommendation: "Consider offering connection and community support resources.",
      priority: "Monitor",
      conversationFocus: "Opportunities for community connection, peer groups, or family liaison",
      resources: [
        "Local community center activities",
        "Peer support gathering information",
        "Family communication assistance"
      ],
      rationale: `Participant self-reported feeling isolated (${currentCheckIn.connection}/5).`,
      requiresHumanReview: false
    };
  }

  // Case 7: Explicit single support request
  if (currentCheckIn.supportRequested) {
    return {
      primaryRecommendation: "Schedule voluntary counselor connection.",
      priority: "Follow-up Recommended",
      conversationFocus: "Participant's self-directed questions or requested topic of support",
      resources: [
        "Assigned counselor outreach",
        "Flexible appointment scheduling"
      ],
      rationale: "Participant selected 'Yes, please have a counselor reach out' in check-in.",
      requiresHumanReview: true
    };
  }

  // Case 8: Recovering after support
  if (traj.category === "Recovering After Support") {
    return {
      primaryRecommendation: "Maintain supportive touchpoints and acknowledge recovery.",
      priority: "Routine",
      conversationFocus: "Reinforcing positive strategies and celebrating steady progress",
      resources: [
        "Personal resilience reflection notes",
        "Ongoing voluntary check-in schedule"
      ],
      rationale: "Indicators have consistently improved following previous human intervention.",
      requiresHumanReview: false
    };
  }

  // Default Case: Low concern / stable
  return {
    primaryRecommendation: "Continue voluntary monitoring.",
    priority: "Routine",
    conversationFocus: "Maintaining healthy daily routines and positive baseline",
    resources: [
      "Daily reflection journal",
      "Self-guided wellbeing library",
      "Emergency resources always accessible"
    ],
    rationale: "Distress indicators remain steady within normal baseline variation.",
    requiresHumanReview: false
  };
};

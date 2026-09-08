import { CheckIn, Alert, AlertCategory, AlertSeverity, AlertStatus } from "../types";
import { ALERT_CONFIG } from "./alertConfig";
import { calculateRawScore } from "./riskEngine";

export interface AlertDecision {
  alert: Alert;
  isNewAlert: boolean;
  participantNotification?: {
    title: string;
    message: string;
    severity: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "INFO";
    category: AlertCategory;
  };
  workerNotification?: {
    title: string;
    message: string;
    severity: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "INFO";
    category: AlertCategory;
    actionParticipantId: string;
  };
}

/**
 * Evaluates a single check-in within the participant's historical trajectory.
 * 
 * CORE INTELLIGENCE LOOP:
 * Check-in → Analyze → Detect Change → Classify Signal → Explain Why → Route Notification → Human Review
 */
export function evaluateCheckIn(
  currentCheckIn: CheckIn,
  history: CheckIn[],
  existingAlerts: Alert[] = [],
  participantName?: string
): AlertDecision {
  const currentScore = calculateRawScore(currentCheckIn);
  
  // Previous check-in (excluding the current one if it is already in history)
  const prevCheckIns = history.filter(h => h.id !== currentCheckIn.id && h.timestamp < currentCheckIn.timestamp);
  const previousCheckIn = prevCheckIns.length > 0 ? prevCheckIns[prevCheckIns.length - 1] : null;
  const previousScore = previousCheckIn ? calculateRawScore(previousCheckIn) : null;

  const change = previousScore !== null ? currentScore - previousScore : 0;

  // Multi-check-in trajectory analysis
  const recentScores = [...prevCheckIns.slice(-4).map(c => calculateRawScore(c)), currentScore];
  
  // Consecutive increases count
  let consecutiveIncreases = 0;
  for (let i = recentScores.length - 1; i > 0; i--) {
    if (recentScores[i] > recentScores[i - 1]) {
      consecutiveIncreases++;
    } else {
      break;
    }
  }

  // Consecutive elevated indicators
  let consecutiveElevated = 0;
  for (let i = recentScores.length - 1; i >= 0; i--) {
    if (recentScores[i] > ALERT_CONFIG.MONITORING_MAX) {
      consecutiveElevated++;
    } else {
      break;
    }
  }

  // Extract contributing factor details
  const contributingFactors: string[] = [];
  if (currentCheckIn.stress >= 4) contributingFactors.push("High reported stress (4-5/5)");
  if (currentCheckIn.sleep <= 2) contributingFactors.push("Reported sleep disturbance (1-2/5)");
  if (currentCheckIn.connection <= 2) contributingFactors.push("Low perceived social connection (1-2/5)");
  if (currentCheckIn.wellbeing <= 2) contributingFactors.push("Low overall wellbeing self-rating (1-2/5)");

  // Supplementary reflection language context (Non-diagnostic)
  if (currentCheckIn.reflection?.analysis && currentCheckIn.reflection.analysis.sentiment !== "none") {
    const sentiment = currentCheckIn.reflection.analysis.sentiment;
    if (sentiment === "overwhelmed" || sentiment === "stressed") {
      contributingFactors.push(`Language pattern: ${currentCheckIn.reflection.analysis.languageSignal}`);
    }
  }

  // Trajectory description
  let trajectoryDescription = "Stable";
  if (change >= 10) trajectoryDescription = "Rapid Increase";
  else if (change > 3) trajectoryDescription = "Increasing";
  else if (change <= -10) trajectoryDescription = "Rapid Decrease";
  else if (change < -3) trajectoryDescription = "Decreasing";

  // Decision classification variables
  let category: AlertCategory = "STABLE";
  let severity: AlertSeverity = "GREEN";
  let title = "Stable Wellbeing Signal";
  let description = "Reported indicators reflect low distress within baseline range.";
  let reason = "Self-reported responses are consistent with low distress baseline.";
  let recommendedAction = "Continue voluntary monitoring. No clinical escalation needed.";
  let requiresHumanReview = false;
  let notifyParticipant = false;
  let notifySupportWorker = false;

  // RULE 1: EXPLICIT SAFETY CONCERN (HIGHEST PRIORITY - SEPARATED FROM SCORE)
  // Must distinguish explicit safety concern vs not assessed (missing data is NOT an emergency)
  const explicitSafetyConcernReported = 
    currentCheckIn.immediateSafetyConcern === true ||
    currentCheckIn.safety === "No" ||
    currentCheckIn.safety === "concern";

  if (explicitSafetyConcernReported) {
    category = "SAFETY_CONCERN";
    severity = "RED";
    title = "Priority Safety Review";
    description = "Participant explicitly reported an immediate safety concern or negative safety assessment.";
    reason = currentCheckIn.immediateSafetyConcern 
      ? "Participant explicitly selected immediate safety concern."
      : "Participant reported 'No' to feeling safe in their current environment.";
    recommendedAction = "Counselor priority contact. Provide immediate support resources in-app.";
    requiresHumanReview = true;
    notifyParticipant = true;
    notifySupportWorker = true;
  }
  // RULE 2: EXPLICIT SUPPORT REQUEST (INDEPENDENT OF SCORE)
  else if (currentCheckIn.supportRequested) {
    category = "SUPPORT_REQUEST";
    severity = currentScore > ALERT_CONFIG.HIGH_MAX ? "RED" : currentScore > ALERT_CONFIG.ELEVATED_MAX ? "ORANGE" : "YELLOW";
    title = "Support Request Received";
    description = `Participant voluntarily requested counselor support (Current indicator: ${currentScore}/100).`;
    reason = "Participant explicitly checked 'I would like support from a counselor/worker'.";
    recommendedAction = "Review case details and connect with participant through preferred support channel.";
    requiresHumanReview = true;
    notifyParticipant = true;
    notifySupportWorker = true;
  }
  // RULE 3: VERY HIGH INDICATOR (86-100) -> PRIORITY HUMAN REVIEW
  else if (currentScore > ALERT_CONFIG.HIGH_MAX) {
    category = "PRIORITY";
    severity = "RED";
    title = "Priority Wellbeing Signal";
    description = `Very high reported distress indicator (${currentScore}/100).`;
    reason = `Reported distress indicator reached ${currentScore}/100. Factors: ${contributingFactors.join(", ") || "Elevated multi-domain distress"}.`;
    recommendedAction = "Priority human review recommended. Counselor should evaluate recent trajectory and contact preferences.";
    requiresHumanReview = true;
    notifyParticipant = false; // Do not alarm participant with RED labels
    notifySupportWorker = true;
  }
  // RULE 4: HIGH INDICATOR (71-85) -> HUMAN REVIEW RECOMMENDED
  else if (currentScore > ALERT_CONFIG.ELEVATED_MAX) {
    category = "HIGH";
    severity = "ORANGE";
    title = "Human Review Recommended";
    description = `High reported distress indicator (${currentScore}/100).`;
    reason = `Reported distress indicator is ${currentScore}/100. Factors: ${contributingFactors.join(", ") || "Elevated stress/sleep indicators"}.`;
    recommendedAction = "Human review recommended. Check-in history and trends should be evaluated by support team.";
    requiresHumanReview = true;
    notifyParticipant = false;
    notifySupportWorker = true;
  }
  // RULE 5: PERSISTENT WORSENING (3+ consecutive increases)
  else if (consecutiveIncreases >= ALERT_CONFIG.PERSISTENT_INCREASE_COUNT && change > 0) {
    category = "PERSISTENT_INCREASE";
    severity = currentScore > ALERT_CONFIG.MONITORING_MAX ? "ORANGE" : "YELLOW";
    title = "Persistent Upward Trajectory";
    description = `${consecutiveIncreases} consecutive check-ins show increasing reported distress indicators (Currently ${currentScore}/100).`;
    reason = `Sustained upward movement detected across ${consecutiveIncreases} recent check-ins (+${change} pts on latest).`;
    recommendedAction = "Human review recommended to verify if early intervention or proactive support is helpful.";
    requiresHumanReview = true;
    notifyParticipant = false;
    notifySupportWorker = true;
  }
  // RULE 6: SUDDEN CHANGE DETECTION (>= 15 pts jump, even from low scores e.g. 20 -> 45)
  else if (change >= ALERT_CONFIG.SUDDEN_CHANGE_THRESHOLD) {
    category = "EARLY_WARNING";
    severity = currentScore > ALERT_CONFIG.MONITORING_MAX ? "ORANGE" : "YELLOW";
    title = "Early-Warning Signal (Rapid Change)";
    description = `Reported distress indicators increased rapidly by +${change} points (${previousScore} → ${currentScore}).`;
    reason = `Sudden upward shift of ${change} points from previous check-in. Significant change detected.`;
    recommendedAction = "Human review may be appropriate to assess recent environmental or emotional triggers.";
    requiresHumanReview = true;
    notifyParticipant = true; // Calm notification
    notifySupportWorker = true;
  }
  // RULE 7: ELEVATED / PERSISTENT ELEVATED (41-70)
  else if (currentScore > ALERT_CONFIG.MONITORING_MAX) {
    if (consecutiveElevated >= ALERT_CONFIG.PERSISTENT_ELEVATED_COUNT) {
      category = "ELEVATED";
      severity = "YELLOW";
      title = "Persistent Elevated Signal";
      description = `Participant remains in elevated distress range across ${consecutiveElevated} consecutive check-ins (${currentScore}/100).`;
      reason = `Distress indicator has remained elevated (>40) for ${consecutiveElevated} consecutive check-ins.`;
      recommendedAction = "Monitoring active. Consider reaching out if participant expressed support interest.";
      requiresHumanReview = true;
      notifyParticipant = false;
      notifySupportWorker = true;
    } else {
      category = "MONITORING";
      severity = "YELLOW";
      title = "Monitoring Status Updated";
      description = `Elevated wellbeing/distress indicator (${currentScore}/100).`;
      reason = `Score (${currentScore}/100) sits in elevated monitoring range. Factors: ${contributingFactors.join(", ") || "General strain"}.`;
      recommendedAction = "Encourage another voluntary check-in. Offer support options in-app.";
      requiresHumanReview = false;
      notifyParticipant = true;
      notifySupportWorker = false;
    }
  }
  // RULE 8: MEANINGFUL IMPROVEMENT / RECOVERY (Drop of >= 10 pts, especially reaching <= 15 or following support)
  else if (previousScore !== null && change <= -ALERT_CONFIG.IMPROVEMENT_DROP_THRESHOLD) {
    const isMajorRecovery = previousScore > ALERT_CONFIG.ELEVATED_MAX && currentScore <= ALERT_CONFIG.MONITORING_MAX;
    category = isMajorRecovery ? "RECOVERY" : "IMPROVEMENT";
    severity = "GREEN";
    title = isMajorRecovery ? "Improvement Detected After Support" : "Improvement Detected";
    description = `Reported distress indicator decreased significantly by ${Math.abs(change)} points (${previousScore} → ${currentScore}).`;
    reason = `Downward trajectory detected (-${Math.abs(change)} pts). Self-reported distress is lower than previous check-in.`;
    recommendedAction = "Acknowledge progress in dashboard. Continue voluntary monitoring.";
    requiresHumanReview = false;
    notifyParticipant = true;
    notifySupportWorker = isMajorRecovery; // Counselor is notified of positive outcome
  }
  // RULE 9: NORMAL MONITORING (16-40)
  else if (currentScore > ALERT_CONFIG.LOW_DISTRESS_MAX) {
    category = "MONITORING";
    severity = "GREEN";
    title = "Routine Monitoring";
    description = `Reported distress indicator is ${currentScore}/100 (Normal monitoring range).`;
    reason = "Indicator falls within normal baseline fluctuation range.";
    recommendedAction = "No escalation required. Next voluntary check-in available anytime.";
    requiresHumanReview = false;
    notifyParticipant = false;
    notifySupportWorker = false;
  }
  // RULE 10: STABLE / LOW DISTRESS (0-15)
  else {
    category = "STABLE";
    severity = "GREEN";
    title = "Stable / Low Reported Distress";
    description = `Low reported distress indicator (${currentScore}/100).`;
    reason = "Responses reflect calm, low-distress baseline.";
    recommendedAction = "No action needed. Voluntary check-in available.";
    requiresHumanReview = false;
    notifyParticipant = false;
    notifySupportWorker = false;
  }

  // DEDUPLICATION & GROUPING LOGIC
  // Check if an existing open alert with the same category exists for this participant within the deduplication window
  const now = new Date().toISOString();
  const existingSameCategoryAlert = existingAlerts.find(
    a => a.participantId === currentCheckIn.participantId &&
         a.category === category &&
         (a.status === "NEW" || a.status === "ACKNOWLEDGED" || a.status === "pending_review" || a.status === "IN_REVIEW")
  );

  let finalAlert: Alert;
  let isNewAlert = true;

  if (existingSameCategoryAlert) {
    isNewAlert = false;
    finalAlert = {
      ...existingSameCategoryAlert,
      updatedAt: now,
      occurrenceCount: (existingSameCategoryAlert.occurrenceCount || 1) + 1,
      score: currentScore,
      changeDelta: change,
      reason,
      description,
      contributingFactors,
      trajectory: trajectoryDescription
    };
  } else {
    finalAlert = {
      id: `alt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      participantId: currentCheckIn.participantId,
      category,
      severity,
      title,
      description,
      reason,
      recommendedAction,
      status: "NEW",
      createdAt: now,
      updatedAt: now,
      occurrenceCount: 1,
      score: currentScore,
      changeDelta: change,
      contributingFactors,
      trajectory: trajectoryDescription,
      requiresHumanReview,
      notifyParticipant,
      notifySupportWorker
    };
  }

  // Generate participant notification (Calm, non-alarming, empathetic)
  let participantNotification: AlertDecision["participantNotification"];
  if (category === "SAFETY_CONCERN") {
    participantNotification = {
      title: "Immediate Support Resources",
      message: "Your response indicates that you may not feel safe right now. Please use the available immediate support and emergency resources.",
      severity: "RED",
      category: "SAFETY_CONCERN"
    };
  } else if (category === "SUPPORT_REQUEST") {
    participantNotification = {
      title: "Support Request Recorded",
      message: "You requested support. Your selected support option has been recorded and shared with your support team.",
      severity: "YELLOW",
      category: "SUPPORT_REQUEST"
    };
  } else if (category === "IMPROVEMENT" || category === "RECOVERY") {
    participantNotification = {
      title: "Improvement Detected",
      message: `Your recent check-in shows a lower distress indicator (${currentScore}/100) than your previous check-in (${previousScore}/100).`,
      severity: "GREEN",
      category: "IMPROVEMENT"
    };
  } else if (category === "EARLY_WARNING" || category === "MONITORING" || category === "ELEVATED") {
    participantNotification = {
      title: "Wellbeing Check-in Recorded",
      message: "Your recent check-in shows some changes in how you're feeling. You can connect with support options whenever you are ready.",
      severity: "INFO",
      category: "MONITORING"
    };
  }

  // Generate counselor notification (Actionable, transparent, clinical context)
  let workerNotification: AlertDecision["workerNotification"];
  if (notifySupportWorker) {
    const who = participantName && participantName.trim() ? participantName.trim() : `Participant ${currentCheckIn.participantId.slice(0, 8)}`;
    const workerMsg = `${who} — Current indicator: ${currentScore}/100 (${trajectoryDescription}, change: ${change >= 0 ? "+" : ""}${change} pts). ${reason}`;
    workerNotification = {
      title: `${title} — ${who}`,
      message: workerMsg,
      severity: severity === "RED" ? "RED" : severity === "ORANGE" ? "ORANGE" : "YELLOW",
      category,
      actionParticipantId: currentCheckIn.participantId
    };
  }

  return {
    alert: finalAlert,
    isNewAlert,
    participantNotification,
    workerNotification
  };
}

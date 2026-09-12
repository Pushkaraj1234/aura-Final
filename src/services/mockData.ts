import { Participant, CheckIn, Alert, DemoScenario, SomaticSymptom } from "../types";
import { calculateRawScore } from "./riskEngine";

const createTimestamp = (daysAgo: number, hour = 10, minute = 30) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const MOCK_PARTICIPANTS: Participant[] = [
  {
    id: "P-1042",
    consentGiven: true,
    createdAt: createTimestamp(21),
    preferredSupport: "Human counselor",
    language: "English",
    ageGroup: "25-34",
    status: "Needs follow-up",
    assignedWorker: "Sarah Jenkins, MSW",
    lastReviewDate: createTimestamp(1),
    notes: [
      {
        id: "n-1",
        author: "Sarah Jenkins, MSW",
        timestamp: createTimestamp(1, 14, 20),
        text: "Participant noted increased difficulty with nighttime noise and feeling overwhelmed during morning commute. Scheduled voluntary check-in call for tomorrow.",
        actionTaken: "Scheduled 1-on-1 counseling check-in"
      }
    ],
    checkIns: [
      { id: "c-1042-1", participantId: "P-1042", timestamp: createTimestamp(6), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1042-2", participantId: "P-1042", timestamp: createTimestamp(5), wellbeing: 4, stress: 2, sleep: 4, safety: "Mostly", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1042-3", participantId: "P-1042", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1042-4", participantId: "P-1042", timestamp: createTimestamp(3), wellbeing: 3, stress: 4, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1042-5", participantId: "P-1042", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1042-6", participantId: "P-1042", timestamp: createTimestamp(1), wellbeing: 2, stress: 5, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      // Openly struggling and asking for help. The behavioural answers agree
      // with the self-report, so this person belongs in the ordinary priority
      // queue and must NOT also appear under "worth a second look" — nothing
      // here is hidden.
      {
        id: "c-1042-7", participantId: "P-1042", timestamp: createTimestamp(0, 9, 15),
        wellbeing: 1, stress: 5, sleep: 1, safety: "No", connection: 1,
        supportRequested: true, immediateSafetyConcern: false,
        functional: {
          sleepHours: 3,
          mealsYesterday: 1,
          leftHome: false,
          spokeToAnyone: false,
          somaticSymptoms: ["exhaustion"] as SomaticSymptom[]
        },
        responseMeta: { completionSeconds: 132, privateSpace: true }
      }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1047",
    consentGiven: true,
    createdAt: createTimestamp(30),
    preferredSupport: "In-app support information",
    language: "Español",
    ageGroup: "35-44",
    status: "Improving",
    assignedWorker: "Elena Alvarez",
    notes: [
      {
        id: "n-2",
        author: "Elena Alvarez",
        timestamp: createTimestamp(3, 11, 0),
        text: "Participant reported good engagement with community peer group. Sleep duration improved significantly.",
        actionTaken: "Continued weekly check-in monitoring"
      }
    ],
    checkIns: [
      { id: "c-1047-1", participantId: "P-1047", timestamp: createTimestamp(6), wellbeing: 2, stress: 5, sleep: 1, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1047-2", participantId: "P-1047", timestamp: createTimestamp(5), wellbeing: 2, stress: 4, sleep: 2, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1047-3", participantId: "P-1047", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1047-4", participantId: "P-1047", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Yes", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1047-5", participantId: "P-1047", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1047-6", participantId: "P-1047", timestamp: createTimestamp(1), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      // Reports a complete recovery — 5/5, feels safe, wants no support — while
      // every behavioural answer says otherwise. This is the case the distress
      // score cannot see: it is low precisely because they said so. Seeded here
      // so the second-look queue is demonstrable without waiting for real data.
      {
        id: "c-1047-7", participantId: "P-1047", timestamp: createTimestamp(0, 10, 20),
        wellbeing: 5, stress: 1, sleep: 5, safety: "Yes", connection: 5,
        supportRequested: false, immediateSafetyConcern: false,
        functional: {
          sleepHours: 3,
          mealsYesterday: 1,
          leftHome: false,
          spokeToAnyone: false,
          somaticSymptoms: ["headaches", "exhaustion", "appetite_change"] as SomaticSymptom[]
        },
        responseMeta: { completionSeconds: 74, privateSpace: true }
      }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1053",
    consentGiven: true,
    createdAt: createTimestamp(14),
    preferredSupport: "Human counselor",
    language: "العربية",
    ageGroup: "18-24",
    status: "Urgent safety signal",
    assignedWorker: "Tariq Mansoor, LSW",
    notes: [
      {
        id: "n-3",
        author: "Tariq Mansoor, LSW",
        timestamp: createTimestamp(0, 8, 45),
        text: "URGENT SAFETY FLAG: Participant self-reported acute immediate safety concern. Emergency protocol initiated. Direct outreach conducted by humanitarian team.",
        actionTaken: "Immediate human contact & safe housing referral"
      }
    ],
    checkIns: [
      { id: "c-1053-1", participantId: "P-1053", timestamp: createTimestamp(5), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1053-2", participantId: "P-1053", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1053-3", participantId: "P-1053", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1053-4", participantId: "P-1053", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1053-5", participantId: "P-1053", timestamp: createTimestamp(1), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1053-6", participantId: "P-1053", timestamp: createTimestamp(0, 8, 30), wellbeing: 1, stress: 5, sleep: 1, safety: "No", connection: 1, supportRequested: true, immediateSafetyConcern: true }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1061",
    consentGiven: true,
    createdAt: createTimestamp(45),
    preferredSupport: "Human counselor",
    language: "English",
    ageGroup: "45+",
    status: "Improving",
    assignedWorker: "Sarah Jenkins, MSW",
    notes: [],
    checkIns: [
      { id: "c-1061-1", participantId: "P-1061", timestamp: createTimestamp(6), wellbeing: 2, stress: 4, sleep: 2, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1061-2", participantId: "P-1061", timestamp: createTimestamp(5), wellbeing: 3, stress: 4, sleep: 2, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1061-3", participantId: "P-1061", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1061-4", participantId: "P-1061", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1061-5", participantId: "P-1061", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1061-6", participantId: "P-1061", timestamp: createTimestamp(1), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1061-7", participantId: "P-1061", timestamp: createTimestamp(0, 11, 45), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1068",
    consentGiven: true,
    createdAt: createTimestamp(18),
    preferredSupport: "In-app support information",
    language: "Français",
    ageGroup: "25-34",
    status: "Needs follow-up",
    assignedWorker: "Elena Alvarez",
    notes: [],
    checkIns: [
      { id: "c-1068-1", participantId: "P-1068", timestamp: createTimestamp(5), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1068-2", participantId: "P-1068", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 2, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1068-3", participantId: "P-1068", timestamp: createTimestamp(3), wellbeing: 3, stress: 4, sleep: 1, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1068-4", participantId: "P-1068", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 1, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1068-5", participantId: "P-1068", timestamp: createTimestamp(1), wellbeing: 2, stress: 4, sleep: 1, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1068-6", participantId: "P-1068", timestamp: createTimestamp(0, 7, 30), wellbeing: 2, stress: 5, sleep: 1, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1074",
    consentGiven: true,
    createdAt: createTimestamp(10),
    preferredSupport: "Human counselor",
    language: "English",
    ageGroup: "18-24",
    status: "Human review pending",
    assignedWorker: "Sarah Jenkins, MSW",
    notes: [],
    checkIns: [
      { id: "c-1074-1", participantId: "P-1074", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1074-2", participantId: "P-1074", timestamp: createTimestamp(3), wellbeing: 3, stress: 4, sleep: 2, safety: "Mostly", connection: 3, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1074-3", participantId: "P-1074", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1074-4", participantId: "P-1074", timestamp: createTimestamp(1), wellbeing: 2, stress: 5, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1074-5", participantId: "P-1074", timestamp: createTimestamp(0, 9, 45), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1082",
    consentGiven: true,
    createdAt: createTimestamp(60),
    preferredSupport: "Human counselor",
    language: "Українська",
    ageGroup: "35-44",
    status: "Stable",
    notes: [],
    checkIns: [
      { id: "c-1082-1", participantId: "P-1082", timestamp: createTimestamp(5), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1082-2", participantId: "P-1082", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1082-3", participantId: "P-1082", timestamp: createTimestamp(3), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1082-4", participantId: "P-1082", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 3, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1082-5", participantId: "P-1082", timestamp: createTimestamp(1), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1082-6", participantId: "P-1082", timestamp: createTimestamp(0, 10, 10), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1089",
    consentGiven: true,
    createdAt: createTimestamp(90),
    preferredSupport: "In-app support information",
    language: "English",
    ageGroup: "25-34",
    status: "Stable",
    notes: [],
    checkIns: [
      { id: "c-1089-1", participantId: "P-1089", timestamp: createTimestamp(4), wellbeing: 5, stress: 1, sleep: 5, safety: "Yes", connection: 5, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1089-2", participantId: "P-1089", timestamp: createTimestamp(3), wellbeing: 5, stress: 2, sleep: 4, safety: "Yes", connection: 5, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1089-3", participantId: "P-1089", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 5, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1089-4", participantId: "P-1089", timestamp: createTimestamp(1), wellbeing: 5, stress: 1, sleep: 5, safety: "Yes", connection: 5, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1089-5", participantId: "P-1089", timestamp: createTimestamp(0, 12, 0), wellbeing: 5, stress: 1, sleep: 5, safety: "Yes", connection: 5, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1093",
    consentGiven: true,
    createdAt: createTimestamp(12),
    preferredSupport: "Human counselor",
    language: "Español",
    ageGroup: "25-34",
    status: "Needs follow-up",
    assignedWorker: "Elena Alvarez",
    notes: [],
    checkIns: [
      { id: "c-1093-1", participantId: "P-1093", timestamp: createTimestamp(5), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1093-2", participantId: "P-1093", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1093-3", participantId: "P-1093", timestamp: createTimestamp(3), wellbeing: 3, stress: 4, sleep: 2, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1093-4", participantId: "P-1093", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1093-5", participantId: "P-1093", timestamp: createTimestamp(1), wellbeing: 2, stress: 5, sleep: 1, safety: "No", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1093-6", participantId: "P-1093", timestamp: createTimestamp(0, 11, 10), wellbeing: 2, stress: 5, sleep: 1, safety: "No", connection: 2, supportRequested: true, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1102",
    consentGiven: true,
    createdAt: createTimestamp(40),
    preferredSupport: "Human counselor",
    language: "English",
    ageGroup: "35-44",
    status: "Improving",
    assignedWorker: "Sarah Jenkins, MSW",
    notes: [
      {
        id: "n-4",
        author: "Sarah Jenkins, MSW",
        timestamp: createTimestamp(2, 16, 0),
        text: "Completed supportive conversation regarding family reunification progress. Participant reported feeling heard and grounded.",
        actionTaken: "Post-counseling stabilization verified"
      }
    ],
    checkIns: [
      { id: "c-1102-1", participantId: "P-1102", timestamp: createTimestamp(6), wellbeing: 1, stress: 5, sleep: 1, safety: "Unsure", connection: 1, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1102-2", participantId: "P-1102", timestamp: createTimestamp(5), wellbeing: 2, stress: 5, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1102-3", participantId: "P-1102", timestamp: createTimestamp(4), wellbeing: 2, stress: 4, sleep: 2, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1102-4", participantId: "P-1102", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1102-5", participantId: "P-1102", timestamp: createTimestamp(2), wellbeing: 3, stress: 3, sleep: 3, safety: "Yes", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1102-6", participantId: "P-1102", timestamp: createTimestamp(1), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1102-7", participantId: "P-1102", timestamp: createTimestamp(0, 13, 0), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1115",
    consentGiven: true,
    createdAt: createTimestamp(25),
    preferredSupport: "Human counselor",
    language: "العربية",
    ageGroup: "18-24",
    status: "Needs follow-up",
    assignedWorker: "Tariq Mansoor, LSW",
    notes: [],
    checkIns: [
      { id: "c-1115-1", participantId: "P-1115", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1115-2", participantId: "P-1115", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1115-3", participantId: "P-1115", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 2, safety: "Mostly", connection: 1, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1115-4", participantId: "P-1115", timestamp: createTimestamp(1), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 1, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1115-5", participantId: "P-1115", timestamp: createTimestamp(0, 10, 40), wellbeing: 2, stress: 5, sleep: 2, safety: "Unsure", connection: 1, supportRequested: true, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1124",
    consentGiven: true,
    createdAt: createTimestamp(50),
    preferredSupport: "In-app support information",
    language: "English",
    ageGroup: "45+",
    status: "Stable",
    notes: [],
    checkIns: [
      { id: "c-1124-1", participantId: "P-1124", timestamp: createTimestamp(5), wellbeing: 4, stress: 2, sleep: 3, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1124-2", participantId: "P-1124", timestamp: createTimestamp(4), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1124-3", participantId: "P-1124", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1124-4", participantId: "P-1124", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1124-5", participantId: "P-1124", timestamp: createTimestamp(1), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1124-6", participantId: "P-1124", timestamp: createTimestamp(0, 11, 30), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1128",
    consentGiven: true,
    createdAt: createTimestamp(15),
    preferredSupport: "Human counselor",
    language: "हिन्दी",
    ageGroup: "25-34",
    status: "Needs follow-up",
    assignedWorker: "Sarah Jenkins, MSW",
    notes: [],
    checkIns: [
      { id: "c-1128-1", participantId: "P-1128", timestamp: createTimestamp(5), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1128-2", participantId: "P-1128", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1128-3", participantId: "P-1128", timestamp: createTimestamp(3), wellbeing: 3, stress: 4, sleep: 2, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1128-4", participantId: "P-1128", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 1, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1128-5", participantId: "P-1128", timestamp: createTimestamp(0, 10, 0), wellbeing: 2, stress: 5, sleep: 1, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1131",
    consentGiven: true,
    createdAt: createTimestamp(35),
    preferredSupport: "Human counselor",
    language: "मराठी",
    ageGroup: "35-44",
    status: "Improving",
    assignedWorker: "Elena Alvarez",
    notes: [
      {
        id: "n-5",
        author: "Elena Alvarez",
        timestamp: createTimestamp(2, 12, 0),
        text: "Participant attended breathing workshop. Stress down from 5 to 2.",
        actionTaken: "Completed outcome reflection"
      }
    ],
    checkIns: [
      { id: "c-1131-1", participantId: "P-1131", timestamp: createTimestamp(5), wellbeing: 2, stress: 5, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1131-2", participantId: "P-1131", timestamp: createTimestamp(4), wellbeing: 2, stress: 4, sleep: 2, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1131-3", participantId: "P-1131", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1131-4", participantId: "P-1131", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1131-5", participantId: "P-1131", timestamp: createTimestamp(0, 9, 30), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1134",
    consentGiven: true,
    createdAt: createTimestamp(20),
    preferredSupport: "Human counselor",
    language: "English",
    ageGroup: "18-24",
    status: "Human review pending",
    assignedWorker: "Tariq Mansoor, LSW",
    notes: [],
    checkIns: [
      { id: "c-1134-1", participantId: "P-1134", timestamp: createTimestamp(5), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1134-2", participantId: "P-1134", timestamp: createTimestamp(4), wellbeing: 2, stress: 5, sleep: 1, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1134-3", participantId: "P-1134", timestamp: createTimestamp(3), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1134-4", participantId: "P-1134", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 2, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1134-5", participantId: "P-1134", timestamp: createTimestamp(0, 11, 0), wellbeing: 3, stress: 4, sleep: 2, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1137",
    consentGiven: true,
    createdAt: createTimestamp(70),
    preferredSupport: "In-app support information",
    language: "Español",
    ageGroup: "45+",
    status: "Stable",
    notes: [],
    checkIns: [
      { id: "c-1137-1", participantId: "P-1137", timestamp: createTimestamp(4), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1137-2", participantId: "P-1137", timestamp: createTimestamp(3), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1137-3", participantId: "P-1137", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1137-4", participantId: "P-1137", timestamp: createTimestamp(0, 14, 0), wellbeing: 5, stress: 1, sleep: 5, safety: "Yes", connection: 5, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1140",
    consentGiven: true,
    createdAt: createTimestamp(10),
    preferredSupport: "Human counselor",
    language: "English",
    ageGroup: "25-34",
    status: "Needs follow-up",
    assignedWorker: "Sarah Jenkins, MSW",
    notes: [],
    checkIns: [
      { id: "c-1140-1", participantId: "P-1140", timestamp: createTimestamp(4), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1140-2", participantId: "P-1140", timestamp: createTimestamp(3), wellbeing: 3, stress: 4, sleep: 2, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1140-3", participantId: "P-1140", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, immediateSafetyConcern: false },
      { id: "c-1140-4", participantId: "P-1140", timestamp: createTimestamp(0, 10, 15), wellbeing: 2, stress: 5, sleep: 1, safety: "Unsure", connection: 1, supportRequested: true, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1143",
    consentGiven: true,
    createdAt: createTimestamp(45),
    preferredSupport: "Human counselor",
    language: "Français",
    ageGroup: "35-44",
    status: "Improving",
    notes: [],
    checkIns: [
      { id: "c-1143-1", participantId: "P-1143", timestamp: createTimestamp(4), wellbeing: 2, stress: 4, sleep: 2, safety: "Mostly", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1143-2", participantId: "P-1143", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1143-3", participantId: "P-1143", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1143-4", participantId: "P-1143", timestamp: createTimestamp(0, 12, 30), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1147",
    consentGiven: true,
    createdAt: createTimestamp(8),
    preferredSupport: "Human counselor",
    language: "العربية",
    ageGroup: "18-24",
    status: "Needs follow-up",
    assignedWorker: "Tariq Mansoor, LSW",
    notes: [],
    checkIns: [
      { id: "c-1147-1", participantId: "P-1147", timestamp: createTimestamp(3), wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1147-2", participantId: "P-1147", timestamp: createTimestamp(2), wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1147-3", participantId: "P-1147", timestamp: createTimestamp(0, 11, 45), wellbeing: 2, stress: 5, sleep: 1, safety: "No", connection: 2, supportRequested: true, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  },
  {
    id: "P-1150",
    consentGiven: true,
    createdAt: createTimestamp(80),
    preferredSupport: "In-app support information",
    language: "English",
    ageGroup: "45+",
    status: "Stable",
    notes: [],
    checkIns: [
      { id: "c-1150-1", participantId: "P-1150", timestamp: createTimestamp(3), wellbeing: 5, stress: 1, sleep: 5, safety: "Yes", connection: 5, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1150-2", participantId: "P-1150", timestamp: createTimestamp(2), wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, immediateSafetyConcern: false },
      { id: "c-1150-3", participantId: "P-1150", timestamp: createTimestamp(0, 13, 15), wellbeing: 5, stress: 1, sleep: 5, safety: "Yes", connection: 5, supportRequested: false, immediateSafetyConcern: false }
    ].map(c => ({ ...c, calculatedScore: calculateRawScore(c) }))
  }
];

export const INITIAL_ALERTS: Alert[] = [
  {
    id: "alt-101",
    participantId: "P-1053",
    severity: "urgent",
    reason: "Urgent safety alert reported by participant during voluntary check-in questionnaire.",
    createdAt: createTimestamp(0, 8, 30),
    status: "escalated",
    assignedTo: "Tariq Mansoor, LSW",
    score: 100,
    changeDelta: 38
  },
  {
    id: "alt-102",
    participantId: "P-1042",
    severity: "elevated",
    reason: "Distress indicators increased by +26 points over 4 consecutive check-ins; participant requested support.",
    createdAt: createTimestamp(0, 9, 15),
    status: "pending_review",
    assignedTo: "Sarah Jenkins, MSW",
    score: 84,
    changeDelta: 26
  },
  {
    id: "alt-103",
    participantId: "P-1068",
    severity: "elevated",
    reason: "Severe sleep disruption (1/5) across last 4 check-ins accompanied by elevated stress (+18 pts).",
    createdAt: createTimestamp(0, 7, 30),
    status: "pending_review",
    assignedTo: "Elena Alvarez",
    score: 76,
    changeDelta: 18
  },
  {
    id: "alt-104",
    participantId: "P-1093",
    severity: "elevated",
    reason: "Environmental safety concern reported (Unsafe housing) with direct support request.",
    createdAt: createTimestamp(0, 11, 10),
    status: "pending_review",
    assignedTo: "Elena Alvarez",
    score: 79,
    changeDelta: 22
  },
  {
    id: "alt-105",
    participantId: "P-1115",
    severity: "moderate",
    reason: "Severe social isolation reported alongside increase in perceived daily stress.",
    createdAt: createTimestamp(0, 10, 40),
    status: "reviewed",
    assignedTo: "Tariq Mansoor, LSW",
    humanDecision: "follow_up_scheduled",
    decisionNotes: "Reviewed self-reported factors. Scheduled a culturally adapted peer group connection call.",
    reviewedAt: createTimestamp(0, 11, 0),
    reviewedBy: "Tariq Mansoor, LSW",
    score: 72,
    changeDelta: 15
  },
  {
    id: "alt-106",
    participantId: "P-1128",
    severity: "elevated",
    reason: "Rapid sleep deterioration from 4/5 down to 1/5 with self-reported tension (+22 pts).",
    createdAt: createTimestamp(0, 10, 0),
    status: "pending_review",
    assignedTo: "Sarah Jenkins, MSW",
    score: 80,
    changeDelta: 22
  },
  {
    id: "alt-107",
    participantId: "P-1147",
    severity: "urgent",
    reason: "Environmental safety loss reported in new shelter zone with direct counselor contact request.",
    createdAt: createTimestamp(0, 11, 45),
    status: "escalated",
    assignedTo: "Tariq Mansoor, LSW",
    score: 88,
    changeDelta: 31
  }
];

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "scenario-escalating",
    title: "1. Escalating Distress Signal",
    description: "Demonstrates dynamic multi-day tracking detecting gradual distress rise (32% -> 84%) and flagging for proactive counselor follow-up.",
    targetParticipantId: "P-1042",
    badge: "Rising Trend (+26 pts)",
    accent: "text-[#D49B6A] bg-[#D49B6A]/10 border-[#D49B6A]/30",
    simulatedTrend: [32, 36, 44, 53, 64, 75, 84]
  },
  {
    id: "scenario-improving",
    title: "2. Post-Support Recovery",
    description: "Illustrates positive downward trajectory (86% -> 28%) following humanitarian check-in and stabilization assistance.",
    targetParticipantId: "P-1047",
    badge: "Recovery (-58 pts)",
    accent: "text-[#5A5049] bg-[#DBC3B2]/20 border-[#DBC3B2]/40",
    simulatedTrend: [86, 74, 62, 51, 40, 32, 28]
  },
  {
    id: "scenario-sudden-spike",
    title: "3. Sudden Acute Spike",
    description: "Demonstrates detection of a rapid 48-hour spike (+35 pts) driven by sudden environmental displacement and sleep disruption.",
    targetParticipantId: "P-1093",
    badge: "Sudden Spike (+35 pts)",
    accent: "text-[#A55D25] bg-[#A55D25]/10 border-[#A55D25]/30",
    simulatedTrend: [28, 30, 31, 35, 70, 79]
  },
  {
    id: "scenario-safety-interception",
    title: "4. Urgent Safety Interception",
    description: "Demonstrates immediate crisis workflow redirection and humanitarian emergency protocol without clinical diagnosis.",
    targetParticipantId: "P-1053",
    badge: "Emergency Intercept",
    accent: "text-[#A55D25] bg-[#A55D25]/15 border-[#A55D25]/40",
    simulatedTrend: [35, 38, 42, 60, 100]
  },
  {
    id: "scenario-stable",
    title: "5. Stable Routine Monitoring",
    description: "Demonstrates baseline steady-state wellbeing with no unnecessary alerts or counselor burden.",
    targetParticipantId: "P-1089",
    badge: "Stable Routine",
    accent: "text-[#5A5049] bg-[#DBC3B2]/15 border-[#DBC3B2]/30",
    simulatedTrend: [18, 22, 20, 19, 18]
  }
];

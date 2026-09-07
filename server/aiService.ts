import { GoogleGenAI, Type, Schema } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

const GEMINI_FLASH_MODEL = "gemini-2.5-flash";

// ============================================================================
// Trauma-informed screening taxonomy
// Adapted from the humanitarian distress-screening reference pipeline:
// caseworker decision support only — never a diagnosis, always human-reviewed.
// ============================================================================

const TRAUMA_INDICATORS = [
  "physical_violence",
  "sexual_violence",
  "death_or_loss",
  "forced_displacement",
  "torture",
  "witnessing_atrocity",
  "psychological_abuse",
  "none_detected",
] as const;

const DISTRESS_SIGNALS = [
  "intrusive_memories",
  "hypervigilance",
  "emotional_numbing",
  "dissociation",
  "hopelessness",
  "sleep_disturbance",
  "survivor_guilt",
  "social_withdrawal",
  "none_detected",
] as const;

const SCREENING_SYSTEM_PROMPT = `You are a clinical-research assistant supporting caseworkers who work with survivors of atrocities \
(genocide, war crimes, torture, mass violence, forced displacement). You analyze one piece of free text (or a description \
of a spoken reflection) and produce a structured, cautious screening signal to help a human decide what to prioritize. \
You do not diagnose and you do not replace clinical judgment.

Ground your assessment in the APA definition of psychological trauma: exposure to actual or threatened death, serious \
injury, sexual violence, torture, or severe psychological abuse, whether directly experienced or witnessed, including \
harm to a close family member or friend.

Rules:
- Do NOT diagnose any mental health condition (no PTSD, depression, psychosis, or other DSM/ICD labels).
- Do NOT invent facts. Rely solely on the provided text/context.
- If the text is ambiguous, mark uncertainty/low confidence rather than overstating.
- Always cite the specific language that drove your assessment in the rationale.`;

// Deterministic safety net — never rely on the LLM alone for imminent-risk detection.
export const checkUrgentSafety = (text: string): boolean => {
  const urgentKeywords = [
    "suicide", "kill myself", "want to die", "end it all", "self harm", "self-harm",
    "cut myself", "hurt myself", "don't want to live", "emergency", "crisis",
    "don't see the point", "no point in living", "better off dead",
    "मरना", "आत्महत्या", "स्वतःला संपवायचं", "जीवाचं बरं वाईट", // Hindi/Marathi emergency keywords
  ];
  const lowerText = (text || "").toLowerCase();
  return urgentKeywords.some((keyword) => lowerText.includes(keyword));
};

export const traumaScreeningSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    traumaIndicators: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: TRAUMA_INDICATORS as unknown as string[] },
      description: "Trauma categories evidenced in the text. Use none_detected if none apply.",
    },
    distressSignals: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: DISTRESS_SIGNALS as unknown as string[] },
      description: "Distress/psychological signals evidenced in the text. Use none_detected if none apply.",
    },
    riskBand: {
      type: Type.STRING,
      enum: ["low", "moderate", "elevated", "high"],
      description: "Overall screening risk band for human triage purposes.",
    },
    crisisFlag: {
      type: Type.BOOLEAN,
      description: "True ONLY for direct indicators of imminent self-harm, suicidal ideation, or current physical danger.",
    },
    rationale: { type: Type.STRING, description: "1-2 sentences citing the specific language that drove this assessment." },
    confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
    suggestedHumanAction: { type: Type.STRING, description: "A short, concrete suggestion for the caseworker." },
    emotionalState: { type: Type.STRING, description: "Brief summary of overall emotional state (e.g., 'Anxious', 'Calm', 'Overwhelmed')." },
    language: { type: Type.STRING, description: "Primary language of the input text (e.g., 'English', 'Hindi', 'Marathi')." },
    uncertainty: { type: Type.BOOLEAN, description: "True if the analysis is uncertain due to ambiguous, vague, or complex language." },
    evidence: { type: Type.STRING, description: "Brief snippet or description of the text that supports these signals. Must not invent facts." },
  },
  required: [
    "traumaIndicators", "distressSignals", "riskBand", "crisisFlag", "rationale",
    "confidence", "suggestedHumanAction", "emotionalState", "language", "uncertainty", "evidence",
  ],
};

export async function analyzeReflection(text: string) {
  const isUrgent = checkUrgentSafety(text);

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `Analyze the following reflection text using the trauma-informed screening taxonomy.

Text: "${text}"`;

  const response = await getAI().models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SCREENING_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: traumaScreeningSchema,
      temperature: 0.1,
    },
  });

  if (!response.text) {
    throw new Error("No response from Gemini.");
  }

  const result = JSON.parse(response.text);
  return {
    ...result,
    // Deterministic override: an explicit crisis phrase always wins, regardless of model output.
    crisisFlag: result.crisisFlag || isUrgent,
    isUrgent: result.crisisFlag || isUrgent,
  };
}

// ============================================================================
// Voice reflections: transcript + vocal-delivery ("how it was said") features
// The LLM never receives raw audio — it reasons over the words AND a numeric
// summary of pitch variability / pace / pauses / loudness extracted client-side,
// so tone judgments are grounded in measured delivery, not keyword matching.
// ============================================================================

export interface AcousticFeatures {
  pitchVariabilityScore: number; // 0-1, coefficient of variation of estimated pitch (higher = more expressive/variable)
  speakingRateWpm: number; // words per minute derived from transcript + duration
  pauseRatio: number; // 0-1, fraction of the recording spent in silence/pauses
  energyScore: number; // 0-1, normalized average vocal loudness/RMS energy
  durationSeconds: number;
}

function describeAcousticFeatures(f: AcousticFeatures): string {
  const pitchDesc = f.pitchVariabilityScore < 0.15
    ? "very flat/monotone pitch"
    : f.pitchVariabilityScore < 0.35
      ? "moderately varied pitch"
      : "highly expressive/variable pitch";
  const paceDesc = f.speakingRateWpm < 90
    ? "slow, halting pace"
    : f.speakingRateWpm > 160
      ? "fast, rushed pace"
      : "a moderate, steady pace";
  const pauseDesc = f.pauseRatio > 0.4
    ? "long, frequent pauses"
    : f.pauseRatio > 0.2
      ? "some noticeable pauses"
      : "few pauses, continuous speech";
  const energyDesc = f.energyScore < 0.25
    ? "low vocal energy/loudness (quiet, subdued)"
    : f.energyScore > 0.65
      ? "high vocal energy/loudness (animated, forceful)"
      : "moderate vocal energy";

  return `Duration: ${Math.round(f.durationSeconds)}s. Delivery measured from audio: ${pitchDesc}, ${paceDesc} (~${Math.round(f.speakingRateWpm)} words/min), ${pauseDesc} (${Math.round(f.pauseRatio * 100)}% of recording silent), ${energyDesc}.`;
}

export const voiceToneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    emotionalTone: {
      type: Type.STRING,
      description: "Short label for the inferred emotional tone from BOTH delivery and content, e.g. 'Sad / Subdued', 'Calm / Content', 'Anxious / Tense', 'Flat / Numb', 'Hopeful / Upbeat', 'Distressed / Overwhelmed'.",
    },
    toneConfidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
    toneRationale: {
      type: Type.STRING,
      description: "1-2 sentences explaining the tone judgment, referencing BOTH the vocal delivery measurements and the words used.",
    },
    contentVsDeliveryAlignment: {
      type: Type.STRING,
      enum: ["aligned", "mismatched", "unclear"],
      description: "'mismatched' when the words sound okay/positive but the vocal delivery suggests otherwise (or vice versa) — an important signal on its own.",
    },
    traumaIndicators: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: TRAUMA_INDICATORS as unknown as string[] },
    },
    distressSignals: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: DISTRESS_SIGNALS as unknown as string[] },
    },
    riskBand: { type: Type.STRING, enum: ["low", "moderate", "elevated", "high"] },
    crisisFlag: { type: Type.BOOLEAN },
    rationale: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
    suggestedHumanAction: { type: Type.STRING },
  },
  required: [
    "emotionalTone", "toneConfidence", "toneRationale", "contentVsDeliveryAlignment",
    "traumaIndicators", "distressSignals", "riskBand", "crisisFlag", "rationale",
    "confidence", "suggestedHumanAction",
  ],
};

export async function analyzeVoiceTone(transcript: string, features: AcousticFeatures) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }
  const isUrgent = checkUrgentSafety(transcript);
  const deliverySummary = describeAcousticFeatures(features);

  const prompt = `A participant recorded a voice reflection. You are given the transcribed words AND a measured \
summary of how it was spoken (derived from the raw audio's pitch, pace, pauses, and loudness — not from you listening \
to audio). Reason about the participant's emotional tone using BOTH sources together. Pay special attention to cases \
where the words and the delivery disagree (e.g., someone saying "I'm fine" in a flat, quiet, halting voice) — that \
mismatch is itself an important signal, not something to explain away.

Transcript: "${transcript || "(no speech transcribed)"}"

${deliverySummary}`;

  const response = await getAI().models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SCREENING_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: voiceToneSchema,
      temperature: 0.2,
    },
  });

  if (!response.text) {
    throw new Error("No response from Gemini.");
  }

  const result = JSON.parse(response.text);
  return {
    ...result,
    crisisFlag: result.crisisFlag || isUrgent,
    acousticFeatures: features,
  };
}

// ============================================================================
// Comprehensive check-in analysis (structured survey answers + optional reflection)
// ============================================================================

export const comprehensiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    distressScore: { type: Type.INTEGER, description: "A calculated distress score from 0 to 100 based on the user's situation and text." },
    level: { type: Type.STRING, description: "The distress level: MILD, MODERATE, ELEVATED, HIGH, or VERY_HIGH." },
    levelLabel: { type: Type.STRING, description: "A human-readable label for the distress level (e.g., 'Mild Routine', 'Elevated Distress')." },
    trend: { type: Type.STRING, description: "Trend compared to baseline: IMPROVING, STABLE, INCREASING, or RAPID_INCREASE." },
    primaryAction: { type: Type.STRING, description: "The single most important next step for the user." },
    supportiveMessage: { type: Type.STRING, description: "A compassionate, non-clinical supportive message acknowledging their feelings." },
    isExplicitSafetyConcern: { type: Type.BOOLEAN, description: "True if the user is in immediate physical danger." },
    factors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of contributing factors identified from the check-in.",
    },
    traumaIndicators: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: TRAUMA_INDICATORS as unknown as string[] },
      description: "Trauma categories evidenced across the check-in answers and reflection, if any.",
    },
    distressSignals: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: DISTRESS_SIGNALS as unknown as string[] },
      description: "Distress/psychological signals evidenced, if any.",
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          priority: { type: Type.STRING, description: "LOW, MEDIUM, or HIGH" },
          actionLabel: { type: Type.STRING },
          actionType: { type: Type.STRING },
        },
        required: ["category", "title", "description", "priority", "actionLabel", "actionType"],
      },
    },
  },
  required: [
    "distressScore", "level", "levelLabel", "trend", "primaryAction", "supportiveMessage",
    "isExplicitSafetyConcern", "factors", "traumaIndicators", "distressSignals", "recommendations",
  ],
};

export async function analyzeComprehensiveCheckIn(checkInData: any, transcript: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const isUrgent = checkUrgentSafety(transcript || "");

  const prompt = `
Analyze the following user check-in data and reflection transcript to generate a comprehensive personalized distress analysis and recommendations.
Do NOT diagnose any mental health condition. Use compassionate, trauma-informed language.
Be dynamic and responsive to the user's specific answers. If the user is happy, the score should be low and the message should be encouraging. If the user is sad or stressed, the score should be high and recommendations supportive.

Check-In Data:
${JSON.stringify(checkInData, null, 2)}

Transcript: "${transcript}"
`;

  const response = await getAI().models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SCREENING_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: comprehensiveSchema,
      temperature: 0.7,
    },
  });

  if (!response.text) {
    throw new Error("No response from Gemini.");
  }

  const result = JSON.parse(response.text);
  return {
    ...result,
    isExplicitSafetyConcern: result.isExplicitSafetyConcern || isUrgent,
  };
}

export async function handleChat(messages: any[]) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const contents = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const systemInstruction = "You are a helpful and empathetic AI assistant for AURA (Mental Health & Distress Prediction System). You provide culturally-sensitive mental health guidance, general support, and assist users with navigating the application. You do NOT provide clinical diagnoses. You maintain a warm, respectful, and safe tone at all times. Respond clearly and concisely.";

  const response = await getAI().models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: contents,
    config: {
      systemInstruction,
      temperature: 0.7,
    },
  });

  if (!response.text) {
    throw new Error("No response from Gemini.");
  }

  return response.text;
}

export async function generateCaseSummary(participantData: any, checkIns: any[]) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const recentCheckIns = checkIns.slice(0, 5).map((c) => ({
    date: c.timestamp || c.occurred_at,
    wellbeing: c.wellbeing,
    stress: c.stress,
    notes_provided: !!c.notes || !!c.optional_note,
  }));

  const prompt = `As an AI assistant, provide a brief case summary for an authorized counselor based on the following minimized data.
Rules:
- Distinguish observations from interpretations.
- DO NOT diagnose.
- DO NOT invent facts.
- Indicate uncertainty where appropriate.
- Be concise.

Participant Language Preference: ${participantData.language || "Unknown"}
Age Group: ${participantData.age_group || "Unknown"}
Recent check-in trends:
${JSON.stringify(recentCheckIns, null, 2)}
`;

  const response = await getAI().models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SCREENING_SYSTEM_PROMPT,
      temperature: 0.2,
    },
  });

  return response.text;
}

// ============================================================================
// Counselor credential document screening
// Assistive triage only — Gemini looks at the uploaded PDF/image and reports
// whether it plausibly reads as a counselling / psychology / social-work
// credential, plus any concerns. A human admin still makes the approve/reject
// decision; this never gates the account by itself.
// ============================================================================

const CREDENTIAL_KEYWORDS = [
  "counsel", "counsellor", "counselor", "counselling", "counseling",
  "psycholog", "clinical psychology", "psychotherap", "therapist", "therapy",
  "social work", "msw", "bsw", "m.s.w", "b.s.w",
  "mental health", "psychiatr", "guidance", "rehabilitation",
  "b.a. psychology", "m.a. psychology", "m.sc psychology", "m.phil",
  "diploma in counselling", "certificate in counselling", "cbt", "emdr",
  "licen", "registration", "board", "council", "accredit", "university",
  "institute", "college", "degree", "certificate", "provisional certificate",
  "convocation", "marks", "transcript",
];

export const credentialAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    documentType: {
      type: Type.STRING,
      description:
        "One of: degree certificate, professional license, training certificate, transcript/marksheet, CV/resume, identity document, unrelated document, unclear",
    },
    appearsCredential: {
      type: Type.BOOLEAN,
      description:
        "True only if this plausibly reads as a counselling / psychology / social work / mental-health qualification or licence.",
    },
    field: { type: Type.STRING, description: "Field of study or practice named on the document, or empty string." },
    issuingBody: { type: Type.STRING, description: "University / board / institution shown, or empty string." },
    holderName: { type: Type.STRING, description: "Name of the person the document is issued to, or empty string." },
    matchedIndicators: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Concrete supporting features seen (keywords, letterhead, seal/stamp, registration number, signatures).",
    },
    concerns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Concrete red flags (no issuing institution, blank/template form, unrelated field, low quality / possible edit, name not visible).",
    },
    confidence: { type: Type.STRING, description: "low | medium | high" },
    recommendation: {
      type: Type.STRING,
      description: "likely_valid | manual_review | likely_invalid — advisory only.",
    },
    rationale: { type: Type.STRING, description: "<= 60 words, plain language, for the reviewing admin." },
  },
  required: [
    "documentType", "appearsCredential", "field", "issuingBody", "holderName",
    "matchedIndicators", "concerns", "confidence", "recommendation", "rationale",
  ],
};

const CREDENTIAL_SYSTEM_PROMPT = `You are an assistant helping a human administrator triage documents that people upload \
when applying to volunteer as mental-health counselors for survivors of atrocities. You are shown ONE document \
(a scan or photo of a certificate, degree, licence, transcript, or similar). Decide, cautiously, whether it plausibly \
reads as a genuine counselling / psychology / social-work / mental-health qualification or professional licence.

You are NOT a forensic verifier and you cannot confirm authenticity. Your job is to summarise what the document is, \
pull out the field of study, issuing institution and the holder's name if visible, list concrete supporting features \
and concrete concerns, and give an advisory recommendation. A human makes the final decision. Be conservative: if the \
document is unrelated (e.g. a driving licence, a utility bill, a school-leaving certificate with no relevant field), \
say so and recommend likely_invalid. If it looks relevant but key details are missing or unclear, recommend \
manual_review. Only recommend likely_valid when the document clearly names a relevant qualification AND an issuing body.`;

export interface CredentialAnalysis {
  status: "analyzed" | "unavailable";
  documentType?: string;
  appearsCredential?: boolean;
  field?: string;
  issuingBody?: string;
  holderName?: string;
  matchedIndicators?: string[];
  concerns?: string[];
  confidence?: string;
  recommendation?: "likely_valid" | "manual_review" | "likely_invalid";
  rationale?: string;
  keywordHits?: string[];
  reason?: string;
  analyzedAt: string;
}

export async function analyzeCredentialDocument(
  base64Data: string,
  mimeType: string,
  applicantName?: string
): Promise<CredentialAnalysis> {
  const analyzedAt = new Date().toISOString();

  if (!process.env.GEMINI_API_KEY) {
    return { status: "unavailable", reason: "GEMINI_API_KEY not configured on the server.", analyzedAt };
  }

  const supported = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  if (!supported.includes(mimeType)) {
    return { status: "unavailable", reason: `Unsupported document type: ${mimeType}`, analyzedAt };
  }

  try {
    const response = await getAI().models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: [
        {
          text:
            `Analyse this uploaded document.` +
            (applicantName ? ` The applicant's stated name is "${applicantName}" — note whether it matches.` : "") +
            ` Return the structured screening result.`,
        },
        { inlineData: { mimeType, data: base64Data } },
      ],
      config: {
        systemInstruction: CREDENTIAL_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: credentialAnalysisSchema,
        temperature: 0.1,
      },
    });

    if (!response.text) {
      return { status: "unavailable", reason: "No response from Gemini.", analyzedAt };
    }

    const parsed = JSON.parse(response.text);

    // Deterministic keyword cross-check over whatever text the model surfaced,
    // so the admin sees a simple, explainable second signal alongside the LLM's.
    const haystack = [
      parsed.field, parsed.issuingBody, parsed.documentType,
      ...(parsed.matchedIndicators || []),
    ]
      .join(" ")
      .toLowerCase();
    const keywordHits = CREDENTIAL_KEYWORDS.filter((k) => haystack.includes(k));

    return {
      status: "analyzed",
      documentType: parsed.documentType,
      appearsCredential: !!parsed.appearsCredential,
      field: parsed.field || "",
      issuingBody: parsed.issuingBody || "",
      holderName: parsed.holderName || "",
      matchedIndicators: parsed.matchedIndicators || [],
      concerns: parsed.concerns || [],
      confidence: parsed.confidence || "low",
      recommendation: parsed.recommendation || "manual_review",
      rationale: parsed.rationale || "",
      keywordHits,
      analyzedAt,
    };
  } catch (err: any) {
    return { status: "unavailable", reason: err?.message || "Credential analysis failed.", analyzedAt };
  }
}

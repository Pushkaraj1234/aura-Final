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

  // The model is asked for 0-100 but nothing made it return one, and this
  // number was being used directly as the participant's distress score. A
  // sampled value outside the range (or a non-number) would silently become
  // someone's headline reading, so it is coerced here and dropped entirely
  // when it is not a usable number — the caller falls back to the
  // deterministic score rather than displaying a value nobody can explain.
  const rawScore = Number(result.distressScore);
  const distressScore = Number.isFinite(rawScore)
    ? Math.min(100, Math.max(0, Math.round(rawScore)))
    : undefined;

  return {
    ...result,
    distressScore,
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

/**
 * Two sentences on what a guardian reported, for the counsellor's screen.
 *
 * The concern level is computed from the answers before this is called and is
 * passed in rather than asked for — the model's job is to phrase what is there,
 * not to grade it. Returns null rather than throwing so a failure downgrades
 * the summary to the computed one instead of losing the submission.
 */
export async function summariseGuardianReport(
  answers: Array<{ questionId: string; value: string }>,
  concern: string
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const lines = answers.map((a) => `- ${a.questionId}: ${a.value}`).join("\n");
  const prompt = `A family member answered a five-question check about someone receiving support.
Their answers:
${lines}

The computed concern level is "${concern}".

Write at most two short sentences for the counsellor, stating what the family
member reported and where attention is needed. Do not diagnose, do not give a
score, do not contradict the concern level, and do not add anything that is not
in the answers above.`;

  try {
    const response = await getAI().models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SCREENING_SYSTEM_PROMPT,
        temperature: 0.2,
        maxOutputTokens: 160,
      },
    });
    const text = (response.text || "").trim();
    return text ? text.slice(0, 800) : null;
  } catch (err: any) {
    console.warn("[AURA Guardian] Gemini summary failed:", err?.message || err);
    return null;
  }
}

// ============================================================================
// Proctored trauma assessment (src/features/proctoredAssessment)
//
// Two jobs only: a short supportive conversation after the questionnaire, and
// the plain-language write-up of scores the browser has already computed. The
// PCL-5 total, the four cluster scores and the session checks are all scored
// deterministically before anything reaches here; the model phrases them and
// never grades them. The crisis gate in apiRouter runs before the chat call,
// so a disclosure of self-harm never reaches the model at all.
// ============================================================================

const ASSESSMENT_HELPLINES = "Tele MANAS on 14416 (free, confidential, 24 hours), or 112 in an emergency";

export interface AssessmentChatTurn {
  sender: "aura" | "user";
  text: string;
}

export async function assessmentChatReply(
  history: AssessmentChatTurn[],
  userMessage: string,
  indexTrauma: string,
  completedItemsCount: number
): Promise<string> {
  const systemInstruction = `You are Aura, a calm, trauma-informed companion within a clinical screening tool.
You are facilitating a structured trauma evaluation for a user who has voluntarily requested support.

CRITICAL SAFETY & CLINICAL GUARDRAILS:
1. NEVER diagnose PTSD or any mental disorder.
2. NEVER claim that facial cues, eye movements, voice pitch, or emotional tears prove trauma or dishonesty.
3. NEVER accuse the user of lying or faking symptoms.
4. Speak warmly, clearly, calmly, and empathetically with gentle pacing.
5. The validated PCL-5 questions are scored deterministically by code. Your role is solely to offer grounding, explain questions if the user asks for clarification, and listen contextually.
6. If the user mentions active suicidal intent or self-harm, immediately provide warm crisis support (${ASSESSMENT_HELPLINES}).
7. Keep responses concise (2 to 4 sentences) to keep the user from feeling overwhelmed.
8. Write plain sentences. Do not use markdown, emojis, or exclamation marks.

Context:
- Index Trauma Topic: ${indexTrauma || "General traumatic stress"}
- PCL-5 Assessment Progress: ${completedItemsCount || 0} of 20 items complete.`;

  const contents = history.map((m) => ({
    role: m.sender === "aura" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage || "Hello Aura" }] });

  const response = await getAI().models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents,
    config: {
      systemInstruction,
      temperature: 0.6,
      maxOutputTokens: 300,
    },
  });

  return response.text || "I am here with you. Take all the time you need.";
}

export interface AssessmentClusterInput {
  score: number;
  symptomSeverity: string;
}

export interface AssessmentReportInput {
  totalScore: number;
  cutPoint: number;
  isClinicallySignificant: boolean;
  itemsAnswered: number;
  clusters: { B: AssessmentClusterInput; C: AssessmentClusterInput; D: AssessmentClusterInput; E: AssessmentClusterInput };
  functionalImpactAvg: number;
  indexTrauma: string;
  sessionIntegrityRating: string;
  eventsCount: number;
  sensorStats: {
    sessionDurationSeconds: number;
    faceRetentionPercentage: number;
    blackScreenFrames: number;
    multiplePersonsSuspectedCount: number;
    windowFocusPercentage: number;
    tabSwitchCount: number;
    screenShareType: string;
  } | null;
}

const ASSESSMENT_INTEGRITY_LABELS: Record<string, string> = {
  VERIFIED: "No issues",
  MINOR_SESSION_EVENTS: "Minor interruptions",
  SIGNIFICANT_SESSION_EVENTS: "Several interruptions",
  UNABLE_TO_VERIFY: "Could not be confirmed",
};

/**
 * The report built only from the submitted scores and measured session
 * figures. Used when Gemini is not configured or the call fails, so a person
 * who finished the assessment always gets a readable result.
 */
export function templateAssessmentReport(input: AssessmentReportInput): { userReport: string; sessionReport: string } {
  const { totalScore, cutPoint, isClinicallySignificant, clusters, functionalImpactAvg, sensorStats } = input;
  const integrityLabel = ASSESSMENT_INTEGRITY_LABELS[input.sessionIntegrityRating] || input.sessionIntegrityRating;

  const userReport = `## Your score
Your answers give a PCL-5 total of ${totalScore} out of 80. ${
    isClinicallySignificant
      ? `This is above the screening threshold of ${cutPoint}. It would be worth talking with a licensed mental health professional about a fuller assessment.`
      : `This is below the screening threshold of ${cutPoint}, which suggests fewer symptoms over the past month.`
  }

## The four symptom areas
- Intrusion (${clusters.B.score} of 20): unwanted memories, dreams, or strong reactions to reminders.
- Avoidance (${clusters.C.score} of 8): keeping away from thoughts, conversations or places linked to what happened.
- Thoughts and mood (${clusters.D.score} of 28): changes in how you see yourself, others or the world, or feeling cut off.
- Arousal and reactivity (${clusters.E.score} of 24): feeling on guard, easily startled, or having trouble sleeping or concentrating.

## Daily life
Your average rating for how much this affects daily life was ${functionalImpactAvg} out of 4.

## Looking after yourself
- Keep a steady routine for sleep and meals where you can.
- Try slow breathing when reminders feel overwhelming: in for 4, hold for 7, out for 8.
- Consider sharing these results with your counsellor or a doctor you trust.

This is a screening, not a diagnosis. If you need to talk to someone now, you can call ${ASSESSMENT_HELPLINES}.`;

  const sessionReport = `Session conditions: ${integrityLabel.toLowerCase()}. ${
    sensorStats
      ? `Your face was in view ${sensorStats.faceRetentionPercentage}% of the time, and you were in the assessment window ${sensorStats.windowFocusPercentage}% of the time with ${sensorStats.tabSwitchCount} tab ${sensorStats.tabSwitchCount === 1 ? "switch" : "switches"}.`
      : "Detailed camera and microphone figures were not recorded."
  } These checks describe the session only. They are not used to judge your answers.`;

  return { userReport, sessionReport };
}

export async function generateAssessmentReport(
  input: AssessmentReportInput
): Promise<{ userReport: string; sessionReport: string }> {
  const { totalScore, cutPoint, isClinicallySignificant, clusters, functionalImpactAvg, sensorStats } = input;
  const integrityLabel = ASSESSMENT_INTEGRITY_LABELS[input.sessionIntegrityRating] || input.sessionIntegrityRating;

  // Only report sensor figures that were actually measured
  const sensorLines: string[] = sensorStats
    ? [
        `- Session length: ${Math.floor(sensorStats.sessionDurationSeconds / 60)} min ${sensorStats.sessionDurationSeconds % 60} s`,
        `- Face in view: ${sensorStats.faceRetentionPercentage}% of the time`,
        `- Covered or dark camera frames: ${sensorStats.blackScreenFrames}`,
        `- Times another person may have been in view: ${sensorStats.multiplePersonsSuspectedCount}`,
        `- Time spent in the assessment window: ${sensorStats.windowFocusPercentage}%`,
        `- Tab switches: ${sensorStats.tabSwitchCount}`,
        `- Window monitoring method: ${sensorStats.screenShareType === "display_stream" ? "screen sharing" : "focus tracking"}`,
      ]
    : ["- Detailed camera and microphone figures were not recorded."];

  const prompt = `You are writing two short sections of a report for someone who has just completed a trauma screening in Aura.
The reader may be a survivor of serious trauma. Write calmly, plainly and respectfully.

INPUT CLINICAL DATA:
- PCL-5 Total Score: ${totalScore} / 80 (Cut-point: ${cutPoint})
- Questions answered: ${input.itemsAnswered} of 20${input.itemsAnswered < 20 ? " (the session was ended early, so the total may be lower than it would otherwise be)" : ""}
- Clinical Significance: ${isClinicallySignificant ? "Positive screen indicating clinically significant trauma symptoms" : "Below standard provisional cutoff threshold"}
- Cluster B (Intrusion): ${clusters.B.score} / 20 (${clusters.B.symptomSeverity})
- Cluster C (Avoidance): ${clusters.C.score} / 8 (${clusters.C.symptomSeverity})
- Cluster D (Negative Cognitions/Mood): ${clusters.D.score} / 28 (${clusters.D.symptomSeverity})
- Cluster E (Arousal/Reactivity): ${clusters.E.score} / 24 (${clusters.E.symptomSeverity})
- Functional Impact Average: ${functionalImpactAvg} / 4.0
- Index Trauma Topic: ${input.indexTrauma || "General traumatic stress"}
- Session conditions: ${integrityLabel}

SESSION CHECKS (camera, microphone and window focus):
${sensorLines.join("\n")}
- Logged session events: ${input.eventsCount}

Return a JSON object with two string fields:
{
  "userReport": "Explain the PCL-5 total and the four symptom areas in plain language, without diagnostic labels. Say clearly that this is a screening, not a diagnosis. End with three gentle, practical self-care suggestions and a reminder that ${ASSESSMENT_HELPLINES} is available.",
  "sessionReport": "Two or three short, neutral sentences describing the session conditions using only the figures above. Do not speculate, accuse, or certify anything. Say that these checks describe the session only and are not used to judge the answers."
}

Style rules for both fields: short paragraphs; you may use lines starting with '## ' for headings and '- ' for list items; no bold, no emojis, no exclamation marks, no em dashes; never mention AI, algorithms, surveillance, biometrics or forensics.`;

  const response = await getAI().models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          userReport: { type: Type.STRING },
          sessionReport: { type: Type.STRING },
        },
        required: ["userReport", "sessionReport"],
      },
      temperature: 0.25,
    },
  });

  if (!response.text) throw new Error("No response from Gemini.");
  const parsed = JSON.parse(response.text);
  const userReport = typeof parsed.userReport === "string" ? parsed.userReport.trim() : "";
  const sessionReport = typeof parsed.sessionReport === "string" ? parsed.sessionReport.trim() : "";
  if (!userReport) throw new Error("Gemini returned an empty report.");
  return { userReport, sessionReport };
}

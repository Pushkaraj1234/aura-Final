import { ReflectionAnalysisResult, LanguageSignalCategory } from "../types";

/**
 * AURA Contextual Reflection Language Analysis Engine
 * 
 * CORE PRINCIPLES:
 * 1. Language-based signal ONLY (not a clinical diagnostic assessment or emotion detection).
 * 2. Processes the ACTUAL submitted text, not mock or pre-seeded data.
 * 3. Never equates a single keyword (e.g., "noise", "sleep", "happy") with an isolated verdict.
 * 4. Recognizes context, contrastive clauses ("worried... but feeling much better"), and mixed sentiments.
 * 5. Transparently outputs contributing patterns and plain-language explanations.
 */

interface PatternDefinition {
  category: LanguageSignalCategory;
  sentiment: ReflectionAnalysisResult["sentiment"];
  regexList: RegExp[];
  patternDescriptions: string[];
}

// Word pattern libraries
const PATTERNS = {
  // Explicit immediate safety & danger phrases
  urgentSafety: [
    /\b(immediate danger|someone is hurting me|violence|attacked|threatened|want to end my life|suicide|self-harm|kill myself|emergency help)\b/i
  ],

  // Positive & hopeful language
  positiveHope: [
    /\b(happy|joyful|wonderful|grateful|blessed|excited|hopeful|optimistic|peaceful|content|great day|good day|feeling good|felt great|proud|relieved|energized)\b/i,
    /\b(looking forward to|future feels brighter|feeling much better|feel better|improved|making progress|things are getting better)\b/i
  ],

  // Social connection
  socialConnection: [
    /\b(met (?:my )?friends|talked with (?:my )?family|community|neighbors|supportive|connected|spent time with|gathering|shared a meal|group)\b/i
  ],

  // Overwhelm & burden
  overwhelmBurden: [
    /\b(overwhelmed|exhausted|burned out|breaking point|cannot cope|can't cope|too much to handle|drowning in|at my limit|helpless|hopeless|crushed)\b/i,
    /\b(unbearable|drained|no energy left|completely depleted)\b/i
  ],

  // Stress & tension
  stressTension: [
    /\b(stress|stressed|tense|tension|anxious|anxiety|worried|worry|nervous|panicked|panicking|under pressure|frustrated|irritated|strained)\b/i
  ],

  // Sleep disruptions
  sleepIssues: [
    /\b(haven't been sleeping|can't sleep|cannot sleep|insomnia|trouble sleeping|nightmares|bad dreams|waking up constantly|restless sleep|tossing and turning|sleep deprivation)\b/i
  ],

  // Restful sleep
  sleepPositive: [
    /\b(slept well|restful sleep|good night's sleep|woke up refreshed|peaceful night)\b/i
  ],

  // Environmental safety & security concerns
  environmentalConcerns: [
    /\b(noise at night|noisy shelter|unsafe environment|uncomfortable space|crowded shelter|scared at night|lack of privacy|unstable shelter)\b/i
  ],

  // Routine & neutral daily activities
  neutralRoutine: [
    /\b(normal|routine|ordinary|went to work|cooked dinner|ran errands|cleaned|did chores|regular day|nothing special|uneventful|usual)\b/i
  ],

  // Support seeking
  supportSeeking: [
    /\b(need to talk|want to speak to someone|need help|guidance|counselor|advice|asking for support)\b/i
  ],

  // Contrastive / Concessive conjunctions that signal nuance & mixed states
  contrastive: [
    /\b(but|however|although|though|yet|on the other hand|even though|nevertheless|despite)\b/i
  ]
};

export function analyzeReflection(rawText: string, isDemoSample: boolean = false): ReflectionAnalysisResult {
  const text = (rawText || "").trim();

  // Test Case E & F: Empty reflection
  if (!text || text.length === 0) {
    return {
      sentiment: "none",
      languageSignal: "None",
      contributingPatterns: [],
      keywords: [],
      factors: [],
      explanation: "No reflection text provided.",
      isDemoSample: false,
      hasUrgentSafetyMention: false
    };
  }

  const lower = text.toLowerCase();
  const contributingPatterns: string[] = [];
  const matchedKeywords: string[] = [];
  const factors: string[] = [];

  // Check 1: Immediate Safety Concerns
  let hasUrgentSafety = false;
  for (const regex of PATTERNS.urgentSafety) {
    const match = text.match(regex);
    if (match) {
      hasUrgentSafety = true;
      contributingPatterns.push(`explicit mention of safety concern or crisis language: "${match[0]}"`);
      matchedKeywords.push(match[0]);
    }
  }

  if (hasUrgentSafety) {
    return {
      sentiment: "safety_concern",
      languageSignal: "Safety-related language",
      contributingPatterns,
      keywords: matchedKeywords,
      factors: ["Immediate safety keyword detected in text", "Urgent humanitarian protocol guidance recommended"],
      explanation: "The reflection contains direct statements regarding urgent safety or crisis needs. Human review and emergency guidance are prioritized.",
      isDemoSample,
      hasUrgentSafetyMention: true
    };
  }

  // Check 2: Pattern detections across dimensions
  const hasPositiveHope = PATTERNS.positiveHope.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasSocial = PATTERNS.socialConnection.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasOverwhelm = PATTERNS.overwhelmBurden.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasStress = PATTERNS.stressTension.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasSleepIssues = PATTERNS.sleepIssues.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasSleepPositive = PATTERNS.sleepPositive.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasEnvConcerns = PATTERNS.environmentalConcerns.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasNeutralRoutine = PATTERNS.neutralRoutine.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasSupportSeeking = PATTERNS.supportSeeking.some(r => {
    const m = text.match(r);
    if (m) {
      matchedKeywords.push(m[0]);
      return true;
    }
    return false;
  });

  const hasContrastive = PATTERNS.contrastive.some(r => r.test(text));

  // Build pattern list
  if (hasPositiveHope) contributingPatterns.push("positive outlook & hopeful language");
  if (hasSocial) contributingPatterns.push("active social connection & support network");
  if (hasSleepPositive) contributingPatterns.push("restful sleep mentioned");
  if (hasOverwhelm) contributingPatterns.push("feelings of overwhelm or depletion");
  if (hasStress) contributingPatterns.push("stress, tension, or anxious phrasing");
  if (hasSleepIssues) contributingPatterns.push("sleep interruption or insomnia mentions");
  if (hasEnvConcerns) contributingPatterns.push("environmental or living condition stressors");
  if (hasNeutralRoutine) contributingPatterns.push("routine daily activities described");
  if (hasSupportSeeking) contributingPatterns.push("interest in talking with a counselor");

  const positiveSignalsCount = (hasPositiveHope ? 1 : 0) + (hasSocial ? 1 : 0) + (hasSleepPositive ? 1 : 0);
  const negativeSignalsCount = (hasOverwhelm ? 2 : 0) + (hasStress ? 1 : 0) + (hasSleepIssues ? 1 : 0) + (hasEnvConcerns ? 1 : 0);

  // CONTEXTUAL EVALUATION (TEST CASES A, B, C, D)

  // TEST D: Mixed / Contrastive text (e.g., "I am worried about the noise at night, but I am feeling much better this week.")
  if (hasContrastive && positiveSignalsCount > 0 && negativeSignalsCount > 0) {
    return {
      sentiment: "mixed",
      languageSignal: "Mixed language signal",
      contributingPatterns,
      keywords: Array.from(new Set(matchedKeywords)),
      factors: [
        "Contrastive statement with both challenges and improvement present",
        "Acknowledges localized concern while noting overall positive trajectory"
      ],
      explanation: "The reflection expresses mixed sentiments, acknowledging specific concerns while simultaneously noting areas of improvement or hope. Contextual nuance is preserved.",
      isDemoSample,
      hasUrgentSafetyMention: false
    };
  }

  // TEST A: Purely or predominantly positive / hopeful (e.g., "I had a really happy day. I met my friends and feel hopeful about tomorrow.")
  if (positiveSignalsCount > 0 && negativeSignalsCount === 0) {
    const factorsList: string[] = ["Positive framing in voluntary narrative"];
    if (hasSocial) factorsList.push("Supportive interpersonal connection mentioned");
    if (hasPositiveHope) factorsList.push("Expressions of optimism and hope for the future");

    return {
      sentiment: "positive",
      languageSignal: "Positive / hopeful language",
      contributingPatterns,
      keywords: Array.from(new Set(matchedKeywords)),
      factors: factorsList,
      explanation: "The reflection contains language associated with positive outlook, emotional grounding, and supportive social connection.",
      isDemoSample,
      hasUrgentSafetyMention: false
    };
  }

  // TEST B: Overwhelm / Burden / High Stress (e.g., "I feel overwhelmed and exhausted. I haven't been sleeping properly.")
  if (hasOverwhelm || (negativeSignalsCount >= 2 && positiveSignalsCount === 0)) {
    const factorsList: string[] = [];
    if (hasOverwhelm) factorsList.push("Mentions feeling overwhelmed or exhausted");
    if (hasSleepIssues) factorsList.push("Mentions difficulty sleeping or disrupted rest");
    if (hasEnvConcerns) factorsList.push("Describes environmental or shelter stress");
    if (hasStress) factorsList.push("Mentions emotional tension");

    const signalLabel: LanguageSignalCategory = hasOverwhelm 
      ? "Overwhelm / burden language" 
      : "Stress-related language";

    return {
      sentiment: hasOverwhelm ? "overwhelmed" : "stressed",
      languageSignal: signalLabel,
      contributingPatterns,
      keywords: Array.from(new Set(matchedKeywords)),
      factors: factorsList,
      explanation: "The reflection contains language associated with elevated stress, emotional exhaustion, or sleep strain. This provides supportive context for human review.",
      isDemoSample,
      hasUrgentSafetyMention: false
    };
  }

  // Isolated stress or sleep issue (e.g., "A bit stressed about moving")
  if (negativeSignalsCount > 0 && positiveSignalsCount === 0) {
    return {
      sentiment: "stressed",
      languageSignal: hasSleepIssues ? "Sleep-related language" : "Stress-related language",
      contributingPatterns,
      keywords: Array.from(new Set(matchedKeywords)),
      factors: ["Mild stress or sleep disturbance phrasing in reflection"],
      explanation: "The reflection includes phrasing related to situational stress or sleep difficulty.",
      isDemoSample,
      hasUrgentSafetyMention: false
    };
  }

  // TEST C: Neutral / Ordinary routine (e.g., "Today was normal. I went to work and cooked dinner.")
  if (hasNeutralRoutine || (positiveSignalsCount === 0 && negativeSignalsCount === 0 && text.length > 0)) {
    return {
      sentiment: "neutral",
      languageSignal: "Neutral / ordinary language",
      contributingPatterns: contributingPatterns.length > 0 ? contributingPatterns : ["neutral daily description"],
      keywords: Array.from(new Set(matchedKeywords)),
      factors: ["Everyday narrative phrasing without strong emotional valence"],
      explanation: "The reflection describes routine daily events or neutral observations without strong distress or elevated positive indicators.",
      isDemoSample,
      hasUrgentSafetyMention: false
    };
  }

  // Fallback for mixed without explicit contrastive conjunctions
  return {
    sentiment: "mixed",
    languageSignal: "Mixed language signal",
    contributingPatterns,
    keywords: Array.from(new Set(matchedKeywords)),
    factors: ["Multiple mixed emotional markers identified in narrative"],
    explanation: "The reflection reflects diverse thoughts with both supportive and challenging aspects.",
    isDemoSample,
    hasUrgentSafetyMention: false
  };
}

/**
 * The guardian questionnaire.
 *
 * Fixed rather than counsellor-authored, unlike the per-participant tests: this
 * is one instrument, and two guardians answering different questions about the
 * same person would produce assessments that cannot be compared or repeated.
 *
 * Each option carries a weight because the answers are ordinal — "Almost
 * always" is worse than "Occasionally" — and that ordering is what lets a
 * concern level be computed from the answers rather than inferred by a model.
 * The weights are evenly spaced across each question's options, so no single
 * question counts for more than another.
 */

export interface GuardianOption {
  label: string;
  /** 0 = no concern, 1 = the most concerning answer offered. */
  weight: number;
}

export interface GuardianQuestion {
  id: string;
  prompt: string;
  options: GuardianOption[];
}

const scale = (labels: string[]): GuardianOption[] =>
  labels.map((label, i) => ({ label, weight: i / (labels.length - 1) }));

export const GUARDIAN_QUESTIONS: GuardianQuestion[] = [
  {
    id: "mood",
    prompt:
      "Over the past 2 weeks, have you noticed any significant changes in the patient's mood or emotions?",
    options: scale(["No change", "Mild change", "Moderate change", "Severe change"]),
  },
  {
    id: "distress",
    prompt:
      "How often does the patient appear worried, fearful, anxious, or emotionally distressed?",
    options: scale(["Never", "Occasionally", "Often", "Almost always"]),
  },
  {
    id: "routine",
    prompt:
      "Have you noticed changes in the patient's sleep, appetite, energy, or daily routine?",
    options: scale(["No change", "Slight change", "Significant change"]),
  },
  {
    id: "withdrawal",
    prompt:
      "Has the patient become more withdrawn or less interested in communicating with family, friends, or participating in usual activities?",
    options: scale(["No", "Sometimes", "Frequently", "Almost completely"]),
  },
  {
    id: "behaviour",
    prompt:
      "Have you noticed any changes in the patient's behaviour, such as unusual anger, sadness, irritability, silence, crying, or difficulty concentrating?",
    options: scale(["No", "Mild", "Moderate", "Severe"]),
  },
];

/** Short labels for the summary line, so it reads as a sentence. */
export const GUARDIAN_TOPIC: Record<string, string> = {
  mood: "mood",
  distress: "anxiety or distress",
  routine: "sleep, appetite or routine",
  withdrawal: "withdrawal",
  behaviour: "behaviour",
};

export type GuardianConcern = "low" | "moderate" | "high";

export interface GuardianAnswer {
  questionId: string;
  value: string;
}

/**
 * Reads the concern level off the answers themselves.
 *
 * Deliberately not a model's job. The answers are five ordinal scales; the
 * arithmetic is checkable, it produces the same result every time, and it still
 * works when the AI is unavailable. The model's contribution is the sentence of
 * prose beside it, not the judgement.
 */
export function summariseGuardianAnswers(answers: GuardianAnswer[]): {
  concern: GuardianConcern;
  /** Areas the guardian marked at or above the midpoint, worst first. */
  flagged: string[];
  /** Mean weight across answered questions, 0-1. */
  meanWeight: number;
  answered: number;
} {
  const scored: Array<{ id: string; weight: number }> = [];

  for (const q of GUARDIAN_QUESTIONS) {
    const given = answers.find((a) => a.questionId === q.id);
    if (!given) continue;
    const opt = q.options.find((o) => o.label === given.value);
    if (!opt) continue;
    scored.push({ id: q.id, weight: opt.weight });
  }

  if (!scored.length) return { concern: "low", flagged: [], meanWeight: 0, answered: 0 };

  const meanWeight = scored.reduce((s, x) => s + x.weight, 0) / scored.length;
  const flagged = scored
    .filter((x) => x.weight >= 0.5)
    .sort((a, b) => b.weight - a.weight)
    .map((x) => GUARDIAN_TOPIC[x.id] || x.id);

  // A single area marked at the top still matters even when the mean is low —
  // one severe answer is the kind of thing a mean would bury.
  const anySevere = scored.some((x) => x.weight >= 0.99);
  const concern: GuardianConcern =
    meanWeight >= 0.6 || (anySevere && flagged.length >= 2)
      ? "high"
      : meanWeight >= 0.3 || anySevere
        ? "moderate"
        : "low";

  return { concern, flagged, meanWeight, answered: scored.length };
}

/** The one-line summary shown when no model prose is available. */
export function guardianFallbackSummary(answers: GuardianAnswer[]): string {
  const { concern, flagged, answered } = summariseGuardianAnswers(answers);
  if (!answered) return "The guardian did not answer any questions.";
  const areas =
    flagged.length === 0
      ? "no area was marked at moderate or above"
      : flagged.length === 1
        ? `${flagged[0]} was marked at moderate or above`
        : `${flagged.slice(0, -1).join(", ")} and ${flagged[flagged.length - 1]} were marked at moderate or above`;
  return `Concern reads ${concern} across ${answered} of ${GUARDIAN_QUESTIONS.length} questions: ${areas}.`;
}

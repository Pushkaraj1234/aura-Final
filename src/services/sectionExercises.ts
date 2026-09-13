import { CheckInAnalysis } from "../types";

/**
 * Small things to try, attached to the area a check-in reported most concern in.
 *
 * The results screen already breaks a check-in into four reported areas and
 * gives each a percentage. Until now it named the highest one and stopped
 * there, which leaves a person holding a number and nothing to do with it.
 * These are the something-to-do — offered for one area only, the one their own
 * answers put highest, rather than as a wall of advice to sort through at the
 * moment they are least able to.
 *
 * Written to the same rules as the action guides in `actionGuides.ts`:
 *
 *   - Small and unequipped. Each one works in a shared room, with no money, no
 *     privacy and no preparation.
 *   - Never promises a lower score. Nothing here says a breathing exercise
 *     moves the number; the score follows how someone is, not the reverse, and
 *     implying otherwise sets a person up to feel they failed at breathing.
 *   - Not treatment, and the screen says so. These sit alongside human support,
 *     never instead of it, and nothing here routes a safety concern to a
 *     worksheet — that goes to a person.
 */

/**
 * The four reported areas that have exercises. `functioning` is deliberately
 * absent: it is part of the score but has no card on the results screen and no
 * exercises of its own, so it never competes to be the highest.
 */
export type ExerciseSection =
  | "stress"
  | "sleep"
  | "emotionalWellbeing"
  | "socialConnection";

export interface Exercise {
  title: string;
  /** What to actually do, in the second person. */
  body: string;
}

export interface SectionExerciseSet {
  section: ExerciseSection;
  /** The same heading the matching card on the results screen uses. */
  label: string;
  exercises: Exercise[];
}

export const SECTION_EXERCISES: Record<ExerciseSection, SectionExerciseSet> = {
  stress: {
    section: "stress",
    label: "Reported Stress Level",
    exercises: [
      {
        title: "Box Breathing",
        body: "Inhale 4 sec → hold 4 → exhale 4 → hold 4. Repeat for 2–3 minutes.",
      },
      {
        title: "5-4-3-2-1 Grounding",
        body: "Notice 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.",
      },
    ],
  },
  sleep: {
    section: "sleep",
    label: "Sleep & Rest Quality",
    exercises: [
      {
        title: "4–6 Breathing",
        body: "Inhale gently for 4 seconds, then exhale for 6 seconds. Repeat for 5 minutes.",
      },
      {
        title: "Body Relaxation",
        body: "Lie comfortably. Relax your feet → legs → stomach → shoulders → face, one area at a time.",
      },
    ],
  },
  emotionalWellbeing: {
    section: "emotionalWellbeing",
    label: "Emotional Wellbeing",
    exercises: [
      {
        title: "Emotion Naming",
        body: "Pause and complete: “I feel ___ because ___.” Don’t judge the feeling.",
      },
      {
        title: "Self-Compassion Pause",
        body: "Take a slow breath and say: “It’s okay to feel this. I’ll take it one step at a time.”",
      },
    ],
  },
  socialConnection: {
    section: "socialConnection",
    label: "Social Connection",
    exercises: [
      {
        title: "Reach Out",
        body: "Message someone you trust: “I’m having a difficult day. Can we talk?”",
      },
      {
        title: "Connection Time",
        body: "Spend 10 minutes talking or sitting with someone you feel safe around.",
      },
    ],
  },
};

/**
 * The order the cards are read in on the results screen, which is also how a
 * tie is broken. Two areas can land on the same percentage — the ranges
 * overlap — and when they do, the highlighted card should be the first one the
 * eye reaches rather than whichever key the runtime happened to enumerate
 * first. Reading order is the only tie-break a person can actually see.
 */
const CARD_ORDER: ExerciseSection[] = [
  "stress",
  "sleep",
  "emotionalWellbeing",
  "socialConnection",
];

/**
 * Which of the four reported areas this check-in put highest.
 *
 * Higher is more concern in every one of them — `calculateFactorPercentages`
 * inverts sleep, wellbeing and connection so that a difficult answer scores
 * high, the same direction stress already ran in. So the largest percentage is
 * the area to offer something for, and it is also the tallest bar on screen,
 * which is what keeps the highlight from looking arbitrary.
 */
export function highestConcernSection(
  factorPercentages: CheckInAnalysis["factorPercentages"]
): ExerciseSection {
  return CARD_ORDER.reduce((highest, section) =>
    (factorPercentages[section] ?? 0) > (factorPercentages[highest] ?? 0) ? section : highest
  );
}

/** The exercises to offer for a check-in, chosen from its own answers. */
export function exercisesForAnalysis(
  factorPercentages: CheckInAnalysis["factorPercentages"]
): SectionExerciseSet {
  return SECTION_EXERCISES[highestConcernSection(factorPercentages)];
}

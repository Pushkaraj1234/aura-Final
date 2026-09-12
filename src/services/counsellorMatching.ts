/**
 * Ranks counsellors against a person's stated preferences.
 *
 * This is deliberately shallow. It compares tags someone picked against tags a
 * counsellor put on their own profile, and nothing else: it does not read
 * check-ins, distress scores, reflections or any clinical field, and it does
 * not infer anything about the person beyond what they typed into the quiz.
 * The quiz is a filter, not an assessment, and keeping the scoring this dumb is
 * what stops it drifting into being one.
 *
 * Every match carries its reasons, for the same reason the distress score
 * carries its breakdown: a ranked list a person cannot interrogate is a ranked
 * list they have to take on trust.
 */
import {
  CounsellorDirectoryEntry,
  CounsellorMatch,
  MatchReason,
  MatchingQuizAnswers,
} from "../types/index.js";

/** Weights. Specialty overlap dominates; everything else adjusts within it. */
const SPECIALTY_POINTS = 3;
const LANGUAGE_POINTS = 2;
const FORMAT_POINTS = 2;
const AVAILABILITY_POINTS = 1;

export const SHORTLIST_MIN = 3;
export const SHORTLIST_MAX = 5;

/**
 * Turns tags into something a person would say out loud.
 *
 * These strings are read by the person choosing, so "legal_stress,
 * discrimination" is not good enough — the stored tag is an implementation
 * detail and should not surface in the reason a counsellor was suggested.
 */
const readable = (tag: string): string => tag.replace(/_/g, " ");

const listPhrase = (tags: string[]): string => {
  const words = tags.map(readable);
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
};

const overlap = (a: string[] = [], b: string[] = []): string[] => {
  const set = new Set(b);
  return a.filter((x) => set.has(x));
};

/**
 * Preferences that remove a counsellor from consideration rather than lowering
 * their rank.
 *
 * Gender is a hard filter when stated: showing someone a counsellor of a gender
 * they explicitly ruled out is not a near miss, it is ignoring them. Urgency is
 * a hard filter for the same practical reason — a counsellor who is full cannot
 * start this week whatever else matches.
 */
function passesHardFilters(c: CounsellorDirectoryEntry, prefs: MatchingQuizAnswers): boolean {
  if (prefs.genderPreference !== "no_preference") {
    if (!c.gender || c.gender !== prefs.genderPreference) return false;
  }
  if (prefs.startUrgency === "asap" || prefs.startUrgency === "this_week") {
    if (!c.acceptingNewClients) return false;
  }
  return true;
}

function scoreOne(c: CounsellorDirectoryEntry, prefs: MatchingQuizAnswers): CounsellorMatch {
  const reasons: MatchReason[] = [];
  let score = 0;

  const sharedSpecialties = overlap(prefs.lookingFor, c.specialties);
  if (sharedSpecialties.length) {
    score += sharedSpecialties.length * SPECIALTY_POINTS;
    reasons.push({ kind: "specialty", label: `Works with ${listPhrase(sharedSpecialties)}` });
  }

  const sharedLanguages = overlap(prefs.preferredLanguages, c.languages);
  if (sharedLanguages.length) {
    score += LANGUAGE_POINTS;
    reasons.push({ kind: "language", label: `Speaks ${sharedLanguages.join(", ")}` });
  }

  const sharedFormats = overlap(prefs.preferredFormats, c.sessionFormats);
  if (sharedFormats.length) {
    score += FORMAT_POINTS;
    reasons.push({ kind: "format", label: `Offers ${sharedFormats.join(", ")} sessions` });
  }

  if (c.acceptingNewClients) {
    score += AVAILABILITY_POINTS;
    reasons.push({ kind: "availability", label: "Accepting new clients" });
  }

  if (prefs.genderPreference !== "no_preference" && c.gender === prefs.genderPreference) {
    reasons.push({ kind: "gender", label: "Matches your stated preference" });
  }

  return { counsellor: c, score, reasons };
}

/**
 * Returns the shortlist. Ordering is fully deterministic — score, then rating
 * where one is published, then name — so the same answers always produce the
 * same list and a person retaking the quiz is not shown a reshuffled deck.
 */
export function rankCounsellors(
  counsellors: CounsellorDirectoryEntry[],
  prefs: MatchingQuizAnswers
): CounsellorMatch[] {
  const eligible = counsellors.filter((c) => passesHardFilters(c, prefs));

  // If the hard filters leave too few people to choose between, a shortlist is
  // not a choice. Fall back to the whole list rather than presenting one or two
  // names as though they were the only options.
  const pool = eligible.length >= SHORTLIST_MIN ? eligible : counsellors;

  return pool
    .map((c) => scoreOne(c, prefs))
    .filter((m) => m.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ra = a.counsellor.ratingAvg ?? -1;
      const rb = b.counsellor.ratingAvg ?? -1;
      if (rb !== ra) return rb - ra;
      return a.counsellor.displayName.localeCompare(b.counsellor.displayName);
    })
    .slice(0, SHORTLIST_MAX);
}

/** True when the hard filters were loosened, so the UI can say so plainly. */
export function shortlistWasWidened(
  counsellors: CounsellorDirectoryEntry[],
  prefs: MatchingQuizAnswers
): boolean {
  return counsellors.filter((c) => passesHardFilters(c, prefs)).length < SHORTLIST_MIN;
}

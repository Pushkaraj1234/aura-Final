/**
 * Validated instruments, kept deliberately separate from AURA's own score.
 *
 * AURA's 0-100 distress score is auditable, which is a different and lesser
 * property than validated. Its weights (28 / 22 / 22 / 17 / 11) were chosen,
 * not derived from outcome data, and nothing in this repository has been
 * psychometrically tested on anybody. A person assessing this work separates
 * those two claims instantly, and so should the product.
 *
 * So this module holds instruments that other people validated, and the three
 * rules that keep them worth having:
 *
 *   1. An instrument score is never blended into the AURA score. They are
 *      shown side by side. The instrument is the anchor; AURA is the thing
 *      that notices change between administrations. Averaging them would
 *      destroy the only property that makes the instrument useful here, which
 *      is that it means the same thing in this app as it does in the
 *      literature.
 *   2. Raw item responses are stored, never only the total. A total cannot be
 *      re-scored, re-checked, or compared against a later revision of the
 *      scoring rule, and an instrument you cannot re-score is an instrument
 *      you are asking people to take on trust.
 *   3. Every administration records which instrument version produced it, so
 *      a change to the items or the scoring never silently reinterprets
 *      answers collected under the old one.
 *
 * WHO-5 is included because the WHO took copyright of it in 2024 and it is
 * free to use worldwide without permission or licence fee, which is not true
 * of every brief instrument. Its item wording, its six-point response scale
 * and its scoring rule are reproduced exactly; a five-point "WHO-5" would not
 * be a WHO-5, and inventing one would be the precise failure this module
 * exists to avoid.
 */

export type InstrumentId = "who5";

export interface InstrumentItem {
  /** Stable key. Raw responses are stored against this, never against an index. */
  id: string;
  text: string;
}

export interface InstrumentOption {
  value: number;
  label: string;
}

export interface Instrument {
  id: InstrumentId;
  name: string;
  /** Bumped whenever items, options or scoring change. Stored per administration. */
  version: number;
  /** Shown above the items, verbatim. Carries the recall window. */
  instruction: string;
  recallWindow: string;
  items: InstrumentItem[];
  /** Highest value first, so the best answer sits at the top like every other scale in the app. */
  options: InstrumentOption[];
  rawRange: { min: number; max: number };
  scaledRange: { min: number; max: number };
  /** What the instrument is and is not, in the product's own words. */
  disclosure: string;
  attribution: string;
}

/**
 * WHO-5 Well-Being Index.
 *
 * Five items, a six-point 0-5 response scale, two-week recall. Raw total runs
 * 0-25 and is conventionally multiplied by 4 to give 0-100, which is the
 * number usually reported. A raw total at or below 13 (52 scaled) is the
 * commonly cited threshold for "worth looking at more closely". That is a
 * screening cue for a conversation, not a diagnosis, and this app does not
 * make diagnoses.
 */
export const WHO5: Instrument = {
  id: "who5",
  name: "WHO-5 Well-Being Index",
  version: 1,
  instruction:
    "Please indicate for each of the five statements which is closest to how you have been feeling over the last two weeks.",
  recallWindow: "the last two weeks",
  items: [
    { id: "cheerful", text: "I have felt cheerful and in good spirits" },
    { id: "calm", text: "I have felt calm and relaxed" },
    { id: "active", text: "I have felt active and vigorous" },
    { id: "rested", text: "I woke up feeling fresh and rested" },
    { id: "interested", text: "My daily life has been filled with things that interest me" },
  ],
  options: [
    { value: 5, label: "All of the time" },
    { value: 4, label: "Most of the time" },
    { value: 3, label: "More than half of the time" },
    { value: 2, label: "Less than half of the time" },
    { value: 1, label: "Some of the time" },
    { value: 0, label: "At no time" },
  ],
  rawRange: { min: 0, max: 25 },
  scaledRange: { min: 0, max: 100 },
  disclosure:
    "The WHO-5 is a short wellbeing questionnaire used and tested widely. A low score is a reason to talk to someone, not a diagnosis.",
  attribution:
    "WHO-5 Well-Being Index, World Health Organization. Copyright held by WHO since 2024 and free to use without permission.",
};

export const INSTRUMENTS: Record<InstrumentId, Instrument> = { who5: WHO5 };

/** One person's answers to one administration. Keyed by item id, never by position. */
export type ItemResponses = Record<string, number>;

export interface InstrumentScore {
  instrumentId: InstrumentId;
  instrumentVersion: number;
  /** Sum of the raw item values. */
  raw: number;
  /** The conventionally reported figure. For WHO-5, raw x 4. */
  scaled: number;
  /** True when every item was answered. A partial set is not a score. */
  complete: boolean;
  answered: number;
  total: number;
}

export class IncompleteInstrumentError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Cannot score: ${missing.length} item(s) unanswered`);
    this.name = "IncompleteInstrumentError";
  }
}

/**
 * Scores an administration, refusing to guess.
 *
 * An unanswered item is not a zero. On WHO-5, zero is "At no time", the worst
 * available answer, so treating a skipped item as zero would silently report
 * someone as less well than they said. Partial sets throw rather than return
 * a number that looks usable.
 */
export function scoreInstrument(
  instrument: Instrument,
  responses: ItemResponses
): InstrumentScore {
  const valid = new Set(instrument.options.map((o) => o.value));
  const missing: string[] = [];
  let raw = 0;

  for (const item of instrument.items) {
    const value = responses[item.id];
    if (value === undefined || value === null || !valid.has(value)) {
      missing.push(item.id);
      continue;
    }
    raw += value;
  }

  if (missing.length > 0) throw new IncompleteInstrumentError(missing);

  // WHO-5's documented conversion. Kept as an explicit ratio rather than a
  // hardcoded 4 so a second instrument with a different range cannot inherit
  // the wrong multiplier by accident.
  const scaled = Math.round(
    (raw / instrument.rawRange.max) * instrument.scaledRange.max
  );

  return {
    instrumentId: instrument.id,
    instrumentVersion: instrument.version,
    raw,
    scaled,
    complete: true,
    answered: instrument.items.length,
    total: instrument.items.length,
  };
}

/** How far through an administration someone is, without scoring it. */
export function administrationProgress(
  instrument: Instrument,
  responses: ItemResponses
): { answered: number; total: number; complete: boolean } {
  const valid = new Set(instrument.options.map((o) => o.value));
  const answered = instrument.items.filter((i) => valid.has(responses[i.id])).length;
  return { answered, total: instrument.items.length, complete: answered === instrument.items.length };
}

/**
 * The commonly cited WHO-5 screening threshold, raw <= 13 (52 scaled).
 *
 * Returned as a flag with its own wording rather than a boolean called
 * something like `isDepressed`, because the difference between "worth a
 * conversation" and "has a condition" is the whole distinction this product
 * is built on.
 */
export function who5NeedsALook(score: InstrumentScore): boolean {
  return score.instrumentId === "who5" && score.complete && score.raw <= 13;
}

// ---------------------------------------------------------------------------
// Administration records and scheduling
// ---------------------------------------------------------------------------

/** One completed administration, as stored. */
export interface InstrumentAdministration {
  id: string;
  participantId: string;
  instrumentId: InstrumentId;
  instrumentVersion: number;
  itemResponses: ItemResponses;
  rawScore: number;
  scaledScore: number;
  administeredAt: string;
}

/**
 * The schedule from EVALUATION_PROTOCOL.md: baseline, then day 7, then day 30.
 *
 * Those three points are not arbitrary spacing. Baseline anchors the AURA
 * score against something external; day 7 is close enough to catch a person
 * whose situation moved fast; day 30 is the interval the concurrent-validity
 * study is powered for.
 */
export const WHO5_SCHEDULE_DAYS = [0, 7, 30] as const;

export type InstrumentDueReason = "never_taken" | "next_window_open" | "not_due" | "schedule_complete";

export interface InstrumentDue {
  due: boolean;
  reason: InstrumentDueReason;
  /** Which scheduled point this would be. Null once the schedule is finished. */
  nextDay: number | null;
  /** Days until the next point opens. Zero or less when it is open now. */
  daysUntilNext: number | null;
  administeredCount: number;
}

const DAY_MS = 86_400_000;

/**
 * Whether to offer WHO-5 right now.
 *
 * Deliberately never nags. Being asked the same five questions repeatedly by
 * an app is how people stop answering honestly, and an instrument answered
 * carelessly is worse than one not answered at all: it would enter the
 * validity study as real data and quietly wreck the correlation it exists to
 * measure. So the schedule runs to its end and then stops asking.
 *
 * `enrolledAt` is the anchor for day 0. Everything after is measured from the
 * FIRST administration, not from enrolment, because a person who took the
 * baseline late should still get a real seven-day gap before the next one.
 */
export function who5Due(
  administrations: InstrumentAdministration[],
  enrolledAt: string,
  now: number = Date.now()
): InstrumentDue {
  const who5 = administrations
    .filter((a) => a.instrumentId === "who5")
    .sort((a, b) => Date.parse(a.administeredAt) - Date.parse(b.administeredAt));

  if (who5.length === 0) {
    const enrolled = Date.parse(enrolledAt);
    // An unparseable enrolment date must not hide the baseline. Offering it is
    // the safe direction: the person can decline, and a baseline that never
    // gets offered cannot be declined at all.
    return {
      due: true,
      reason: "never_taken",
      nextDay: 0,
      daysUntilNext: Number.isFinite(enrolled) ? Math.max(0, Math.ceil((enrolled - now) / DAY_MS)) : 0,
      administeredCount: 0,
    };
  }

  if (who5.length >= WHO5_SCHEDULE_DAYS.length) {
    return {
      due: false,
      reason: "schedule_complete",
      nextDay: null,
      daysUntilNext: null,
      administeredCount: who5.length,
    };
  }

  const baseline = Date.parse(who5[0]!.administeredAt);
  const nextDay = WHO5_SCHEDULE_DAYS[who5.length]!;
  if (!Number.isFinite(baseline)) {
    return {
      due: false,
      reason: "not_due",
      nextDay,
      daysUntilNext: null,
      administeredCount: who5.length,
    };
  }

  const opensAt = baseline + nextDay * DAY_MS;
  const daysUntilNext = Math.ceil((opensAt - now) / DAY_MS);
  return {
    due: now >= opensAt,
    reason: now >= opensAt ? "next_window_open" : "not_due",
    nextDay,
    daysUntilNext,
    administeredCount: who5.length,
  };
}

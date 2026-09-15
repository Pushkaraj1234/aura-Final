import { CheckIn, Participant } from "../types";
import { calculateRawScore } from "./riskEngine";
import { MIN_GROUP_SIZE } from "./communityAggregates";
import { who5NeedsALook, scoreInstrument, WHO5, type InstrumentAdministration } from "./instruments";

/**
 * Study 2 of docs/EVALUATION_PROTOCOL.md, computed rather than described.
 *
 * The umbrella review this work was audited against reports the same finding
 * repeatedly: models calibrated on one population perform inconsistently on
 * people whose communication style or cultural norms differ from the training
 * data. For AURA that is not a tail risk. Its users answer in Hindi and
 * Marathi, some through a machine-translated interface, and every model in the
 * pipeline was trained overwhelmingly on English. If AURA is going to be
 * wrong, this is where.
 *
 * THE ERROR THIS MEASURES, AND WHY IT IS NOT ACCURACY
 *
 * A missed survivor is the costly error. Someone in real distress whom AURA
 * scores low is not inconvenienced, they are left alone. A false alarm costs a
 * counsellor ten minutes. Reporting overall accuracy would let a slice with a
 * terrible miss rate hide behind a large true-negative count, which is exactly
 * the failure mode that makes a fairness dashboard worse than none.
 *
 * So the reported figure is the false-negative rate per slice: of the people
 * WHO-5 flagged as worth a closer look, what fraction did AURA leave in a
 * non-elevated band.
 *
 * WHAT IT REFUSES TO DO
 *
 * It does not report a slice smaller than MIN_GROUP_SIZE, for the same reason
 * communityAggregates does not: a rate over three people, printed next to a
 * language name, is a sentence about those three people. It does not
 * substitute an overall number when a slice is suppressed. And it does not
 * return zero when there is nothing to divide by, because a 0% miss rate
 * computed from no cases is the most dangerous number this file could
 * produce: it reads as perfect and means nothing.
 */

/** A WHO-5 administration matched to the check-in nearest it in time. */
export interface FairnessPair {
  participantId: string;
  administeredAt: string;
  checkInAt: string;
  /** Days between the two. Kept so the matching window is auditable. */
  gapDays: number;
  who5Raw: number;
  /** WHO-5 raw <= 13, the reference for "worth a closer look". */
  who5Flagged: boolean;
  auraScore: number;
  /** AURA placed this at or above the elevated band. */
  auraElevated: boolean;
  slices: Record<SliceDimension, string>;
}

export type SliceDimension = "language" | "ageGroup" | "region" | "inputMode" | "counsellor";

export const SLICE_LABELS: Record<SliceDimension, string> = {
  language: "Language of use",
  ageGroup: "Age group",
  region: "Region",
  inputMode: "Voice or text",
  counsellor: "Counsellor assigned",
};

/**
 * How far apart a WHO-5 answer and a check-in may be and still describe the
 * same person at the same time.
 *
 * Seven days, because WHO-5 asks about the last two weeks while a check-in
 * asks about the last three days. Pairing answers a fortnight apart would
 * measure drift rather than agreement, and the resulting disagreement would be
 * read as AURA being wrong when it was simply being asked about a different
 * week.
 */
export const PAIRING_WINDOW_DAYS = 7;

/** AURA's elevated band, matching communityAggregates. */
export const ELEVATED_AT = 60;

const DAY_MS = 86_400_000;

export interface SliceResult {
  /** The slice value, e.g. "hi" or "25-34". */
  value: string;
  /** Pairs falling in this slice. */
  n: number;
  /** Of those, how many WHO-5 flagged. The denominator of the miss rate. */
  flagged: number;
  /** Of the flagged, how many AURA left below the elevated band. */
  missed: number;
  /**
   * missed / flagged as a percentage, or null when there is nothing to
   * divide by. Null is not zero and must not be rendered as zero.
   */
  falseNegativeRate: number | null;
  /** True when this slice is too small to report. n and rate are withheld. */
  suppressed: boolean;
}

export interface SliceReport {
  dimension: SliceDimension;
  label: string;
  slices: SliceResult[];
  /** Slices withheld for being smaller than MIN_GROUP_SIZE. */
  suppressedCount: number;
  /**
   * Largest gap in false-negative rate between two reportable slices, in
   * percentage points. Null when fewer than two slices are reportable, which
   * is the usual case early on and must not read as "no disparity found".
   */
  widestGap: number | null;
}

export interface FairnessReport {
  pairs: number;
  /** Administrations that had no check-in inside the window. */
  unpaired: number;
  flagged: number;
  missed: number;
  /** Overall FNR, or null when nothing was flagged. */
  overallFalseNegativeRate: number | null;
  dimensions: SliceReport[];
  /** True when the whole sample is below the reporting floor. */
  suppressed: boolean;
  generatedAt: string;
}

const bucketOrUnknown = (value: string | undefined | null): string => {
  const trimmed = (value || "").trim();
  return trimmed === "" ? "Not recorded" : trimmed;
};

/**
 * Pairs each WHO-5 administration with the check-in nearest it in time.
 *
 * Nearest in either direction, not the most recent before it. A person who
 * answers WHO-5 and then checks in an hour later has told us about the same
 * period, and discarding that pair for being an hour on the wrong side would
 * throw away data for no reason. Administrations with nothing inside the
 * window are counted as unpaired rather than dropped silently: a study that
 * quietly discards the participants who check in rarely has selected for the
 * engaged, which is the bias most likely to flatter the result.
 */
export function pairAdministrations(
  participants: Participant[],
  administrations: InstrumentAdministration[],
  checkInsByParticipant: Map<string, CheckIn[]>
): { pairs: FairnessPair[]; unpaired: number } {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const pairs: FairnessPair[] = [];
  let unpaired = 0;

  for (const admin of administrations) {
    if (admin.instrumentId !== "who5") continue;
    const participant = byId.get(admin.participantId);
    if (!participant) {
      unpaired++;
      continue;
    }

    const at = Date.parse(admin.administeredAt);
    if (!Number.isFinite(at)) {
      unpaired++;
      continue;
    }

    const checkIns = checkInsByParticipant.get(admin.participantId) || [];
    let best: CheckIn | null = null;
    let bestGap = Infinity;
    for (const checkIn of checkIns) {
      const t = Date.parse(checkIn.timestamp);
      if (!Number.isFinite(t)) continue;
      const gap = Math.abs(t - at);
      if (gap < bestGap) {
        bestGap = gap;
        best = checkIn;
      }
    }

    if (!best || bestGap > PAIRING_WINDOW_DAYS * DAY_MS) {
      unpaired++;
      continue;
    }

    // Rescored from the stored item responses rather than read from the
    // stored total, so a corrected scoring rule reaches the evaluation
    // instead of being masked by a number frozen at collection time.
    let who5Raw: number;
    try {
      who5Raw = scoreInstrument(WHO5, admin.itemResponses).raw;
    } catch {
      unpaired++;
      continue;
    }

    const auraScore = calculateRawScore(best);
    pairs.push({
      participantId: admin.participantId,
      administeredAt: admin.administeredAt,
      checkInAt: best.timestamp,
      gapDays: Math.round((bestGap / DAY_MS) * 10) / 10,
      who5Raw,
      who5Flagged: who5NeedsALook({
        instrumentId: "who5",
        instrumentVersion: admin.instrumentVersion,
        raw: who5Raw,
        scaled: who5Raw * 4,
        complete: true,
        answered: WHO5.items.length,
        total: WHO5.items.length,
      }),
      auraScore,
      auraElevated: auraScore >= ELEVATED_AT,
      slices: {
        language: bucketOrUnknown(participant.language),
        ageGroup: bucketOrUnknown(participant.ageGroup),
        region: bucketOrUnknown(participant.region),
        inputMode: best.voiceInputUsed ? "Voice" : "Text",
        counsellor: participant.assignedWorker ? "Assigned" : "Not assigned",
      },
    });
  }

  return { pairs, unpaired };
}

function summariseDimension(pairs: FairnessPair[], dimension: SliceDimension): SliceReport {
  const groups = new Map<string, FairnessPair[]>();
  for (const pair of pairs) {
    const value = pair.slices[dimension];
    const bucket = groups.get(value);
    if (bucket) bucket.push(pair);
    else groups.set(value, [pair]);
  }

  const slices: SliceResult[] = [];
  let suppressedCount = 0;

  for (const [value, members] of groups) {
    if (members.length < MIN_GROUP_SIZE) {
      suppressedCount++;
      slices.push({
        value,
        n: 0,
        flagged: 0,
        missed: 0,
        falseNegativeRate: null,
        suppressed: true,
      });
      continue;
    }
    const flagged = members.filter((m) => m.who5Flagged).length;
    const missed = members.filter((m) => m.who5Flagged && !m.auraElevated).length;
    slices.push({
      value,
      n: members.length,
      flagged,
      missed,
      // Null rather than zero when nothing was flagged. A 0% miss rate over no
      // cases reads as a clean bill of health and is not one.
      falseNegativeRate: flagged === 0 ? null : Math.round((missed / flagged) * 1000) / 10,
      suppressed: false,
    });
  }

  slices.sort((a, b) => {
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
    return b.n - a.n;
  });

  const rates = slices
    .filter((s) => !s.suppressed && s.falseNegativeRate !== null)
    .map((s) => s.falseNegativeRate as number);
  const widestGap =
    rates.length >= 2 ? Math.round((Math.max(...rates) - Math.min(...rates)) * 10) / 10 : null;

  return { dimension, label: SLICE_LABELS[dimension], slices, suppressedCount, widestGap };
}

const DIMENSIONS: SliceDimension[] = [
  "language",
  "ageGroup",
  "region",
  "inputMode",
  "counsellor",
];

export function computeFairnessReport(
  participants: Participant[],
  administrations: InstrumentAdministration[],
  checkInsByParticipant: Map<string, CheckIn[]>,
  now: number = Date.now()
): FairnessReport {
  const { pairs, unpaired } = pairAdministrations(
    participants,
    administrations,
    checkInsByParticipant
  );

  const flagged = pairs.filter((p) => p.who5Flagged).length;
  const missed = pairs.filter((p) => p.who5Flagged && !p.auraElevated).length;

  // Below the floor, nothing is reported at all, not even the dimension
  // breakdown. Suppressing individual slices while publishing an overall
  // figure over the same handful of people would give the arithmetic away.
  if (pairs.length < MIN_GROUP_SIZE) {
    return {
      pairs: pairs.length,
      unpaired,
      flagged: 0,
      missed: 0,
      overallFalseNegativeRate: null,
      dimensions: [],
      suppressed: true,
      generatedAt: new Date(now).toISOString(),
    };
  }

  return {
    pairs: pairs.length,
    unpaired,
    flagged,
    missed,
    overallFalseNegativeRate:
      flagged === 0 ? null : Math.round((missed / flagged) * 1000) / 10,
    dimensions: DIMENSIONS.map((d) => summariseDimension(pairs, d)),
    suppressed: false,
    generatedAt: new Date(now).toISOString(),
  };
}

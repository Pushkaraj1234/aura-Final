import { Participant, CheckIn } from "../types";
import { calculateRawScore } from "./riskEngine";

/**
 * Regional aggregates, computed from the real participant records.
 *
 * This replaces four hardcoded rows. `CommunityInsights` used to render a
 * `MOCK_REGIONS` constant under the headings "Anonymous Macro Analytics" and
 * "Privacy-Preserving Aggregations", including a `recommendedCounselors`
 * figure and free-text advice like "Recommend expanding peer group outreach".
 * None of it came from anywhere. A coordinator could have moved real staff
 * between real districts on the strength of numbers that described nothing,
 * and the framing actively asserted the opposite.
 *
 * Two things matter more here than the arithmetic.
 *
 * Small groups are withheld, not shown. A region with three participants is a
 * region where an aggregate can identify someone: a mean distress score across
 * three people, published next to a district name, is a sentence about those
 * three people. `MIN_GROUP_SIZE` is the k in k-anonymity and nothing below it
 * is reported, including in the totals.
 *
 * And the page says what it withheld. A dashboard showing three regions and
 * silently dropping five reads as a complete picture of three regions. The
 * suppressed count is returned so the screen can say "5 regions withheld",
 * which is both honest and, for anyone assessing the work, more informative
 * than a fuller-looking table would have been.
 */

/** The k in k-anonymity. Regions with fewer participants are not reported. */
export const MIN_GROUP_SIZE = 5;

export interface RegionAggregate {
  region: string;
  participants: number;
  checkIns: number;
  /** Mean of the current scoring model across every check-in in the region. */
  meanScore: number | null;
  /** Participants whose most recent check-in scores at or above 60. */
  elevated: number;
  /** Participants with no check-in in the last 14 days, among those who ever had one. */
  quiet: number;
}

export interface CommunityAggregates {
  regions: RegionAggregate[];
  /** How many regions were withheld for being smaller than MIN_GROUP_SIZE. */
  suppressedRegions: number;
  /** How many participants sit inside those withheld regions. */
  suppressedParticipants: number;
  /** Participants with no region recorded. Counted, never invented into one. */
  unassigned: number;
  reportedParticipants: number;
  totalParticipants: number;
}

export interface SignalCount {
  name: string;
  /** Participants whose most recent check-in shows this. */
  count: number;
  /** Share of the reporting cohort, 0-100. */
  percent: number;
}

export interface CommonSignals {
  signals: SignalCount[];
  /** Participants with at least one check-in. The denominator, stated. */
  basis: number;
  /** True when the whole cohort is too small to report at all. */
  suppressed: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const QUIET_AFTER_DAYS = 14;
const ELEVATED_AT = 60;

const latestCheckIn = (checkIns: CheckIn[]): CheckIn | null =>
  checkIns.length === 0
    ? null
    : checkIns.reduce((newest, c) =>
        new Date(c.timestamp).getTime() > new Date(newest.timestamp).getTime() ? c : newest
      );

/**
 * Builds the regional picture, withholding anything too small to publish.
 *
 * `now` is a parameter rather than a call to Date.now() so the quiet-participant
 * count is testable without freezing the clock.
 */
export function computeCommunityAggregates(
  participants: Participant[],
  now: number = Date.now()
): CommunityAggregates {
  const byRegion = new Map<string, Participant[]>();
  let unassigned = 0;

  for (const p of participants) {
    const region = (p.region || "").trim();
    if (!region) {
      unassigned++;
      continue;
    }
    const bucket = byRegion.get(region);
    if (bucket) bucket.push(p);
    else byRegion.set(region, [p]);
  }

  const regions: RegionAggregate[] = [];
  let suppressedRegions = 0;
  let suppressedParticipants = 0;
  let reportedParticipants = 0;

  for (const [region, members] of byRegion) {
    if (members.length < MIN_GROUP_SIZE) {
      suppressedRegions++;
      suppressedParticipants += members.length;
      continue;
    }

    const scores: number[] = [];
    let checkIns = 0;
    let elevated = 0;
    let quiet = 0;

    for (const p of members) {
      const all = p.checkIns || [];
      checkIns += all.length;
      for (const c of all) scores.push(calculateRawScore(c));

      const latest = latestCheckIn(all);
      if (!latest) continue;
      if (calculateRawScore(latest) >= ELEVATED_AT) elevated++;
      if (now - new Date(latest.timestamp).getTime() > QUIET_AFTER_DAYS * DAY) quiet++;
    }

    regions.push({
      region,
      participants: members.length,
      checkIns,
      meanScore:
        scores.length === 0
          ? null
          : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      elevated,
      quiet,
    });
    reportedParticipants += members.length;
  }

  // Busiest first. A coordinator reading this is looking for where the load is,
  // not for an alphabet.
  regions.sort((a, b) => b.participants - a.participants);

  return {
    regions,
    suppressedRegions,
    suppressedParticipants,
    unassigned,
    reportedParticipants,
    totalParticipants: participants.length,
  };
}

/**
 * How often each reported difficulty shows up, across the cohort.
 *
 * Counted per person on their most recent check-in, not per check-in. Counting
 * check-ins would weight the answer towards whoever fills the form most often,
 * which on this product is not a neutral bias: the people it most wants to
 * notice are the ones who go quiet.
 *
 * The whole cohort is withheld when it is smaller than MIN_GROUP_SIZE, for the
 * same reason a small region is. The denominator is returned either way so the
 * screen can show percentages against a number rather than on their own.
 */
export function computeCommonSignals(participants: Participant[]): CommonSignals {
  const latest = participants
    .map((p) => latestCheckIn(p.checkIns || []))
    .filter((c): c is CheckIn => c !== null);

  const basis = latest.length;
  if (basis < MIN_GROUP_SIZE) return { signals: [], basis, suppressed: true };

  const tally = (predicate: (c: CheckIn) => boolean) => latest.filter(predicate).length;

  const raw: Array<{ name: string; count: number }> = [
    { name: "Stress or tension", count: tally((c) => c.stress >= 4) },
    { name: "Sleep and rest", count: tally((c) => c.sleep <= 2) },
    { name: "Feeling disconnected", count: tally((c) => c.connection <= 2) },
    { name: "Safety uncertain", count: tally((c) => c.safety === "Unsure" || c.safety === "No") },
    { name: "Asked for support", count: tally((c) => c.supportRequested) },
  ];

  return {
    signals: raw
      .map((s) => ({ ...s, percent: Math.round((s.count / basis) * 100) }))
      .sort((a, b) => b.count - a.count),
    basis,
    suppressed: false,
  };
}

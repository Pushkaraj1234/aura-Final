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

// ---------------------------------------------------------------------------
// Cohort-level figures
// ---------------------------------------------------------------------------

/**
 * The headline counts, computed rather than asserted.
 *
 * These replaced a hardcoded block reading "128 participants monitored",
 * "46% improving (59)", "31% stable (40)", "18% increasing (23)", "5% urgent
 * (6)" and "across 4 humanitarian zones". Not one of those numbers came from
 * anywhere. A badge above them said "Synthetic Demonstration Aggregates",
 * which is honest labelling of a dashboard that still reads, at a glance, as
 * a report on real people in real districts.
 *
 * The same suppression rule as everything else on this page: below
 * MIN_GROUP_SIZE nothing is published, because a trend breakdown over four
 * people is a description of those four people.
 */
export interface CohortTrend {
  /** Participants with at least one check-in. The denominator, stated. */
  basis: number;
  totalParticipants: number;
  improving: number;
  stable: number;
  increasing: number;
  /** Most recent check-in reported an immediate safety concern. */
  urgent: number;
  /** Participants with only one check-in, who have no direction yet. */
  tooEarly: number;
  regionsReported: number;
  suppressed: boolean;
}

/** Change between the two most recent check-ins that counts as a direction. */
const TREND_DELTA = 5;

/**
 * Direction of travel for one person, from their two most recent check-ins.
 *
 * Two points rather than a fitted line, deliberately. A slope across a whole
 * history is dominated by where someone started, so a person who arrived in
 * crisis and has been slowly improving for months still reads as "high", and
 * a person who was fine for a year and collapsed last week still reads as
 * "stable". The question this page asks is which way someone is moving now.
 */
const directionFor = (checkIns: CheckIn[]): "improving" | "stable" | "increasing" | "too_early" => {
  const ordered = [...checkIns].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  if (ordered.length < 2) return "too_early";
  const previous = calculateRawScore(ordered[ordered.length - 2]!);
  const latest = calculateRawScore(ordered[ordered.length - 1]!);
  const delta = latest - previous;
  if (delta <= -TREND_DELTA) return "improving";
  if (delta >= TREND_DELTA) return "increasing";
  return "stable";
};

export function computeCohortTrend(participants: Participant[]): CohortTrend {
  const withHistory = participants.filter((p) => (p.checkIns || []).length > 0);
  const regionsReported = new Set(
    participants.map((p) => (p.region || "").trim()).filter((r) => r !== "")
  ).size;

  if (withHistory.length < MIN_GROUP_SIZE) {
    return {
      basis: withHistory.length,
      totalParticipants: participants.length,
      improving: 0,
      stable: 0,
      increasing: 0,
      urgent: 0,
      tooEarly: 0,
      regionsReported,
      suppressed: true,
    };
  }

  let improving = 0;
  let stable = 0;
  let increasing = 0;
  let urgent = 0;
  let tooEarly = 0;

  for (const p of withHistory) {
    const checkIns = p.checkIns || [];
    const latest = latestCheckIn(checkIns);
    // Counted separately and first: an immediate safety concern is not a
    // direction of travel, and folding it into "increasing" would hide it.
    if (latest?.immediateSafetyConcern) urgent++;

    switch (directionFor(checkIns)) {
      case "improving":
        improving++;
        break;
      case "increasing":
        increasing++;
        break;
      case "stable":
        stable++;
        break;
      default:
        tooEarly++;
    }
  }

  return {
    basis: withHistory.length,
    totalParticipants: participants.length,
    improving,
    stable,
    increasing,
    urgent,
    tooEarly,
    regionsReported,
    suppressed: false,
  };
}

/**
 * Share of participants who have given consent, for the counsellor dashboard.
 *
 * Replaced a hardcoded "96%". Reported as a fraction as well as a percentage,
 * because "96%" over twenty-five people and "96%" over a thousand are
 * different claims and the dashboard should not flatten them.
 */
export interface ConsentCoverage {
  consented: number;
  total: number;
  percent: number | null;
  suppressed: boolean;
}

export function computeConsentCoverage(participants: Participant[]): ConsentCoverage {
  const total = participants.length;
  if (total < MIN_GROUP_SIZE) {
    return { consented: 0, total, percent: null, suppressed: true };
  }
  const consented = participants.filter((p) => p.consentGiven).length;
  return {
    consented,
    total,
    percent: Math.round((consented / total) * 100),
    suppressed: false,
  };
}

/**
 * Mean distress change across the cohort over a window, against the window
 * before it.
 *
 * Replaced a hardcoded "+12% Early wellbeing change - 7 days", which had the
 * additional problem of a sign nobody could interpret: on a scale where 100 is
 * worst, "+12%" next to a green upward arrow read as good news and would have
 * meant the opposite. This returns points on the distress scale, not a
 * percentage, and says which direction is which.
 */
export interface CohortChange {
  /** Mean score in the recent window, or null when there is nothing to average. */
  recentMean: number | null;
  priorMean: number | null;
  /** recentMean - priorMean. Negative is an improvement, because 100 is worst. */
  deltaPoints: number | null;
  /** Check-ins in the recent window. The basis for the mean. */
  recentCount: number;
  priorCount: number;
  windowDays: number;
  suppressed: boolean;
}

export function computeCohortChange(
  participants: Participant[],
  windowDays = 7,
  now: number = Date.now()
): CohortChange {
  const windowMs = windowDays * DAY;
  const recent: number[] = [];
  const prior: number[] = [];

  for (const p of participants) {
    for (const checkIn of p.checkIns || []) {
      const at = new Date(checkIn.timestamp).getTime();
      if (!Number.isFinite(at)) continue;
      const age = now - at;
      if (age < 0) continue;
      if (age <= windowMs) recent.push(calculateRawScore(checkIn));
      else if (age <= windowMs * 2) prior.push(calculateRawScore(checkIn));
    }
  }

  const mean = (values: number[]): number | null =>
    values.length === 0
      ? null
      : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

  // Both windows must clear the floor. A delta against three check-ins is a
  // statement about those three check-ins.
  const suppressed = recent.length < MIN_GROUP_SIZE || prior.length < MIN_GROUP_SIZE;
  const recentMean = mean(recent);
  const priorMean = mean(prior);

  return {
    recentMean: suppressed ? null : recentMean,
    priorMean: suppressed ? null : priorMean,
    deltaPoints:
      suppressed || recentMean === null || priorMean === null
        ? null
        : Math.round((recentMean - priorMean) * 10) / 10,
    recentCount: recent.length,
    priorCount: prior.length,
    windowDays,
    suppressed,
  };
}

/**
 * Daily mean distress over a window, for the community trend chart.
 *
 * That chart was an SVG path drawn by hand: a fixed `d` attribute with five
 * labelled nodes reading 52, 58, 54, 44, 38, under a caption claiming it
 * averaged 128 participants. It described a recovery that never happened to
 * anybody.
 *
 * Days below MIN_GROUP_SIZE are returned as gaps rather than points, and a
 * gap is not interpolated across. A line drawn smoothly through a day when
 * two people checked in is a picture of those two people, and joining it to
 * the days either side hides that it happened.
 */
export interface TrendPoint {
  /** Midnight of the day, ISO. */
  date: string;
  /** Days before `now`, with 0 being today. */
  daysAgo: number;
  /** Mean score that day, or null when too few check-ins to report. */
  mean: number | null;
  checkIns: number;
}

export interface DailyTrend {
  points: TrendPoint[];
  /** Days inside the window that had check-ins but too few to report. */
  suppressedDays: number;
  /** Days with a reportable mean. */
  reportedDays: number;
  /** True when no day in the window clears the floor. */
  suppressed: boolean;
  windowDays: number;
}

export function computeDailyTrend(
  participants: Participant[],
  windowDays = 14,
  now: number = Date.now()
): DailyTrend {
  const buckets = new Map<number, number[]>();
  for (let d = 0; d < windowDays; d++) buckets.set(d, []);

  for (const p of participants) {
    for (const checkIn of p.checkIns || []) {
      const at = new Date(checkIn.timestamp).getTime();
      if (!Number.isFinite(at)) continue;
      const daysAgo = Math.floor((now - at) / DAY);
      if (daysAgo < 0 || daysAgo >= windowDays) continue;
      buckets.get(daysAgo)!.push(calculateRawScore(checkIn));
    }
  }

  const points: TrendPoint[] = [];
  let suppressedDays = 0;
  let reportedDays = 0;

  // Oldest first, so the chart reads left to right like a timeline.
  for (let daysAgo = windowDays - 1; daysAgo >= 0; daysAgo--) {
    const scores = buckets.get(daysAgo)!;
    const reportable = scores.length >= MIN_GROUP_SIZE;
    if (scores.length > 0 && !reportable) suppressedDays++;
    if (reportable) reportedDays++;
    points.push({
      date: new Date(now - daysAgo * DAY).toISOString(),
      daysAgo,
      mean: reportable
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null,
      checkIns: scores.length,
    });
  }

  return {
    points,
    suppressedDays,
    reportedDays,
    suppressed: reportedDays === 0,
    windowDays,
  };
}

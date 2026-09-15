/**
 * The figures that replaced hardcoded ones.
 *
 * Community Insights and the counsellor dashboard between them asserted:
 * 128 participants, 46/31/18/5 percent improving/stable/rising/urgent with
 * invented counts in brackets, "across 4 humanitarian zones", a 14-day curve
 * drawn as a fixed SVG path with labelled nodes reading 52/58/54/44/38, a
 * "96%" consent coverage, an "18m" average response, a "+12%" weekly change,
 * a "4.2%" override rate "down from 5.3% last month" with a 78/22 split, and
 * a claim that alert thresholds "have been naturally recalibrating".
 *
 * None of it was measured, and the last one described a mechanism that does
 * not exist. The tests here pin the two properties that stop the replacements
 * from becoming the same thing: everything is computed from records, and
 * anything computed over too few people is withheld rather than shown.
 */
import {
  computeCohortTrend, computeConsentCoverage, computeCohortChange, computeDailyTrend,
  MIN_GROUP_SIZE,
} from '../dist-test/communityAggregates.js';
import { computeOverrideStats } from '../dist-test/overrideStats.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const NOW = Date.parse('2026-09-15T12:00:00Z');
const DAY = 86400000;
const daysAgo = (d) => new Date(NOW - d * DAY).toISOString();

const checkIn = (over = {}) => ({
  id: 'c' + Math.random(), participantId: 'p', timestamp: daysAgo(0),
  wellbeing: 3, stress: 3, sleep: 3, safety: 'Mostly', connection: 3,
  supportRequested: false, immediateSafetyConcern: false, scoreVersion: 2, ...over,
});
const calm = (over = {}) => checkIn({ wellbeing: 5, stress: 1, sleep: 5, safety: 'Yes', connection: 5, ...over });
const rough = (over = {}) => checkIn({ wellbeing: 1, stress: 5, sleep: 1, safety: 'No', connection: 1, ...over });

const participant = (id, checkIns = [], over = {}) => ({
  id, name: id, consentGiven: true, createdAt: daysAgo(60),
  preferredSupport: 'Human counselor', language: 'en', ageGroup: '25-34',
  checkIns, status: 'active', notes: [], ...over,
});

/** n people who each moved in the given direction between two check-ins. */
const movers = (n, direction, offset = 0) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const pair = direction === 'improving'
      ? [rough({ timestamp: daysAgo(3) }), calm({ timestamp: daysAgo(1) })]
      : direction === 'increasing'
        ? [calm({ timestamp: daysAgo(3) }), rough({ timestamp: daysAgo(1) })]
        : [calm({ timestamp: daysAgo(3) }), calm({ timestamp: daysAgo(1) })];
    out.push(participant(`${direction}-${offset}-${i}`, pair));
  }
  return out;
};

// ---- cohort trend ----------------------------------------------------------

t('a cohort below the floor publishes nothing, not a flattering breakdown', () => {
  const r = computeCohortTrend(movers(MIN_GROUP_SIZE - 1, 'improving'));
  eq(r.suppressed, true);
  eq(r.improving, 0, 'a withheld breakdown must not leak its counts');
  eq(r.stable, 0);
  eq(r.increasing, 0);
});

t('direction is read from the two most recent check-ins', () => {
  const r = computeCohortTrend([...movers(5, 'improving'), ...movers(5, 'increasing')]);
  eq(r.suppressed, false);
  eq(r.improving, 5);
  eq(r.increasing, 5);
  eq(r.basis, 10);
});

t('a long history does not drown out the recent move', () => {
  // A slope fitted across a whole history is dominated by where someone
  // started, so a person recovering from crisis still reads as "high". This
  // reads the direction they are moving now.
  const recovering = [];
  for (let i = 0; i < 6; i++) {
    recovering.push(participant(`rec-${i}`, [
      rough({ timestamp: daysAgo(40) }), rough({ timestamp: daysAgo(30) }),
      rough({ timestamp: daysAgo(20) }), rough({ timestamp: daysAgo(4) }),
      calm({ timestamp: daysAgo(1) }),
    ]));
  }
  eq(computeCohortTrend(recovering).improving, 6);
});

t('someone with one check-in has no direction and is counted as such', () => {
  const cohort = [...movers(5, 'stable'), ...Array.from({ length: 3 }, (_, i) =>
    participant(`new-${i}`, [calm({ timestamp: daysAgo(1) })]))];
  const r = computeCohortTrend(cohort);
  eq(r.tooEarly, 3);
  eq(r.basis, 8);
  eq(r.improving + r.stable + r.increasing + r.tooEarly, r.basis,
     'every person with history lands in exactly one bucket');
});

t('a safety concern is its own count, on top of the direction', () => {
  // Urgent is a separate axis, not a fourth direction. A coordinator reading
  // only the three directions must still see this, and someone who flags a
  // safety concern must not vanish from the direction breakdown either.
  const flagged = [];
  for (let i = 0; i < 6; i++) {
    flagged.push(participant(`s-${i}`, [
      calm({ timestamp: daysAgo(3) }),
      calm({ timestamp: daysAgo(1), immediateSafetyConcern: true }),
    ]));
  }
  const r = computeCohortTrend(flagged);
  eq(r.urgent, 6, 'counted on the urgent axis');
  // immediateSafetyConcern forces the score to 100, so these people really are
  // rising. The point is that they appear in both places, not only one.
  eq(r.increasing, 6);
  eq(r.improving + r.stable + r.increasing + r.tooEarly, r.basis,
     'the direction buckets still partition the cohort exactly once');
});

t('urgent is not a direction bucket of its own', () => {
  // If it were, the direction counts would stop summing to the basis and the
  // percentages rendered next to them would quietly not add up.
  const mixed = [
    ...movers(5, 'improving'),
    ...Array.from({ length: 5 }, (_, i) => participant(`u-${i}`, [
      calm({ timestamp: daysAgo(3) }),
      rough({ timestamp: daysAgo(1), immediateSafetyConcern: true }),
    ])),
  ];
  const r = computeCohortTrend(mixed);
  eq(r.basis, 10);
  eq(r.urgent, 5);
  eq(r.improving + r.stable + r.increasing + r.tooEarly, 10);
});

t('people with no check-ins are excluded from the basis but kept in the total', () => {
  const r = computeCohortTrend([...movers(6, 'stable'), participant('ghost', [])]);
  eq(r.basis, 6);
  eq(r.totalParticipants, 7);
});

t('districts are counted from real regions, never invented', () => {
  const withRegions = movers(6, 'stable').map((p, i) => ({ ...p, region: i < 3 ? 'A' : 'B' }));
  eq(computeCohortTrend(withRegions).regionsReported, 2);
  eq(computeCohortTrend(movers(6, 'stable')).regionsReported, 0, 'no region recorded means zero');
});

// ---- consent coverage ------------------------------------------------------

t('consent coverage is a real fraction, and reports both parts', () => {
  const people = [
    ...Array.from({ length: 8 }, (_, i) => participant(`y${i}`, [], { consentGiven: true })),
    ...Array.from({ length: 2 }, (_, i) => participant(`n${i}`, [], { consentGiven: false })),
  ];
  const r = computeConsentCoverage(people);
  eq(r.percent, 80);
  eq(r.consented, 8);
  eq(r.total, 10);
});

t('consent coverage over too few people is withheld, not rounded to 100', () => {
  const r = computeConsentCoverage([participant('a', [], { consentGiven: true })]);
  eq(r.suppressed, true);
  eq(r.percent, null, 'must be null, never 100');
});

// ---- weekly change ---------------------------------------------------------

t('the weekly change compares two real windows and names the direction', () => {
  // Worse recently: delta must be positive on a scale where 100 is worst.
  const people = [];
  for (let i = 0; i < 6; i++) {
    people.push(participant(`p${i}`, [
      calm({ timestamp: daysAgo(10) }), calm({ timestamp: daysAgo(9) }),
      rough({ timestamp: daysAgo(2) }), rough({ timestamp: daysAgo(1) }),
    ]));
  }
  const r = computeCohortChange(people, 7, NOW);
  eq(r.suppressed, false);
  ok(r.deltaPoints > 0, `distress rose, so delta must be positive; got ${r.deltaPoints}`);
});

t('an improving cohort produces a negative delta', () => {
  const people = [];
  for (let i = 0; i < 6; i++) {
    people.push(participant(`p${i}`, [
      rough({ timestamp: daysAgo(10) }), rough({ timestamp: daysAgo(9) }),
      calm({ timestamp: daysAgo(2) }), calm({ timestamp: daysAgo(1) }),
    ]));
  }
  ok(computeCohortChange(people, 7, NOW).deltaPoints < 0);
});

t('a missing prior window suppresses the delta rather than inventing a baseline', () => {
  const people = Array.from({ length: 6 }, (_, i) =>
    participant(`p${i}`, [calm({ timestamp: daysAgo(1) })]));
  const r = computeCohortChange(people, 7, NOW);
  eq(r.suppressed, true);
  eq(r.deltaPoints, null);
  eq(r.priorMean, null);
});

t('check-ins outside both windows are ignored entirely', () => {
  const people = Array.from({ length: 6 }, (_, i) =>
    participant(`p${i}`, [calm({ timestamp: daysAgo(90) })]));
  const r = computeCohortChange(people, 7, NOW);
  eq(r.recentCount, 0);
  eq(r.priorCount, 0);
  eq(r.deltaPoints, null);
});

// ---- the daily curve -------------------------------------------------------

t('a day with too few check-ins is a gap, not a plotted point', () => {
  // The whole reason the old chart was dishonest: it drew a smooth line
  // through days that had no data behind them.
  const people = [participant('a', [
    ...Array.from({ length: 6 }, () => calm({ timestamp: daysAgo(3) })),
    calm({ timestamp: daysAgo(2) }),  // one check-in: below the floor
  ])];
  const r = computeDailyTrend(people, 14, NOW);
  const day3 = r.points.find((p) => p.daysAgo === 3);
  const day2 = r.points.find((p) => p.daysAgo === 2);
  ok(day3.mean !== null, 'six check-ins clears the floor');
  eq(day2.mean, null, 'one check-in must not be plotted');
  eq(day2.checkIns, 1, 'but the count is still reported');
  eq(r.suppressedDays, 1);
});

t('a window with no reportable day is suppressed outright', () => {
  const r = computeDailyTrend([participant('a', [calm({ timestamp: daysAgo(1) })])], 14, NOW);
  eq(r.suppressed, true);
  eq(r.reportedDays, 0);
});

t('the curve runs oldest first, so it reads left to right', () => {
  const r = computeDailyTrend([], 14, NOW);
  eq(r.points.length, 14);
  eq(r.points[0].daysAgo, 13);
  eq(r.points[13].daysAgo, 0);
});

t('a day outside the window is not counted', () => {
  const people = [participant('a',
    Array.from({ length: 8 }, () => calm({ timestamp: daysAgo(20) })))];
  const r = computeDailyTrend(people, 14, NOW);
  eq(r.suppressed, true);
  eq(r.points.every((p) => p.checkIns === 0), true);
});

t('unparseable timestamps are skipped rather than landing on today', () => {
  const people = [participant('a', [
    ...Array.from({ length: 6 }, () => calm({ timestamp: 'not a date' })),
  ])];
  const r = computeDailyTrend(people, 14, NOW);
  eq(r.suppressed, true, 'garbage must not become a data point');
});

// ---- override stats --------------------------------------------------------

const alert = (over = {}) => ({
  id: 'a' + Math.random(), participantId: 'p1', severity: 'RED',
  reason: 'test', status: 'NEW', createdAt: daysAgo(1), ...over,
});

t('too few decisions withholds the rate rather than reporting one', () => {
  const r = computeOverrideStats([
    alert({ humanDecision: 'resolved' }),
    alert({ humanDecision: 'follow_up_scheduled' }),
    alert(),
  ]);
  eq(r.suppressed, true);
  eq(r.overrideRate, null);
  eq(r.stoodDown, 0, 'a withheld rate must not leak its parts');
});

t('the rate counts stand-downs against decisions, not against alerts raised', () => {
  // Otherwise leaving alerts undecided quietly improves the number.
  const decided = [
    ...Array.from({ length: 6 }, () => alert({ humanDecision: 'follow_up_scheduled' })),
    ...Array.from({ length: 2 }, () => alert({ humanDecision: 'resolved' })),
  ];
  const r = computeOverrideStats(decided);
  eq(r.overrideRate, 25, '2 of 8 decided');
  const withUndecided = computeOverrideStats([...decided, alert(), alert(), alert()]);
  eq(withUndecided.overrideRate, 25, 'undecided alerts must not move the rate');
  eq(withUndecided.raised, 11, 'but they are still reported');
});

t('both kinds of agreement and both kinds of stand-down are recognised', () => {
  const r = computeOverrideStats([
    ...Array.from({ length: 3 }, () => alert({ humanDecision: 'follow_up_scheduled' })),
    ...Array.from({ length: 3 }, () => alert({ humanDecision: 'emergency_dispatched' })),
    ...Array.from({ length: 2 }, () => alert({ humanDecision: 'resolved' })),
    ...Array.from({ length: 2 }, () => alert({ humanDecision: 'continue_monitoring' })),
  ]);
  eq(r.agreed, 6);
  eq(r.stoodDown, 4);
  eq(r.overrideRate, 40);
});

t('an unrecognised decision is counted, not silently folded into either side', () => {
  const r = computeOverrideStats([
    ...Array.from({ length: 5 }, () => alert({ humanDecision: 'follow_up_scheduled' })),
    alert({ humanDecision: 'something_new' }),
  ]);
  eq(r.unclassified, 1);
  eq(r.agreed, 5);
  eq(r.overrideRate, 0, 'computed over the 5 it could classify');
  eq(r.decided, 6, 'and the decided count still includes it');
});

t('an empty queue reports no rate rather than a perfect one', () => {
  const r = computeOverrideStats([]);
  eq(r.suppressed, true);
  eq(r.overrideRate, null);
  eq(r.raised, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

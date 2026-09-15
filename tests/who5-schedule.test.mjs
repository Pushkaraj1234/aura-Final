/**
 * When WHO-5 is offered.
 *
 * The property worth protecting here is restraint. Five questions that appear
 * whenever someone opens the app get answered carelessly, and a carelessly
 * answered instrument is worse than a missing one: it still enters the
 * concurrent-validity study as real data, where it quietly destroys the
 * correlation it was collected to measure. So most of these tests check that
 * the thing stays hidden.
 */
import { who5Due, WHO5_SCHEDULE_DAYS } from '../dist-test/instruments.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const NOW = Date.parse('2026-09-15T12:00:00Z');
const DAY = 86400000;
const daysAgo = (d) => new Date(NOW - d * DAY).toISOString();

const admin = (d) => ({
  id: 'i' + Math.random(), participantId: 'p1', instrumentId: 'who5',
  instrumentVersion: 1, itemResponses: {}, rawScore: 12, scaledScore: 48,
  administeredAt: daysAgo(d),
});

// ---- the schedule itself ---------------------------------------------------

t('the schedule is baseline, day 7 and day 30', () => {
  eq([...WHO5_SCHEDULE_DAYS].join(','), '0,7,30');
});

// ---- baseline --------------------------------------------------------------

t('someone who has never answered is offered the baseline', () => {
  const r = who5Due([], daysAgo(0), NOW);
  eq(r.due, true);
  eq(r.reason, 'never_taken');
  eq(r.nextDay, 0);
  eq(r.administeredCount, 0);
});

t('a long-enrolled person who never answered is still offered it', () => {
  eq(who5Due([], daysAgo(400), NOW).due, true);
});

// ---- the gap between points ------------------------------------------------

t('the day 7 point does not open early', () => {
  eq(who5Due([admin(1)], daysAgo(1), NOW).due, false, 'one day after baseline');
  eq(who5Due([admin(6)], daysAgo(6), NOW).due, false, 'six days after baseline');
});

t('the day 7 point opens on day 7 and stays open', () => {
  eq(who5Due([admin(7)], daysAgo(7), NOW).due, true);
  eq(who5Due([admin(12)], daysAgo(12), NOW).due, true, 'a late answer is still wanted');
});

t('the day 30 point is measured from the baseline, not from the last answer', () => {
  // Baseline 20 days ago, second answer 13 days ago. Day 30 is 10 days out.
  const r = who5Due([admin(20), admin(13)], daysAgo(20), NOW);
  eq(r.due, false);
  eq(r.nextDay, 30);
  eq(r.daysUntilNext, 10);
});

t('the day 30 point opens once thirty days have passed since baseline', () => {
  eq(who5Due([admin(30), admin(23)], daysAgo(30), NOW).due, true);
  eq(who5Due([admin(31), admin(24)], daysAgo(31), NOW).due, true);
});

t('a person who answered late still gets a real gap before the next point', () => {
  // Enrolled 90 days ago but only answered the baseline today. Day 7 is a
  // week from now, not immediately, or the two readings measure nothing.
  const r = who5Due([admin(0)], daysAgo(90), NOW);
  eq(r.due, false);
  eq(r.nextDay, 7);
  eq(r.daysUntilNext, 7);
});

// ---- the end of the schedule ----------------------------------------------

t('once all three are answered it stops asking, permanently', () => {
  const r = who5Due([admin(60), admin(53), admin(30)], daysAgo(60), NOW);
  eq(r.due, false);
  eq(r.reason, 'schedule_complete');
  eq(r.nextDay, null);
  eq(r.administeredCount, 3);
});

t('extra administrations beyond the schedule do not reopen it', () => {
  const r = who5Due([admin(60), admin(53), admin(30), admin(5)], daysAgo(60), NOW);
  eq(r.due, false);
  eq(r.reason, 'schedule_complete');
});

// ---- robustness ------------------------------------------------------------

t('administrations arriving out of order are sorted before being read', () => {
  // Supabase orders by administered_at, but nothing should depend on that.
  const shuffled = [admin(13), admin(20)];
  const r = who5Due(shuffled, daysAgo(20), NOW);
  eq(r.nextDay, 30);
  eq(r.daysUntilNext, 10, 'baseline must be the earliest row, not the first one');
});

t('another instrument in the list is ignored', () => {
  const other = { ...admin(1), instrumentId: 'phq9' };
  const r = who5Due([other], daysAgo(1), NOW);
  eq(r.due, true);
  eq(r.reason, 'never_taken', 'a different instrument is not a WHO-5 baseline');
});

t('an unparseable enrolment date still offers the baseline', () => {
  // Failing closed here would mean the instrument is never offered at all,
  // and a baseline that is never offered cannot be declined either.
  eq(who5Due([], 'not a date', NOW).due, true);
  eq(who5Due([], '', NOW).due, true);
});

t('an unparseable baseline date does not produce a NaN countdown', () => {
  const broken = { ...admin(5), administeredAt: 'not a date' };
  const r = who5Due([broken], daysAgo(5), NOW);
  eq(r.due, false, 'a row we cannot date must not trigger a prompt');
  eq(r.daysUntilNext, null, 'and must not report a NaN number of days');
});

t('the countdown is never NaN in any reachable case', () => {
  const cases = [
    who5Due([], daysAgo(0), NOW),
    who5Due([admin(3)], daysAgo(3), NOW),
    who5Due([admin(20), admin(13)], daysAgo(20), NOW),
    who5Due([admin(60), admin(53), admin(30)], daysAgo(60), NOW),
  ];
  for (const c of cases) {
    ok(c.daysUntilNext === null || Number.isFinite(c.daysUntilNext), 'daysUntilNext must be a number or null');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

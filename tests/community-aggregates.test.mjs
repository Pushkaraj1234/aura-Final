/**
 * Regional aggregates, and the suppression rule that makes them publishable.
 *
 * The page these feed used to render four hardcoded rows under the heading
 * "Privacy-Preserving Aggregations". The arithmetic below is the easy part.
 * What needs pinning is the withholding: a mean distress score published next
 * to a district name for a region of three people is a sentence about those
 * three people, and no amount of calling it an aggregate changes that.
 */
import { computeCommunityAggregates, MIN_GROUP_SIZE }
  from '../dist-test/communityAggregates.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const NOW = Date.parse('2026-09-15T00:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

// A calm check-in scores 0; an all-worst one scores 100.
const calm = (d = 0) => ({
  id: 'c' + Math.random(), participantId: 'p', timestamp: daysAgo(d),
  wellbeing: 5, stress: 1, sleep: 5, safety: 'Yes', connection: 5,
  supportRequested: false, immediateSafetyConcern: false,
});
const dire = (d = 0) => ({ ...calm(d), wellbeing: 1, stress: 5, sleep: 1, safety: 'No', connection: 1 });

const person = (region, checkIns = []) => ({
  id: 'p' + Math.random(), consentGiven: true, createdAt: daysAgo(90),
  preferredSupport: 'x', language: 'English', ageGroup: '25-34',
  checkIns, status: 'active', notes: [], region,
});

const many = (n, region, checkIns = []) =>
  Array.from({ length: n }, () => person(region, checkIns));

t('a region at exactly the threshold is reported', () => {
  const a = computeCommunityAggregates(many(MIN_GROUP_SIZE, 'Central India'), NOW);
  eq(a.regions.length, 1);
  eq(a.regions[0].participants, MIN_GROUP_SIZE);
  eq(a.suppressedRegions, 0);
});

t('a region one person below the threshold is withheld entirely', () => {
  const a = computeCommunityAggregates(many(MIN_GROUP_SIZE - 1, 'Jammu & Kashmir'), NOW);
  eq(a.regions.length, 0, 'nothing may be published for a group that small');
  eq(a.suppressedRegions, 1);
  eq(a.suppressedParticipants, MIN_GROUP_SIZE - 1);
});

t('a withheld region leaks nothing, not even its name', () => {
  const a = computeCommunityAggregates(
    [...many(6, 'Central India'), ...many(2, 'Europe')], NOW);
  const names = JSON.stringify(a.regions);
  ok(!names.includes('Europe'), 'the name of a suppressed region must not appear');
  eq(a.suppressedRegions, 1);
});

t('the page can say how much it withheld', () => {
  const a = computeCommunityAggregates(
    [...many(6, 'A'), ...many(3, 'B'), ...many(2, 'C'), ...many(1, 'D')], NOW);
  eq(a.regions.length, 1);
  eq(a.suppressedRegions, 3, 'B, C and D');
  eq(a.suppressedParticipants, 6);
  eq(a.reportedParticipants, 6);
  eq(a.totalParticipants, 12);
});

t('participants with no region are counted, never invented into one', () => {
  const a = computeCommunityAggregates(
    [...many(6, 'A'), person(undefined), person(''), person('   ')], NOW);
  eq(a.unassigned, 3);
  eq(a.regions.length, 1);
  eq(a.regions[0].participants, 6, 'the unassigned must not be folded into a real region');
});

t('the mean score is the mean of the real check-ins', () => {
  const a = computeCommunityAggregates(
    [...many(4, 'A', [calm()]), ...many(2, 'A', [dire()])], NOW);
  // Four zeroes and two hundreds across six people.
  eq(a.regions[0].checkIns, 6);
  eq(a.regions[0].meanScore, 33.3);
});

t('a region whose members have never checked in reports no mean, not zero', () => {
  const a = computeCommunityAggregates(many(6, 'A'), NOW);
  eq(a.regions[0].meanScore, null, 'zero would read as "everyone is fine"');
  eq(a.regions[0].checkIns, 0);
});

t('elevated counts people, not check-ins, and uses their latest', () => {
  const improving = person('A', [dire(30), dire(20), calm(1)]);
  const worsening = person('A', [calm(30), calm(20), dire(1)]);
  const a = computeCommunityAggregates([improving, worsening, ...many(4, 'A')], NOW);
  eq(a.regions[0].elevated, 1, 'only the person whose most recent check-in is high');
});

t('quiet means nobody has heard from them lately', () => {
  const recent = person('A', [calm(2)]);
  const silent = person('A', [calm(40)]);
  const never = person('A', []);
  const a = computeCommunityAggregates([recent, silent, never, ...many(3, 'A')], NOW);
  eq(a.regions[0].quiet, 1, 'someone who never started is not someone who went quiet');
});

t('regions come back busiest first', () => {
  const a = computeCommunityAggregates(
    [...many(6, 'Small'), ...many(11, 'Large'), ...many(8, 'Middle')], NOW);
  eq(a.regions.map((r) => r.region).join(','), 'Large,Middle,Small');
});

t('no participants means an empty report, not a crash', () => {
  const a = computeCommunityAggregates([], NOW);
  eq(a.regions.length, 0);
  eq(a.totalParticipants, 0);
  eq(a.suppressedRegions, 0);
  eq(a.unassigned, 0);
});

t('every reported region is at or above the threshold, always', () => {
  const messy = [];
  for (let i = 1; i <= 12; i++) messy.push(...many(i, 'R' + i));
  const a = computeCommunityAggregates(messy, NOW);
  for (const r of a.regions) ok(r.participants >= MIN_GROUP_SIZE, `${r.region} had ${r.participants}`);
  eq(a.suppressedRegions, MIN_GROUP_SIZE - 1, 'R1..R4 withheld');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

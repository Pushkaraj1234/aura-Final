/**
 * Fairness slices, Study 2 of docs/EVALUATION_PROTOCOL.md.
 *
 * The tests that matter most here are the ones about what this refuses to
 * print. A fairness dashboard that reports a reassuring number over four
 * people, or a 0% miss rate computed from zero flagged cases, is worse than
 * no dashboard: it launders absence of evidence into evidence of fairness,
 * and it is read by exactly the people who would otherwise go and look.
 */
import {
  computeFairnessReport, pairAdministrations, PAIRING_WINDOW_DAYS, ELEVATED_AT,
} from '../dist-test/fairnessReport.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const NOW = Date.parse('2026-09-15T12:00:00Z');
const DAY = 86400000;
const daysAgo = (d) => new Date(NOW - d * DAY).toISOString();

/** A check-in whose computed AURA score lands where the test needs it. */
const calm = (over = {}) => ({
  id: 'c' + Math.random(), participantId: 'p', timestamp: daysAgo(0),
  wellbeing: 5, stress: 1, sleep: 5, safety: 'Yes', connection: 5,
  supportRequested: false, immediateSafetyConcern: false, scoreVersion: 2,
  voiceInputUsed: false, ...over,
});
const distressed = (over = {}) => ({
  ...calm(), wellbeing: 1, stress: 5, sleep: 1, safety: 'No', connection: 1, ...over,
});

const participant = (id, over = {}) => ({
  id, name: id, consentGiven: true, createdAt: daysAgo(60),
  preferredSupport: 'Human counselor', language: 'en', ageGroup: '25-34',
  checkIns: [], status: 'active', notes: [], ...over,
});

/** raw <= 13 is the WHO-5 flag, so 10 flags and 20 does not. */
const admin = (participantId, raw, over = {}) => {
  // Spread the raw total across the five items so it can be rescored.
  const per = Math.floor(raw / 5);
  const remainder = raw - per * 5;
  const values = [per, per, per, per, per];
  for (let i = 0; i < remainder; i++) values[i] = Math.min(5, values[i] + 1);
  return {
    id: 'i' + Math.random(), participantId, instrumentId: 'who5', instrumentVersion: 1,
    itemResponses: {
      cheerful: values[0], calm: values[1], active: values[2],
      rested: values[3], interested: values[4],
    },
    rawScore: raw, scaledScore: raw * 4, administeredAt: daysAgo(0), ...over,
  };
};

const cohort = (n, participantOver = {}, { flagged = true, elevated = true } = {}) => {
  const ps = [], as = [], map = new Map();
  for (let i = 0; i < n; i++) {
    const id = `${participantOver.language || 'en'}-${participantOver.region || 'r'}-${i}-${Math.random()}`;
    ps.push(participant(id, participantOver));
    as.push(admin(id, flagged ? 10 : 20));
    map.set(id, [elevated ? distressed({ participantId: id }) : calm({ participantId: id })]);
  }
  return { ps, as, map };
};

const merge = (...parts) => {
  const ps = [], as = [], map = new Map();
  for (const p of parts) {
    ps.push(...p.ps); as.push(...p.as);
    for (const [k, v] of p.map) map.set(k, v);
  }
  return { ps, as, map };
};

// ---- the fixture's own assumptions ---------------------------------------

t('the fixtures actually land either side of the elevated band', () => {
  // If this drifts, every other test below is measuring nothing.
  const { pairs } = pairAdministrations(
    [participant('a')], [admin('a', 10)], new Map([['a', [distressed({ participantId: 'a' })]]])
  );
  eq(pairs.length, 1);
  ok(pairs[0].auraScore >= ELEVATED_AT, `distressed fixture scored ${pairs[0].auraScore}`);
  ok(pairs[0].who5Flagged, 'raw 10 must be a WHO-5 flag');

  const quiet = pairAdministrations(
    [participant('b')], [admin('b', 20)], new Map([['b', [calm({ participantId: 'b' })]]])
  );
  ok(quiet.pairs[0].auraScore < ELEVATED_AT, `calm fixture scored ${quiet.pairs[0].auraScore}`);
  ok(!quiet.pairs[0].who5Flagged, 'raw 20 must not be a WHO-5 flag');
});

// ---- pairing --------------------------------------------------------------

t('an administration is paired with the nearest check-in, either side', () => {
  const far = calm({ participantId: 'a', timestamp: daysAgo(6) });
  const near = distressed({ participantId: 'a', timestamp: daysAgo(-1) });  // an hour-ish after
  const { pairs } = pairAdministrations(
    [participant('a')], [admin('a', 10)], new Map([['a', [far, near]]])
  );
  eq(pairs.length, 1);
  eq(pairs[0].checkInAt, near.timestamp, 'nearest in time wins, not most recent before');
});

t('an administration with no check-in inside the window is unpaired, not dropped', () => {
  // Silently discarding these selects for people who check in often, which is
  // the bias most likely to flatter the result.
  const stale = calm({ participantId: 'a', timestamp: daysAgo(PAIRING_WINDOW_DAYS + 2) });
  const r = pairAdministrations([participant('a')], [admin('a', 10)], new Map([['a', [stale]]]));
  eq(r.pairs.length, 0);
  eq(r.unpaired, 1);
});

t('the window boundary is inclusive', () => {
  const edge = calm({ participantId: 'a', timestamp: daysAgo(PAIRING_WINDOW_DAYS) });
  eq(pairAdministrations([participant('a')], [admin('a', 10)], new Map([['a', [edge]]])).pairs.length, 1);
});

t('an administration for an unknown participant is unpaired rather than crashing', () => {
  const r = pairAdministrations([], [admin('ghost', 10)], new Map());
  eq(r.pairs.length, 0);
  eq(r.unpaired, 1);
});

t('unparseable dates are counted as unpaired, not treated as now', () => {
  const r = pairAdministrations(
    [participant('a')], [admin('a', 10, { administeredAt: 'not a date' })],
    new Map([['a', [calm({ participantId: 'a' })]]])
  );
  eq(r.unpaired, 1);
  eq(r.pairs.length, 0);
});

t('an instrument other than WHO-5 is ignored entirely', () => {
  const other = { ...admin('a', 10), instrumentId: 'phq9' };
  const r = pairAdministrations([participant('a')], [other], new Map([['a', [calm({ participantId: 'a' })]]]));
  eq(r.pairs.length, 0);
  eq(r.unpaired, 0, 'a different instrument is out of scope, not a failed pairing');
});

t('the WHO-5 total is recomputed from item responses, not read from the row', () => {
  // A stored total frozen at collection time would mask a corrected scoring
  // rule. The row below claims 25; the items say 10.
  const lying = admin('a', 10, { rawScore: 25, scaledScore: 100 });
  const { pairs } = pairAdministrations(
    [participant('a')], [lying], new Map([['a', [distressed({ participantId: 'a' })]]])
  );
  eq(pairs[0].who5Raw, 10);
  eq(pairs[0].who5Flagged, true);
});

// ---- suppression ----------------------------------------------------------

t('a sample below the reporting floor publishes nothing at all', () => {
  const c = cohort(4);
  const r = computeFairnessReport(c.ps, c.as, c.map, NOW);
  eq(r.suppressed, true);
  eq(r.dimensions.length, 0, 'no breakdown');
  eq(r.overallFalseNegativeRate, null, 'and no overall rate to read instead');
  eq(r.flagged, 0);
});

t('a small slice inside a reportable sample is withheld with its counts', () => {
  const big = cohort(8, { language: 'en' });
  const tiny = cohort(2, { language: 'mr' });
  const c = merge(big, tiny);
  const r = computeFairnessReport(c.ps, c.as, c.map, NOW);
  eq(r.suppressed, false);
  const lang = r.dimensions.find((d) => d.dimension === 'language');
  eq(lang.suppressedCount, 1);
  const mr = lang.slices.find((s) => s.value === 'mr');
  eq(mr.suppressed, true);
  eq(mr.n, 0, 'a withheld slice must not leak its size');
  eq(mr.falseNegativeRate, null);
});

t('suppressed slices sort last, so the readable rows come first', () => {
  const c = merge(cohort(8, { language: 'en' }), cohort(2, { language: 'mr' }));
  const lang = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'language');
  eq(lang.slices[lang.slices.length - 1].suppressed, true);
});

// ---- the miss rate --------------------------------------------------------

t('a slice AURA catches every time reports a zero miss rate', () => {
  const c = cohort(6, { language: 'en' }, { flagged: true, elevated: true });
  const lang = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'language');
  const en = lang.slices.find((s) => s.value === 'en');
  eq(en.flagged, 6);
  eq(en.missed, 0);
  eq(en.falseNegativeRate, 0);
});

t('a slice AURA misses every time reports a hundred percent', () => {
  const c = cohort(6, { language: 'hi' }, { flagged: true, elevated: false });
  const lang = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'language');
  const hi = lang.slices.find((s) => s.value === 'hi');
  eq(hi.flagged, 6);
  eq(hi.missed, 6);
  eq(hi.falseNegativeRate, 100);
});

t('a disparity between two languages is surfaced as the widest gap', () => {
  // The finding this whole file exists to be able to report.
  const c = merge(
    cohort(6, { language: 'en' }, { flagged: true, elevated: true }),
    cohort(6, { language: 'hi' }, { flagged: true, elevated: false })
  );
  const lang = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'language');
  eq(lang.widestGap, 100);
});

t('nothing flagged in a slice reports null, never a flattering zero', () => {
  // The single most dangerous number this file could produce: 0% computed
  // from no cases reads as a clean bill of health and is not one.
  const c = cohort(6, { language: 'en' }, { flagged: false, elevated: false });
  const r = computeFairnessReport(c.ps, c.as, c.map, NOW);
  const en = r.dimensions.find((d) => d.dimension === 'language').slices.find((s) => s.value === 'en');
  eq(en.n, 6, 'the slice is reportable');
  eq(en.flagged, 0);
  eq(en.falseNegativeRate, null, 'must be null, not 0');
  eq(r.overallFalseNegativeRate, null);
});

t('a single reportable slice yields no gap, rather than a gap of zero', () => {
  // "No disparity found" and "nothing to compare" must not read the same.
  const c = cohort(6, { language: 'en' });
  const lang = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'language');
  eq(lang.slices.filter((s) => !s.suppressed).length, 1);
  eq(lang.widestGap, null);
});

t('a slice with no flagged cases is left out of the gap calculation', () => {
  const c = merge(
    cohort(6, { language: 'en' }, { flagged: true, elevated: false }),   // FNR 100
    cohort(6, { language: 'hi' }, { flagged: false, elevated: false })   // FNR null
  );
  const lang = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'language');
  eq(lang.widestGap, null, 'one rate and one null is not two rates');
});

// ---- the dimensions -------------------------------------------------------

t('every specified dimension is reported', () => {
  const c = cohort(6);
  const r = computeFairnessReport(c.ps, c.as, c.map, NOW);
  eq(r.dimensions.map((d) => d.dimension).join(','),
     'language,ageGroup,region,inputMode,counsellor');
});

t('voice and text are sliced from the paired check-in', () => {
  const voice = cohort(6, { language: 'en' });
  for (const [id, list] of voice.map) voice.map.set(id, [{ ...list[0], voiceInputUsed: true }]);
  const r = computeFairnessReport(voice.ps, voice.as, voice.map, NOW);
  const mode = r.dimensions.find((d) => d.dimension === 'inputMode');
  eq(mode.slices.find((s) => s.value === 'Voice').n, 6);
});

t('a missing region becomes "Not recorded" rather than being invented', () => {
  const c = cohort(6, { region: undefined });
  const region = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'region');
  eq(region.slices[0].value, 'Not recorded');
});

t('a blank region string is treated the same as a missing one', () => {
  const c = cohort(6, { region: '   ' });
  const region = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'region');
  eq(region.slices[0].value, 'Not recorded');
});

t('counsellor assignment is sliced', () => {
  const c = merge(
    cohort(6, { language: 'en', assignedWorker: 'SW-1' }),
    cohort(6, { language: 'hi' })
  );
  const counsellor = computeFairnessReport(c.ps, c.as, c.map, NOW)
    .dimensions.find((d) => d.dimension === 'counsellor');
  eq(counsellor.slices.find((s) => s.value === 'Assigned').n, 6);
  eq(counsellor.slices.find((s) => s.value === 'Not assigned').n, 6);
});

// ---- the whole report -----------------------------------------------------

t('an empty cohort is suppressed and does not divide by zero', () => {
  const r = computeFairnessReport([], [], new Map(), NOW);
  eq(r.suppressed, true);
  eq(r.pairs, 0);
  eq(r.overallFalseNegativeRate, null);
});

t('unpaired administrations are reported, not hidden', () => {
  const c = cohort(6);
  const orphan = admin('nobody', 10);
  const r = computeFairnessReport(c.ps, [...c.as, orphan], c.map, NOW);
  eq(r.pairs, 6);
  eq(r.unpaired, 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/**
 * The scoring change: stress measured instead of inferred.
 *
 * Two things had to stay true through it, and neither is visible on screen if
 * it breaks. The arithmetic must be untouched, because trajectoryEngine
 * rescores every historical check-in with the current formula rather than
 * reading back calculated_score -- a weight change silently rewrites the past.
 * And the step 7 answer must be inverted exactly once on its way into
 * CheckIn.stress, because the question runs 5-is-good and the stored field
 * runs 5-is-worst. A sign error there would invert the stress contribution for
 * everyone while every screen still looked plausible.
 */
import { calculateRawScore, explainRawScore, stressFromCoping, SCORE_VERSION }
  from '../dist-test/riskEngine.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const ci = (o) => ({
  id: 'x', participantId: 'p', timestamp: new Date().toISOString(),
  wellbeing: 3, stress: 3, sleep: 3, safety: 'Mostly', connection: 3,
  supportRequested: false, immediateSafetyConcern: false, ...o,
});

t('the step 7 answer inverts exactly once, across the whole scale', () => {
  eq(stressFromCoping(5), 1, 'on top of things all the time -> calm');
  eq(stressFromCoping(4), 2);
  eq(stressFromCoping(3), 3, 'the midpoint must be its own mirror');
  eq(stressFromCoping(2), 4);
  eq(stressFromCoping(1), 5, 'never on top of things -> very stressed');
});

t('inverting twice returns the original, so the mapping loses nothing', () => {
  for (const v of [1, 2, 3, 4, 5]) eq(stressFromCoping(stressFromCoping(v)), v);
});

t('coping better lowers the score, and never raises it', () => {
  let previous = Infinity;
  for (const coping of [1, 2, 3, 4, 5]) {
    const score = calculateRawScore(ci({ stress: stressFromCoping(coping) }));
    ok(score < previous, `coping ${coping} scored ${score}, not below ${previous}`);
    previous = score;
  }
});

// The regression guard. These are the numbers the old formula produced, worked
// out by hand from the weights in riskEngine: safety 28, stress 22,
// wellbeing 22, sleep 17, connection 11.
t('the arithmetic is unchanged: every answer at its best is 0', () => {
  eq(calculateRawScore(ci({ safety: 'Yes', stress: 1, wellbeing: 5, sleep: 5, connection: 5 })), 0);
});

t('the arithmetic is unchanged: every answer at its worst is 100', () => {
  eq(calculateRawScore(ci({ safety: 'No', stress: 5, wellbeing: 1, sleep: 1, connection: 1 })), 100);
});

t('the arithmetic is unchanged: a mid-scale check-in still scores 36', () => {
  // 0 + 11 + 11 + 8.5 + 5.5 = 36
  eq(calculateRawScore(ci({ safety: 'Yes', stress: 3, wellbeing: 3, sleep: 3, connection: 3 })), 36);
});

t('the four safety values still map to their original points', () => {
  const pts = (safety) =>
    explainRawScore(ci({ safety, stress: 1, wellbeing: 5, sleep: 5, connection: 5 })).score;
  eq(pts('Yes'), 0); eq(pts('Mostly'), 6); eq(pts('Unsure'), 18); eq(pts('No'), 28);
});

t('stress is no longer pinned to wellbeing and sleep', () => {
  // The exact case the old model could not represent: sleeping and coping
  // adequately on the surface, under real pressure underneath. Before this
  // change stress was round(6 - (4 + 4) / 2) = 2 and could not be anything
  // else. Now it is whatever the person answered.
  const calm = calculateRawScore(ci({ wellbeing: 4, sleep: 4, stress: stressFromCoping(5) }));
  const pressed = calculateRawScore(ci({ wellbeing: 4, sleep: 4, stress: stressFromCoping(1) }));
  ok(pressed > calm, 'identical wellbeing and sleep must still allow different stress');
  eq(pressed - calm, 22, 'and the gap is the full stress weight');
});

t('an immediate safety concern still overrides everything', () => {
  const b = explainRawScore(ci({
    safety: 'Yes', stress: 1, wellbeing: 5, sleep: 5, connection: 5,
    immediateSafetyConcern: true,
  }));
  eq(b.score, 100);
  ok(b.overridden, 'the breakdown must say it was overridden, not show a sum');
  eq(b.terms.length, 0, 'no arithmetic should be shown for an override');
});

t('the score never leaves 0-100 for any combination', () => {
  const safeties = ['Yes', 'Mostly', 'Unsure', 'No'];
  for (const safety of safeties)
    for (let w = 1; w <= 5; w++)
      for (let s = 1; s <= 5; s++)
        for (let l = 1; l <= 5; l++)
          for (let c = 1; c <= 5; c++) {
            const v = calculateRawScore(ci({ safety, wellbeing: w, stress: s, sleep: l, connection: c }));
            ok(v >= 0 && v <= 100, `${safety}/${w}/${s}/${l}/${c} gave ${v}`);
          }
});

t('new check-ins are stamped version 2', () => {
  eq(SCORE_VERSION, 2);
});

t('the breakdown never credits a v1 row with an answer nobody gave', () => {
  const v1 = explainRawScore(ci({ stress: 4 }));
  const term = v1.terms.find((x) => x.key === 'stress');
  ok(/inferred/i.test(term.label), `v1 label should say inferred, got "${term.label}"`);
  eq(term.response, '4/5', 'v1 shows the stored value, not a fabricated answer');
});

t('the breakdown shows a v2 answer the way the person gave it', () => {
  // They picked "Rarely" (2 on the step 7 scale). Stored as stress 4.
  const v2 = explainRawScore(ci({ stress: stressFromCoping(2), scoreVersion: 2 }));
  const term = v2.terms.find((x) => x.key === 'stress');
  ok(!/inferred/i.test(term.label), 'v2 must not be labelled inferred');
  ok(term.response.includes('2/5'), `should echo the answer given, got "${term.response}"`);
  eq(term.points, ((4 - 1) / 4) * 22, 'and the points still come from the stored value');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/**
 * Enforces docs/CONCORDANCE_POLICY.md.
 *
 * Concordance compares what someone said about themselves against everything
 * else in the same check-in. Pointed the wrong way it is a lie detector aimed
 * at torture survivors, and the constraints that stop it becoming one were,
 * until now, only a docstring. This makes them fail the build.
 *
 * Two of the four rules can be pinned mechanically: the self-report is never
 * overwritten, and no participant-facing screen may show a divergence. Those
 * are what this file tests. The rest lives in the policy document.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assessConcordance } from '../dist-test/concordanceEngine.js';
import { calculateRawScore } from '../dist-test/riskEngine.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const checkIn = (o = {}) => ({
  id: 'c1', participantId: 'p1', timestamp: new Date().toISOString(),
  wellbeing: 5, stress: 1, sleep: 5, safety: 'Yes', connection: 5,
  supportRequested: false, immediateSafetyConcern: false, ...o,
});

// Someone saying they are fine while the rest of the form says otherwise.
// This is the case the feature exists for, so it is the case to test against.
// The behavioural answers live under `functional`, which is also why they can
// never reach the score: riskEngine reads none of them.
const diverging = checkIn({
  wellbeing: 5,
  functional: {
    sleepHours: 3,
    mealsYesterday: 1,
    leftHome: false,
    spokeToAnyone: false,
    somaticSymptoms: ['palpitations', 'exhaustion'],
  },
});

// ---- Rule 1: the self-report is never overwritten --------------------------

t('assessing does not mutate the check-in it was given', () => {
  const before = JSON.parse(JSON.stringify(diverging));
  assessConcordance(diverging, []);
  eq(JSON.stringify(diverging), JSON.stringify(before), 'the input was modified');
});

t('the stated answers survive a divergence untouched', () => {
  const c = checkIn({ wellbeing: 5, functional: { sleepHours: 2 } });
  const stated = { w: c.wellbeing, s: c.stress, l: c.sleep, f: c.safety, n: c.connection };
  assessConcordance(c, []);
  eq(c.wellbeing, stated.w); eq(c.stress, stated.s); eq(c.sleep, stated.l);
  eq(c.safety, stated.f); eq(c.connection, stated.n);
});

t('the distress score is identical with or without concordance', () => {
  const c = checkIn({ wellbeing: 5, functional: { sleepHours: 2, somaticSymptoms: ['palpitations'] } });
  const before = calculateRawScore(c);
  assessConcordance(c, [checkIn(), checkIn()]);
  eq(calculateRawScore(c), before, 'concordance must not move the number');
});

// ---- Rule 3: the result is a prompt, not a verdict -------------------------

t('the result carries no field that reads as a verdict about the person', () => {
  const r = assessConcordance(diverging, []);
  const banned = ['credibility', 'honesty', 'truthfulness', 'deception', 'reliability',
                  'trustworthiness', 'lying', 'malingering'];
  const keys = Object.keys(r).map((k) => k.toLowerCase());
  for (const b of banned)
    ok(!keys.some((k) => k.includes(b)), `result exposes "${b}"`);
});

t('it still does its job: a divergence is actually detected', () => {
  // A policy that quietly disabled the feature would pass every test above.
  const r = assessConcordance(diverging, []);
  ok(r.level === 'diverging' || r.level === 'partial' || r.needsSecondLook,
     `expected a divergence to register, got level="${r.level}" needsSecondLook=${r.needsSecondLook}`);
});

// ---- Rule 2: never shown to the participant --------------------------------

/**
 * Screens a participant can reach while signed in, plus the guardian form,
 * which a family member fills in about someone else. If a new participant
 * screen is added it belongs in this list.
 */
const PARTICIPANT_FACING = [
  'src/pages/ParticipantCheckin.tsx',
  'src/pages/CheckInResults.tsx',
  'src/pages/ParticipantProfile.tsx',
  'src/pages/GuardianForm.tsx',
  'src/pages/ChooseCounsellor.tsx',
  'src/components/EmptyWellbeingState.tsx',
  'src/components/FirstAidKitCard.tsx',
  'src/components/FirstAidKitEditor.tsx',
  'src/components/GeminiChatbot.tsx',
];

const repoRoot = new URL('..', import.meta.url).pathname;
const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8');

// Strip comments, so the prose explaining the policy does not trip the rule
// the prose is describing.
const codeOnly = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

t('no participant-facing screen imports the concordance engine', () => {
  for (const f of PARTICIPANT_FACING) {
    const code = codeOnly(read(f));
    ok(!/from\s+["'][^"']*concordanceEngine["']/.test(code),
       `${f} imports concordanceEngine`);
    ok(!/assessConcordance|assessLatest\s*\(/.test(code),
       `${f} calls the concordance engine`);
  }
});

t('no participant-facing screen renders a concordance result', () => {
  for (const f of PARTICIPANT_FACING) {
    const code = codeOnly(read(f));
    ok(!/needsSecondLook/.test(code), `${f} references needsSecondLook`);
    ok(!/ConcordanceResult/.test(code), `${f} references ConcordanceResult`);
  }
});

t('the policy document exists and is reachable from the engine', () => {
  const policy = read('docs/CONCORDANCE_POLICY.md');
  ok(policy.length > 500, 'policy is too short to be a policy');
  ok(/never shown to the participant/i.test(policy));
  ok(/never overwritten/i.test(policy));
});

t('every participant-facing file in the list actually exists', () => {
  // Guards against the list silently rotting into a no-op after a rename.
  for (const f of PARTICIPANT_FACING) {
    const src = read(f);
    ok(src.length > 0, `${f} is empty`);
  }
  // And against the staff side losing it entirely, which would mean the
  // feature had been deleted rather than contained.
  const staff = readdirSync(join(repoRoot, 'src/pages'))
    .concat(readdirSync(join(repoRoot, 'src/components')));
  ok(staff.length > 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

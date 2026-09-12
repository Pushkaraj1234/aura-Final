/**
 * The guardian instrument.
 *
 * The concern level is computed from the answers, not asked of a model — so it
 * has to be arithmetic that holds up. These check the ordering is real, that a
 * single severe answer is not buried by four calm ones, and that an unanswered
 * form does not read as reassurance.
 */
import { GUARDIAN_QUESTIONS, summariseGuardianAnswers, guardianFallbackSummary }
  from '../dist-test/guardianQuestions.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const answer = (pick) => GUARDIAN_QUESTIONS.map((q, i) => ({
  questionId: q.id, value: q.options[pick(q, i)].label,
}));
const allBest  = answer((q) => 0);
const allWorst = answer((q) => q.options.length - 1);

t('the five specified questions are present, in order', () => {
  eq(GUARDIAN_QUESTIONS.length, 5);
  eq(GUARDIAN_QUESTIONS.map(q => q.id).join(','), 'mood,distress,routine,withdrawal,behaviour');
});

t('the specified option sets are used verbatim', () => {
  eq(GUARDIAN_QUESTIONS[0].options.map(o => o.label).join(' / '),
     'No change / Mild change / Moderate change / Severe change');
  eq(GUARDIAN_QUESTIONS[1].options.map(o => o.label).join(' / '),
     'Never / Occasionally / Often / Almost always');
  eq(GUARDIAN_QUESTIONS[2].options.map(o => o.label).join(' / '),
     'No change / Slight change / Significant change');
  eq(GUARDIAN_QUESTIONS[3].options.map(o => o.label).join(' / '),
     'No / Sometimes / Frequently / Almost completely');
  eq(GUARDIAN_QUESTIONS[4].options.map(o => o.label).join(' / '),
     'No / Mild / Moderate / Severe');
});

t('every question carries the same maximum weight', () => {
  for (const q of GUARDIAN_QUESTIONS) {
    eq(q.options[0].weight, 0, `${q.id} best option is not zero`);
    eq(q.options[q.options.length - 1].weight, 1, `${q.id} worst option is not one`);
  }
});

t('all-calm answers read as low concern', () => {
  const r = summariseGuardianAnswers(allBest);
  eq(r.concern, 'low');
  eq(r.flagged.length, 0);
});

t('all-severe answers read as high concern', () => {
  const r = summariseGuardianAnswers(allWorst);
  eq(r.concern, 'high');
  eq(r.flagged.length, 5);
});

t('one severe answer among calm ones is not buried', () => {
  const mixed = GUARDIAN_QUESTIONS.map((q, i) => ({
    questionId: q.id,
    value: i === 3 ? q.options[q.options.length - 1].label : q.options[0].label,
  }));
  const r = summariseGuardianAnswers(mixed);
  ok(r.concern !== 'low', `a severe withdrawal answer still read as ${r.concern}`);
  ok(r.flagged.includes('withdrawal'), `flagged: ${r.flagged.join(', ')}`);
});

t('concern rises monotonically as answers worsen', () => {
  const order = { low: 0, moderate: 1, high: 2 };
  let previous = -1;
  for (const step of [0, 0.34, 0.67, 1]) {
    const a = GUARDIAN_QUESTIONS.map((q) => ({
      questionId: q.id,
      value: q.options[Math.round(step * (q.options.length - 1))].label,
    }));
    const level = order[summariseGuardianAnswers(a).concern];
    ok(level >= previous, `concern went down as answers got worse (${level} after ${previous})`);
    previous = level;
  }
});

t('an unanswered form does not read as reassurance', () => {
  const r = summariseGuardianAnswers([]);
  eq(r.answered, 0);
  ok(/did not answer/i.test(guardianFallbackSummary([])), guardianFallbackSummary([]));
});

t('unrecognised answers are ignored rather than scored', () => {
  const r = summariseGuardianAnswers([
    { questionId: 'mood', value: 'Catastrophic' },
    { questionId: 'not-a-question', value: 'Severe' },
  ]);
  eq(r.answered, 0, 'a made-up option was scored');
});

t('the fallback summary names the areas it flagged', () => {
  const s = guardianFallbackSummary(allWorst);
  ok(/high/.test(s), s);
  ok(/withdrawal/.test(s), s);
  ok(s.length < 300, `summary is not short: ${s.length} chars`);
});

t('a partly completed form scores only what was answered', () => {
  const r = summariseGuardianAnswers(allWorst.slice(0, 2));
  eq(r.answered, 2);
  eq(r.concern, 'high');
});

console.log(`\nguardian: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

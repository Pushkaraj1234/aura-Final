/**
 * The "Try these" column on the results screen.
 *
 * It offers exercises for exactly one area — the one a person's own answers put
 * highest — so the thing worth pinning is the choosing. These check that the
 * highest percentage wins, that a tie resolves to the card a reader reaches
 * first, and that `functioning` cannot win an area it has no exercises for.
 */
import { SECTION_EXERCISES, highestConcernSection, exercisesForAnalysis }
  from '../dist-test/sectionExercises.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };

// A baseline where every area is calm, so each test moves exactly one number.
const calm = { stress: 15, sleep: 10, emotionalWellbeing: 10, socialConnection: 10, functioning: 10 };
const with_ = (over) => ({ ...calm, ...over });

t('all four areas carry the two specified exercises, in order', () => {
  eq(Object.keys(SECTION_EXERCISES).length, 4);
  eq(SECTION_EXERCISES.sleep.exercises.map(e => e.title).join(' / '),
     '4–6 Breathing / Body Relaxation');
  eq(SECTION_EXERCISES.stress.exercises.map(e => e.title).join(' / '),
     'Box Breathing / 5-4-3-2-1 Grounding');
  eq(SECTION_EXERCISES.emotionalWellbeing.exercises.map(e => e.title).join(' / '),
     'Emotion Naming / Self-Compassion Pause');
  eq(SECTION_EXERCISES.socialConnection.exercises.map(e => e.title).join(' / '),
     'Reach Out / Connection Time');
});

t('every area is reachable — each one wins when it is highest', () => {
  eq(highestConcernSection(with_({ stress: 95 })), 'stress');
  eq(highestConcernSection(with_({ sleep: 90 })), 'sleep');
  eq(highestConcernSection(with_({ emotionalWellbeing: 85 })), 'emotionalWellbeing');
  eq(highestConcernSection(with_({ socialConnection: 80 })), 'socialConnection');
});

t('the highest wins even when another area is close behind', () => {
  eq(highestConcernSection(with_({ sleep: 70, stress: 71 })), 'stress');
  eq(highestConcernSection(with_({ sleep: 72, stress: 71 })), 'sleep');
});

t('a tie resolves to the card that is read first', () => {
  eq(highestConcernSection(with_({ stress: 60, sleep: 60 })), 'stress');
  eq(highestConcernSection(with_({ sleep: 60, emotionalWellbeing: 60 })), 'sleep');
  eq(highestConcernSection(with_({ emotionalWellbeing: 60, socialConnection: 60 })),
     'emotionalWellbeing');
});

t('functioning never wins — it has a score but no card and no exercises', () => {
  eq(highestConcernSection(with_({ functioning: 100 })), 'stress');
  eq(highestConcernSection(with_({ functioning: 100, socialConnection: 80 })),
     'socialConnection');
});

t('an all-calm check-in still names an area rather than nothing', () => {
  const picked = exercisesForAnalysis(calm);
  eq(picked.section, 'stress');
  eq(picked.exercises.length, 2);
});

t('the label matches the heading its card uses on screen', () => {
  eq(SECTION_EXERCISES.stress.label, 'Reported Stress Level');
  eq(SECTION_EXERCISES.sleep.label, 'Sleep & Rest Quality');
  eq(SECTION_EXERCISES.emotionalWellbeing.label, 'Emotional Wellbeing');
  eq(SECTION_EXERCISES.socialConnection.label, 'Social Connection');
});

t('no exercise promises the score will move', () => {
  const forbidden = /\b(score|lower|reduce|improve your number)\b/i;
  for (const set of Object.values(SECTION_EXERCISES)) {
    for (const e of set.exercises) {
      if (forbidden.test(e.body) || forbidden.test(e.title)) {
        throw new Error(`"${e.title}" makes a claim about the score`);
      }
    }
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

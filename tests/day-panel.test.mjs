/**
 * Opening a single day from the trajectory.
 *
 * The graph now answers "what happened on that day?", which means it hands a
 * person a reading about their own past. Two things have to hold for that to
 * be worth showing.
 *
 * The reading must be that day's. Most stored check-ins carry no saved
 * analysis, so the panel recomputes one; a recomputation that quietly used
 * later check-ins would label tomorrow's knowledge with yesterday's date.
 *
 * And the words must not contradict the number printed above them. The
 * narrative used to call any check-in with no flagged factor "low reported
 * distress", including a 42 sitting under a Moderate badge.
 */
import {
  buildExplainabilityNarrative,
  calculateCheckInAnalysis,
  explainFactorPercentages,
} from '../dist-test/recommendationEngine.js';
import { calculateRawScore } from '../dist-test/riskEngine.js';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const ci = (o = {}) => ({
  id: 'c-' + Math.random().toString(36).slice(2, 7),
  participantId: 'P-1', timestamp: '2026-09-13T10:30:00.000Z',
  wellbeing: 3, stress: 3, sleep: 3, safety: 'Mostly', connection: 3,
  supportRequested: false, immediateSafetyConcern: false, scoreVersion: 2, ...o,
});

// ---- the contradiction that prompted the fix -------------------------------

t('middle-of-the-scale answers score 42 and flag nothing', () => {
  const c = ci();
  eq(calculateRawScore(c), 42, 'the fixture is not the case under test');
  const a = calculateCheckInAnalysis(c, null, [c]);
  eq(a.explanationPoints.length, 0, 'expected no factor to cross a threshold');
});

t('a 42 is never described as low distress', () => {
  const a = calculateCheckInAnalysis(ci(), null, []);
  const text = a.explanation.toLowerCase();
  ok(!text.includes('low reported distress'), 'a Moderate score was called low');
  ok(!text.includes('no immediate areas of strain'), 'strain was declared absent on a 42');
});

t('the explanation still explains, rather than going blank', () => {
  const a = calculateCheckInAnalysis(ci(), null, []);
  ok(a.explanation.trim().length > 30, 'explanation is empty or a stub');
  ok(/together|combination/i.test(a.explanation), 'does not say where the number came from');
});

t('a genuinely low score keeps the low-distress wording', () => {
  const calm = ci({ wellbeing: 5, stress: 1, sleep: 5, safety: 'Yes', connection: 5 });
  eq(calculateRawScore(calm), 0);
  const a = calculateCheckInAnalysis(calm, null, []);
  ok(/low reported distress/i.test(a.explanation), 'the low band lost its sentence');
});

t('a flagged factor still names the factor', () => {
  const rough = ci({ stress: 5, sleep: 1, wellbeing: 1, safety: 'No', connection: 1 });
  const a = calculateCheckInAnalysis(rough, null, []);
  ok(a.explanationPoints.length > 0, 'nothing was flagged on a maximal check-in');
  ok(!/no single answer stood out/i.test(a.explanation), 'flagged factors were described as none');
});

t('a big rise is mentioned even when nothing individually flagged', () => {
  // change is computed from the previous check-in, so hand it a calm one.
  const calm = ci({ wellbeing: 5, stress: 1, sleep: 5, safety: 'Yes', connection: 5 });
  const mid = ci();
  const a = calculateCheckInAnalysis(mid, calm, [calm, mid]);
  ok(a.change >= 15, `expected a rise of 15+, got ${a.change}`);
  ok(/rose/i.test(a.explanation), 'a 42-point jump went unmentioned');
});

t('the narrative never claims low distress above the low band', () => {
  // Directly, across the whole range, with no points flagged.
  for (const score of [16, 30, 42, 59, 60, 74, 90]) {
    const text = buildExplainabilityNarrative(score, [], 0, false).toLowerCase();
    ok(!text.includes('low reported distress'), `score ${score} was called low`);
  }
});

t('an immediate safety concern still short-circuits the narrative', () => {
  const text = buildExplainabilityNarrative(100, [], 0, true);
  ok(/immediate safety/i.test(text), 'the safety bypass lost its wording');
});

// ---- that day's reading is that day's --------------------------------------

t('the analysis depends only on the day and the one before it', () => {
  const day1 = ci({ timestamp: '2026-09-11T10:00:00.000Z', stress: 1 });
  const day2 = ci({ timestamp: '2026-09-12T10:00:00.000Z', stress: 3 });
  const day3 = ci({ timestamp: '2026-09-13T10:00:00.000Z', stress: 5 });

  // Computed with history truncated at day 2, as the panel does.
  const truncated = calculateCheckInAnalysis(day2, day1, [day1, day2]);
  // Computed with a later day visible. Must make no difference.
  const withFuture = calculateCheckInAnalysis(day2, day1, [day1, day2, day3]);

  eq(truncated.distressScore, withFuture.distressScore);
  eq(truncated.change, withFuture.change);
  eq(truncated.explanation, withFuture.explanation);
});

t('change compares against the previous check-in, not the newest', () => {
  const calm = ci({ stress: 1, timestamp: '2026-09-11T10:00:00.000Z' });
  const mid = ci({ stress: 3, timestamp: '2026-09-12T10:00:00.000Z' });
  const a = calculateCheckInAnalysis(mid, calm, [calm, mid]);
  eq(a.change, calculateRawScore(mid) - calculateRawScore(calm));
});

t('the first check-in has no change to report', () => {
  const a = calculateCheckInAnalysis(ci(), null, []);
  eq(a.change, undefined, 'a change was invented with nothing to compare against');
});

t('the factor formulas shown are the ones for that check-in', () => {
  const c = ci({ stress: 4, sleep: 2 });
  const f = explainFactorPercentages(c);
  ok(f.stress.includes('4'), 'the stress formula does not carry that day\'s answer');
  ok(f.sleep.includes('2'), 'the sleep formula does not carry that day\'s answer');
});

// ---- what the panel promises on screen -------------------------------------

const panel = readFileSync(new URL('../src/components/CheckInDayPanel.tsx', import.meta.url), 'utf8');

t('the panel says which reading it is showing', () => {
  ok(/saved with this check-in/.test(panel), 'no wording for a stored analysis');
  ok(/worked out again just now/.test(panel), 'no wording for a recomputed one');
});

t('the panel reuses the real arithmetic rather than restating it', () => {
  ok(/ScoreFormulaCard/.test(panel), 'the breakdown is not the shared component');
  ok(/calculateCheckInAnalysis/.test(panel), 'the analysis is not the shared engine');
});

t('the panel never calls the reading a diagnosis', () => {
  ok(/not a diagnosis/.test(panel), 'the non-diagnostic line is missing');
  for (const banned of ['you have ', 'diagnosed', 'disorder', 'PTSD', 'depression']) {
    ok(!new RegExp(banned, 'i').test(panel.replace(/not a diagnosis/gi, '')),
      `panel copy contains a clinical claim: ${banned}`);
  }
});

t('the panel shows the person their own words unaltered', () => {
  ok(/data-no-translate/.test(panel), 'a reflection could be machine-translated in place');
});

t('the panel is a real dialog, closable and focus-managed', () => {
  ok(/role="dialog"/.test(panel), 'not exposed as a dialog');
  ok(/aria-modal="true"/.test(panel), 'not modal to assistive tech');
  ok(/aria-labelledby/.test(panel), 'the dialog has no accessible name');
  ok(/Escape/.test(panel), 'escape does not close it');
});

// ---- the graph is not the only way in --------------------------------------

const profile = readFileSync(new URL('../src/pages/ParticipantProfile.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/pages/ParticipantDetail.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../src/hooks/useChartDayOpener.ts', import.meta.url), 'utf8');

t('every day is reachable without a mouse, on both charts', () => {
  for (const [name, src] of [['participant', profile], ['counsellor', detail]]) {
    ok(/focus:not-sr-only/.test(src), `${name}: keyboard list never becomes visible on focus`);
    ok(/setOpenDay\(d\.i\)/.test(src), `${name}: keyboard buttons do not open the panel`);
  }
});

t('the counsellor chart measures only the distress dots', () => {
  // ParticipantDetail draws a second area for the counsellor's own marks, and
  // its dots carry recharts-area-dot too. Measuring against both interleaves
  // two series and opens the wrong check-in.
  ok(/SCORE_DOT_CLASS/.test(detail), 'the distress series is not marked on the counsellor chart');
  const counsellorMark = detail.slice(detail.indexOf('dataKey="counsellorMark"'));
  const markDot = counsellorMark.slice(0, counsellorMark.indexOf('/>'));
  ok(!/SCORE_DOT_CLASS/.test(markDot), 'the counsellor-mark dots were marked as distress dots');
  ok(/SCORE_DOT_CLASS/.test(hook), 'the hook does not scope its query');
});

t('both charts share one implementation', () => {
  ok(/useChartDayOpener/.test(profile), 'participant chart does not use the shared hook');
  ok(/useChartDayOpener/.test(detail), 'counsellor chart does not use the shared hook');
  ok(!/const nearestPointTo/.test(profile), 'the workaround was copied into a page');
  ok(!/const nearestPointTo/.test(detail), 'the workaround was copied into a page');
});

t('the chart click survives recharts 3 string indices', () => {
  // activeTooltipIndex is `number | string | null` in recharts 3. A
  // typeof === "number" guard silently dropped every click.
  const start = hook.indexOf('const openDayFromChart');
  const handler = hook.slice(start, start + 1400);
  // The coordinate may legitimately be typeof-checked; the recharts index
  // may not, because it arrives as a string.
  ok(!/typeof\s+(raw|i)\s*===\s*"number"/.test(handler), 'the numeric guard on the index is back');
  ok(/Number\(/.test(handler), 'the index is not coerced');
  ok(/Number\.isInteger/.test(handler), 'a non-integer index could pass');
});

t('touch has its own path, because recharts gives it no index', () => {
  // Measured, not assumed: on tap recharts calls the handler with
  // activeTooltipIndex null while its own tooltip is showing the point. The
  // feature was mouse-only until the index was recovered from the dots.
  ok(/onTouchEnd=\{openDayFromChart\}/.test(profile), 'touch is not wired on the participant chart');
  ok(/onTouchEnd=\{openDayFromChart\}/.test(detail), 'touch is not wired on the counsellor chart');
  ok(/nearestPointTo/.test(hook), 'no fallback when the index is missing');
  ok(/changedTouches/.test(hook), 'the touch coordinate is never read');
  ok(/recharts-area-dot/.test(hook), 'the fallback has nothing to measure against');
});

t('a tap is resolved by where the finger landed, not by the reported index', () => {
  // Measured on both charts: for a tap recharts reports either null (the
  // participant chart) or a stale index — the same "5" wherever the finger
  // lands (the counsellor chart). Trusting it opened the wrong check-in six
  // times out of seven.
  const start = hook.indexOf('const openDayFromChart');
  const body = hook.slice(start, start + 900);
  const touchIdx = body.indexOf('changedTouches');
  const indexIdx = body.indexOf('activeTooltipIndex');
  ok(touchIdx > 0 && indexIdx > 0, 'both paths must exist');
  ok(touchIdx < indexIdx, 'the reported index is consulted before the touch position');
  ok(/if \(typeof touchX === "number"\)/.test(body), 'touch is not handled on its own');
  const touchBranch = body.slice(touchIdx, indexIdx);
  ok(/return;/.test(touchBranch), 'a tap can fall through to the reported index');
});

t('the fallback picks a point that exists', () => {
  const fn = hook.slice(hook.indexOf('const nearestPointTo'), hook.indexOf('const openDayFromChart'));
  ok(/best < count/.test(fn), 'could return an index past the data');
  ok(/best >= 0/.test(fn), 'could return -1 when no dot is found');
});

t('both graphs tell the reader the points can be opened', () => {
  ok(/Tap any point on the line/.test(profile), 'participant chart has no affordance');
  ok(/Click any point/.test(detail), 'counsellor chart has no affordance');
});

// ---- the counsellor sees a different screen, and less of it ---------------

t('the panel speaks to whoever opened it', () => {
  ok(/voice\?: "self" \| "counsellor"/.test(panel), 'the panel has one voice only');
  ok(/What they reported that day/.test(panel), 'no counsellor wording');
  ok(/What you reported that day/.test(panel), 'the self wording was lost');
  ok(/voice="counsellor"/.test(detail), 'the counsellor page opens the participant-voiced panel');
  ok(!/voice="counsellor"/.test(profile), 'the participant page was given counsellor wording');
});

t('a withheld reflection never reaches a counsellor', () => {
  ok(/shareNoteWithWorker === false/.test(panel), 'the note-sharing flag is not checked');
  ok(/shareWithWorker === false/.test(panel), 'the reflection flag is not checked');
  ok(/voice === "counsellor" &&/.test(panel), 'withholding is not scoped to the counsellor view');
  ok(/showReflection/.test(panel), 'the gate is computed but never applied');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

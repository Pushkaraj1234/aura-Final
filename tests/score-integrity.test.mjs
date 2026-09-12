/**
 * The distress score drives every recommendation on the results page, so the
 * one thing it must never do is include points nobody can account for.
 */
import { calculateCheckInAnalysis as analyzeCheckIn, aiAdjustmentCapFor, AI_SCORE_ADJUSTMENT_LIMIT,
         dedupeRecommendations } from '../dist-test/recEngine.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const checkIn = (over = {}) => ({
  id: 'c1', participantId: 'p1', timestamp: new Date().toISOString(),
  wellbeing: 3, stress: 3, sleep: 3, safety: 'Mostly', connection: 5,
  supportRequested: false, immediateSafetyConcern: false, ...over,
});
// A model that wants the score far higher than the answers justify.
const ai = { distressScore: 95, level: 'HIGH', levelLabel: 'High', trend: 'STABLE',
  primaryAction: 'x', supportiveMessage: 'y', factors: [], recommendations: [] };

t('no reflection at all means no AI points', () => {
  const a = analyzeCheckIn(checkIn({ aiComprehensiveAnalysis: ai }), null, []);
  eq(a.aiAdjustment, 0, 'score moved with nothing written');
  eq(a.aiConsulted, false, 'claimed an AI review that had nothing to read');
});

t('a few characters cannot license an adjustment', () => {
  const a = analyzeCheckIn(checkIn({ aiComprehensiveAnalysis: ai,
    reflection: { transcript: 'ok fine' } }), null, []);
  eq(a.aiAdjustment, 0, 'seven characters moved the score');
});

t('a short note moves the score a little, not a lot', () => {
  const text = 'x'.repeat(83);           // the length that previously bought +15
  const a = analyzeCheckIn(checkIn({ aiComprehensiveAnalysis: ai,
    reflection: { transcript: text } }), null, []);
  ok(a.aiAdjustment > 0, 'a real reflection was ignored entirely');
  ok(a.aiAdjustment <= 3, `83 characters still moved the score by ${a.aiAdjustment}`);
});

t('a long reflection can reach the full limit', () => {
  const a = analyzeCheckIn(checkIn({ aiComprehensiveAnalysis: ai,
    reflection: { transcript: 'x'.repeat(600) } }), null, []);
  eq(a.aiAdjustment, AI_SCORE_ADJUSTMENT_LIMIT, 'full evidence did not earn the full cap');
});

t('the cap is never exceeded, whatever the model asks for', () => {
  for (const chars of [0, 39, 40, 120, 400, 5000]) {
    const cap = aiAdjustmentCapFor(chars);
    const a = analyzeCheckIn(checkIn({ aiComprehensiveAnalysis: ai,
      reflection: { transcript: 'x'.repeat(chars) } }), null, []);
    ok(Math.abs(a.aiAdjustment) <= cap, `${chars} chars: moved ${a.aiAdjustment}, cap ${cap}`);
    ok(cap <= AI_SCORE_ADJUSTMENT_LIMIT, 'cap exceeded the hard limit');
  }
});

t('the breakdown can state what was read', () => {
  const a = analyzeCheckIn(checkIn({ aiComprehensiveAnalysis: ai,
    reflection: { transcript: 'x'.repeat(200) } }), null, []);
  eq(a.aiEvidenceChars, 200);
  eq(a.aiAdjustmentCap, aiAdjustmentCapFor(200));
});

t('the final score is still the questionnaire plus the stated adjustment', () => {
  const a = analyzeCheckIn(checkIn({ aiComprehensiveAnalysis: ai,
    reflection: { transcript: 'x'.repeat(200) } }), null, []);
  eq(a.distressScore, a.ruleScore + a.aiAdjustment, 'headline does not reconcile');
});

t('suggestions opening the same panel are collapsed', () => {
  // Both route to the caseworker guide, so both would open an identical panel.
  const recs = [
    { category: 'IMMEDIATE_SUPPORT', title: 'Connect with Caseworker',
      description: 'Reach your caseworker about this.', priority: 'HIGH' },
    { category: 'PROFESSIONAL_SUPPORT', title: 'Speak to your caseworker',
      description: 'Contact your caseworker to discuss next steps.', priority: 'MEDIUM' },
  ];
  const kept = dedupeRecommendations(recs);
  eq(kept.length, 1, 'both duplicates survived');
  eq(kept[0].priority, 'HIGH', 'kept the lower-priority duplicate');
});

t('a repeated heading is collapsed even across categories', () => {
  const recs = [
    { category: 'SLEEP', title: 'Sleep support', description: 'a', priority: 'HIGH' },
    { category: 'ROUTINE', title: 'Sleep Support', description: 'b', priority: 'LOW' },
  ];
  eq(dedupeRecommendations(recs).length, 1, 'the same heading appeared twice');
});

t('genuinely different suggestions are all kept', () => {
  const recs = [
    { category: 'SLEEP', title: 'Sleep support', description: 'a', priority: 'MEDIUM' },
    { category: 'SOCIAL', title: 'Connection may help', description: 'b', priority: 'LOW' },
  ];
  eq(dedupeRecommendations(recs).length, 2, 'distinct suggestions were dropped');
});

t('answer-derived suggestions survive alongside the model’s', () => {
  const a = analyzeCheckIn(checkIn({
    sleep: 1, connection: 1, stress: 5,
    reflection: { transcript: 'x'.repeat(200) },
    aiComprehensiveAnalysis: { ...ai, recommendations: [
      { category: 'EMOTIONAL_SUPPORT', title: 'Ensure a Validating Space',
        description: 'b', priority: 'HIGH' }] },
  }), null, []);
  const titles = a.recommendations.map(r => r.title.toLowerCase()).join(' | ');
  ok(a.recommendations.length > 1, `only ${a.recommendations.length} suggestion survived`);
  ok(/sleep|connection|stress/.test(titles), `nothing tied to the answers: ${titles}`);
});

console.log(`\nscore-integrity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

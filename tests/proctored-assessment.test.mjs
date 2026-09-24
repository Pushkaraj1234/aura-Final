/**
 * The proctored trauma assessment, integrated from the standalone app.
 *
 * What has to stay true for it to be the PCL-5 and to be safe inside AURA:
 * the published item-to-cluster layout and scoring, scores that are always
 * recomputed from the raw answers before they are stored, a partial session
 * that is never passed off as a complete one, a table nobody can edit after
 * the fact, and crisis copy that points to Indian helplines rather than the
 * US numbers the standalone app shipped with.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAssessmentRow, recordFromRow, sanitizePcl5Responses,
} from '../dist-test/proctoredPersistence.js';
import {
  PCL5_QUESTIONS, CRISIS_SUPPORT_RESOURCES, DEFAULT_SESSION_CONFIG,
} from '../dist-test/proctoredQuestions.js';
import { calculatePcl5Summary, evaluateSessionIntegrity } from '../dist-test/proctoredScoring.js';
import { templateAssessmentReport } from '../dist-test/proctoredAiService.js';

const root = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const allItems = (v) => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, v]));
const baseInput = (overrides = {}) => ({
  participantId: 'P-TEST',
  administeredAt: '2026-09-25T10:00:00.000Z',
  assessmentVersion: DEFAULT_SESSION_CONFIG.version,
  cutPoint: 33,
  pcl5Responses: allItems(2),
  functionalResponses: { work: 1, sleep: 3 },
  pcPtsdResponses: { 1: true, 2: false },
  indexTraumaLabel: 'Test event',
  events: [],
  sensorStats: null,
  userReport: 'report',
  sessionReport: 'session',
  researchConsent: false,
  ...overrides,
});

// ---- the instrument ---------------------------------------------------------

t('PCL-5 has 20 items numbered 1-20', () => {
  eq(PCL5_QUESTIONS.length, 20);
  eq(PCL5_QUESTIONS.map((q) => q.id).join(','), Array.from({ length: 20 }, (_, i) => i + 1).join(','));
});

t('items sit in the published DSM-5 clusters (B 1-5, C 6-7, D 8-14, E 15-20)', () => {
  const clusterOf = (id) => PCL5_QUESTIONS.find((q) => q.id === id).cluster;
  for (let i = 1; i <= 5; i++) eq(clusterOf(i), 'B', `item ${i}`);
  for (let i = 6; i <= 7; i++) eq(clusterOf(i), 'C', `item ${i}`);
  for (let i = 8; i <= 14; i++) eq(clusterOf(i), 'D', `item ${i}`);
  for (let i = 15; i <= 20; i++) eq(clusterOf(i), 'E', `item ${i}`);
});

t('the screening threshold defaults to the validated 33', () => {
  eq(DEFAULT_SESSION_CONFIG.clinicalCutPoint, 33);
});

// ---- scoring ------------------------------------------------------------------

t('all items at 4 score 80 with every cluster at its maximum', () => {
  const s = calculatePcl5Summary(allItems(4), {}, [], 33);
  eq(s.totalScore, 80);
  eq(s.clusters.B.score, 20);
  eq(s.clusters.C.score, 8);
  eq(s.clusters.D.score, 28);
  eq(s.clusters.E.score, 24);
  eq(s.itemsAnswered, 20);
});

t('a total equal to the threshold is at or above it; one below is not', () => {
  const at = { ...allItems(2), 1: 0, 2: 0, 3: 1, 4: 0 }; // 16*2 + 1 = 33
  eq(calculatePcl5Summary(at, {}, [], 33).totalScore, 33);
  eq(calculatePcl5Summary(at, {}, [], 33).isClinicallySignificant, true);
  const below = { ...at, 3: 0 };
  eq(calculatePcl5Summary(below, {}, [], 33).totalScore, 32);
  eq(calculatePcl5Summary(below, {}, [], 33).isClinicallySignificant, false);
});

t('a session ended early reports how many items were answered', () => {
  const partial = { 1: 4, 2: 4, 3: 4 };
  const s = calculatePcl5Summary(partial, {}, [], 33);
  eq(s.itemsAnswered, 3);
  eq(s.totalScore, 12);
});

t('session checks never change the score', () => {
  const red = [{ severity: 'RED' }, { severity: 'ORANGE' }];
  eq(calculatePcl5Summary(allItems(3), {}, red, 33).totalScore, calculatePcl5Summary(allItems(3), {}, [], 33).totalScore);
  eq(evaluateSessionIntegrity(red), 'UNABLE_TO_VERIFY');
  eq(evaluateSessionIntegrity([{ severity: 'ORANGE' }, { severity: 'ORANGE' }]), 'SIGNIFICANT_SESSION_EVENTS');
  eq(evaluateSessionIntegrity([{ severity: 'YELLOW' }]), 'MINOR_SESSION_EVENTS');
  eq(evaluateSessionIntegrity([{ severity: 'GREEN' }]), 'VERIFIED');
});

// ---- what gets stored ---------------------------------------------------------

t('the stored total is recomputed from the raw answers', () => {
  const row = buildAssessmentRow(baseInput(), 'pa-1');
  eq(row.total_score, 40);
  eq(row.items_answered, 20);
  eq(row.above_threshold, true);
  eq(row.cluster_scores.intrusion + row.cluster_scores.avoidance
     + row.cluster_scores.negativeCognitions + row.cluster_scores.arousal, 40);
  eq(row.functional_average, 2);
});

t('out-of-range or malformed answers are dropped, not coerced', () => {
  const clean = sanitizePcl5Responses({ 1: 5, 2: -1, 3: 2.5, 4: '3', 5: 4, 21: 4 });
  eq(JSON.stringify(clean), JSON.stringify({ 5: 4 }));
  const row = buildAssessmentRow(baseInput({ pcl5Responses: { 1: 9, 2: 4 } }), 'pa-2');
  eq(row.total_score, 4);
  eq(row.items_answered, 1);
});

t('a partial session is stored as partial', () => {
  const row = buildAssessmentRow(baseInput({ pcl5Responses: { 1: 4, 2: 4 } }), 'pa-3');
  eq(row.items_answered, 2);
  eq(row.total_score, 8);
  eq(row.above_threshold, false);
});

t('a stored row reads back as the same result', () => {
  const row = buildAssessmentRow(baseInput(), 'pa-4');
  // jsonb returns object keys as strings
  const fromDb = JSON.parse(JSON.stringify(row));
  const rec = recordFromRow(fromDb);
  eq(rec.id, 'pa-4');
  eq(rec.totalScore, 40);
  eq(rec.isClinicallySignificant, true);
  eq(rec.responses[7], 2);
  eq(rec.itemsAnswered, 20);
  eq(rec.cutPoint, 33);
  eq(rec.participantId, 'P-TEST');
  eq(rec.functionalProfile.sleep, 3);
});

t('research use is off unless the person opted in', () => {
  eq(buildAssessmentRow(baseInput({ researchConsent: undefined }), 'pa-5').research_consent, false);
  eq(buildAssessmentRow(baseInput({ researchConsent: true }), 'pa-6').research_consent, true);
});

// ---- the table ----------------------------------------------------------------

const migration = readFileSync(join(root, 'supabase/migrations/20260925090000_proctored_assessments.sql'), 'utf8');

t('the table has row-level security with select and insert only', () => {
  ok(/enable row level security/i.test(migration), 'RLS not enabled');
  ok(/for select/i.test(migration), 'no select policy');
  ok(/for insert/i.test(migration), 'no insert policy');
  ok(!/for update/i.test(migration), 'an update policy exists');
  ok(!/for delete/i.test(migration), 'a delete policy exists');
  ok(!/for all/i.test(migration), 'a catch-all policy exists');
});

t('only the participant can insert their own assessment', () => {
  const insert = migration.slice(migration.search(/for insert/i));
  ok(/participant_id = public\.user_participant_id\(\)/.test(insert), 'insert not scoped to the participant');
  ok(!/is_staff/.test(insert), 'staff can insert on someone\'s behalf');
});

// ---- crisis copy --------------------------------------------------------------

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

t('no US crisis numbers remain in the assessment', () => {
  for (const file of walk(join(root, 'src/features/proctoredAssessment'))) {
    const text = readFileSync(file, 'utf8');
    for (const banned of ['988', '741741', 'RAINN']) {
      ok(!text.includes(banned), `${file} still mentions ${banned}`);
    }
  }
});

t('the pause screen lists Indian helplines', () => {
  const contacts = CRISIS_SUPPORT_RESOURCES.map((r) => r.contact).join(' ');
  ok(contacts.includes('14416'), 'Tele MANAS missing');
  ok(contacts.includes('112'), 'emergency number missing');
});

t('the fallback report is not a diagnosis and points to Indian helplines', () => {
  const report = templateAssessmentReport({
    totalScore: 40, cutPoint: 33, isClinicallySignificant: true, itemsAnswered: 20,
    clusters: {
      B: { score: 10, symptomSeverity: 'Moderate' }, C: { score: 4, symptomSeverity: 'Moderate' },
      D: { score: 14, symptomSeverity: 'Moderate' }, E: { score: 12, symptomSeverity: 'Moderate' },
    },
    functionalImpactAvg: 2, indexTrauma: '', sessionIntegrityRating: 'VERIFIED', eventsCount: 0, sensorStats: null,
  });
  ok(report.userReport.includes('not a diagnosis'), 'missing "not a diagnosis"');
  ok(report.userReport.includes('14416'), 'missing Tele MANAS');
  ok(!report.userReport.includes('988'), 'still mentions 988');
  ok(!/\bPTSD\b/.test(report.userReport), 'names a diagnostic label');
  ok(report.sessionReport.includes('not used to judge your answers'), 'session report missing the reassurance');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

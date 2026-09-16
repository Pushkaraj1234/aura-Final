/**
 * The Recovery Hub's decision logic.
 *
 * This engine decides the single sentence a distressed person reads when they
 * open the page. Getting it wrong sends somebody to the wrong office, or leaves
 * them staring at a screen that tells them nothing, which is the exact failure
 * the feature exists to prevent. So the rules are pinned here rather than
 * trusted to hold.
 */
import {
  buildChecklist,
  nextStep,
  pendingReminders,
  recoveryProgress,
} from '../dist-test/recoveryHub.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const NOW = new Date('2026-09-16T12:00:00Z');
const iso = (d) => new Date(d).toISOString();

const mkCase = (over = {}) => ({
  id: 'VR-2026-00042', ownerId: 'u1', language: 'en', status: 'IN_PROGRESS',
  financialImpacts: [], openedAt: iso(NOW), createdAt: iso(NOW), updatedAt: iso(NOW),
  ...over,
});
const mkBundle = (over = {}) => ({
  case: mkCase(over.case), incident: null, fir: null, timeline: [],
  documents: [], legalAid: [], compensation: [], ...over,
});

// ---- next step: it always answers -----------------------------------------

t('with no case at all, the step is to open one', () => {
  eq(nextStep({ bundle: null }).id, 'create_case');
});

t('the next step is never empty, whatever the state', () => {
  // A blank space where the next step goes is the failure this engine exists
  // to prevent, so every reachable state must produce a sentence.
  const states = [
    null,
    mkBundle(),
    mkBundle({ incident: { category: 'other', impacts: [] } }),
    mkBundle({
      incident: { category: 'other', account: 'x', impacts: [] },
      fir: { hasFir: false },
      documents: [{ docType: 'identity' }],
      legalAid: [{ id: 'a', applicationNumber: '1', status: 'SUBMITTED' }],
      compensation: [{ id: 'c', applicationNumber: '2', status: 'COMPLETED' }],
      case: { financialImpacts: ['medical_expenses'] },
    }),
  ];
  for (const bundle of states) {
    const s = nextStep({ bundle });
    ok(s && s.title && s.title.length > 0, 'a step with no title');
    ok(s.actionLabel && s.destination, 'a step with no action');
  }
});

t('order of operations: incident before FIR before documents', () => {
  const noIncident = mkBundle();
  eq(nextStep({ bundle: noIncident }).id, 'incident_category');

  const noAccount = mkBundle({ incident: { category: 'physical_violence', impacts: [] } });
  eq(nextStep({ bundle: noAccount }).id, 'incident_account');

  const noFirAnswer = mkBundle({
    incident: { category: 'physical_violence', account: 'what happened', impacts: [] },
  });
  eq(nextStep({ bundle: noFirAnswer }).id, 'fir_question');
});

t('an FIR answered yes but with no number asks for the number', () => {
  const b = mkBundle({
    incident: { category: 'physical_violence', account: 'x', impacts: [] },
    fir: { hasFir: true },
  });
  eq(nextStep({ bundle: b }).id, 'fir_details');
});

t('an FIR answered no routes to the process, never to a filing button', () => {
  const b = mkBundle({
    incident: { category: 'physical_violence', account: 'x', impacts: [] },
    fir: { hasFir: false },
  });
  const s = nextStep({ bundle: b });
  eq(s.id, 'fir_process');
  // The distinction the whole screen rests on.
  ok(/cannot register/i.test(s.detail || ''), 'must say AURA cannot register an FIR');
});

t('hasFir null is "not asked yet", not "no"', () => {
  // These drive different next steps and collapsing them would skip the
  // question entirely for anyone who has not answered it.
  const unasked = mkBundle({
    incident: { category: 'other', account: 'x', impacts: [] },
    fir: { hasFir: null },
  });
  eq(nextStep({ bundle: unasked }).id, 'fir_question');
});

t('a missing commonly-asked-for document is named specifically', () => {
  const b = mkBundle({
    incident: { category: 'physical_violence', account: 'x', impacts: [] },
    fir: { hasFir: true, firNumber: '123/2026' },
  });
  const checklist = buildChecklist({
    category: 'physical_violence', impacts: [], financialImpacts: [],
    hasFir: true, heldDocTypes: [],
  });
  const s = nextStep({ bundle: b, checklist });
  ok(s.id.startsWith('document_'), `expected a document step, got ${s.id}`);
});

t('a complete file says so rather than going blank', () => {
  const b = mkBundle({
    case: { financialImpacts: ['medical_expenses'] },
    incident: { category: 'other', account: 'x', impacts: [] },
    fir: { hasFir: true, firNumber: '1/2026' },
    documents: [{ docType: 'identity' }],
    legalAid: [{ id: 'a', applicationNumber: 'LA1', status: 'COMPLETED' }],
    compensation: [{ id: 'c', applicationNumber: 'C1', status: 'COMPLETED' }],
  });
  const checklist = buildChecklist({
    category: 'other', impacts: [], financialImpacts: ['medical_expenses'],
    // Every commonly-asked-for item this situation generates: declaring a
    // medical expense adds the medical report, so holding it is part of what
    // "complete" means here.
    hasFir: true,
    heldDocTypes: ['identity', 'fir', 'bank_details', 'medical_report'],
  });
  eq(checklist.completed, checklist.total, 'the fixture must actually be complete');
  eq(nextStep({ bundle: b, checklist }).id, 'all_current');
});

// ---- checklist -------------------------------------------------------------

t('the checklist is built for the situation, not a generic list', () => {
  const caste = buildChecklist({
    category: 'caste_based_atrocity', impacts: [], financialImpacts: [],
    hasFir: true, heldDocTypes: [],
  });
  ok(caste.items.some((i) => i.docType === 'caste_certificate'),
     'a caste-based atrocity should surface the caste certificate');

  const other = buildChecklist({
    category: 'property_destruction', impacts: [], financialImpacts: [],
    hasFir: true, heldDocTypes: [],
  });
  ok(!other.items.some((i) => i.docType === 'caste_certificate'),
     'it should not be shown to everyone');
});

t('a death in the family surfaces the death certificate, and only then', () => {
  const withDeath = buildChecklist({
    impacts: ['death_of_family_member'], financialImpacts: [],
    hasFir: true, heldDocTypes: [],
  });
  ok(withDeath.items.some((i) => i.docType === 'death_certificate'));

  const without = buildChecklist({
    impacts: ['emotional_impact'], financialImpacts: [], hasFir: true, heldDocTypes: [],
  });
  ok(!without.items.some((i) => i.docType === 'death_certificate'));
});

t('no document is ever described as required', () => {
  // Requirements vary by scheme, state and case. Telling someone a document is
  // required sends them chasing a certificate they may not need.
  const c = buildChecklist({
    category: 'caste_based_atrocity',
    impacts: ['physical_injury', 'disability', 'death_of_family_member', 'property_damage'],
    financialImpacts: ['medical_expenses', 'disability', 'death_of_family_member'],
    hasFir: true, heldDocTypes: [],
  });
  for (const item of c.items) {
    ok(item.weight === 'commonly_asked_for' || item.weight === 'may_help',
       `unexpected weight ${item.weight}`);
    ok(!/\brequired\b|\bmust\b|\bmandatory\b/i.test(item.why),
       `"${item.why}" states a requirement`);
  }
});

t('every checklist item explains why, and missing ones say where to get them', () => {
  const c = buildChecklist({
    category: 'caste_based_atrocity', impacts: ['physical_injury'],
    financialImpacts: ['medical_expenses'], hasFir: true, heldDocTypes: [],
  });
  for (const item of c.items) {
    ok(item.why && item.why.length > 20, `${item.docType}: no reason given`);
  }
  const named = c.items.filter((i) => i.howToGet);
  ok(named.length >= 3, 'most items should say where the document comes from');
});

t('completion counts only what is commonly asked for', () => {
  const c = buildChecklist({
    impacts: [], financialImpacts: [], hasFir: true, heldDocTypes: ['identity'],
  });
  eq(c.completed, 1);
  ok(c.total >= 1 && c.total <= c.items.length);
  // "may help" items exist but do not make the count look worse than it is.
  ok(c.items.length > c.total, 'there should be may_help items outside the count');
});

t('holding a document marks it present', () => {
  const c = buildChecklist({
    impacts: [], financialImpacts: [], hasFir: true,
    heldDocTypes: ['identity', 'fir'],
  });
  eq(c.items.find((i) => i.docType === 'fir').present, true);
  eq(c.missing.some((m) => m.docType === 'identity'), false);
});

// ---- progress --------------------------------------------------------------

t('progress measures the file, and never falls back to negative or over 100', () => {
  eq(recoveryProgress(null).percent, 0);
  const full = mkBundle({
    case: { status: 'CLOSED' },
    incident: { category: 'other', impacts: [] },
    fir: { hasFir: true, firNumber: '1/2026' },
    timeline: [
      { stage: 'investigation', status: 'COMPLETED' },
      { stage: 'charge_sheet', status: 'COMPLETED' },
      { stage: 'court', status: 'COMPLETED' },
      { stage: 'recovery', status: 'COMPLETED' },
    ],
    compensation: [{ id: 'c', status: 'APPROVED' }],
  });
  const p = recoveryProgress(full);
  ok(p.percent > 0 && p.percent <= 100, `percent out of range: ${p.percent}`);
  eq(p.stage, 'closure');
});

t('an empty case still reports a stage rather than undefined', () => {
  const p = recoveryProgress(mkBundle());
  eq(p.stage, 'incident');
  eq(p.percent, 0);
});

// ---- reminders -------------------------------------------------------------

t('reminder titles carry no case detail', () => {
  // A title may surface in an email subject or on a lock screen, and a phone
  // other people look at is the normal case for this population.
  const b = mkBundle({
    case: { updatedAt: iso('2026-01-01') },
    legalAid: [{ id: 'a', status: 'SUBMITTED', applicationNumber: null }],
    compensation: [{ id: 'c', status: 'SUBMITTED', applicationNumber: null }],
  });
  const checklist = buildChecklist({
    impacts: [], financialImpacts: [], hasFir: true, heldDocTypes: [],
  });
  const reminders = pendingReminders(b, checklist, NOW);
  ok(reminders.length > 0, 'expected reminders');
  const forbidden = /FIR|caste|compensation|legal aid|assault|VR-\d/i;
  for (const r of reminders) {
    ok(!forbidden.test(r.title), `title leaks detail: "${r.title}"`);
  }
});

t('a due follow-up produces exactly one reminder, not one per application', () => {
  const b = mkBundle({
    legalAid: [{ id: 'a', status: 'SUBMITTED', applicationNumber: 'LA1',
                 nextFollowUpOn: '2026-09-01' }],
    compensation: [{ id: 'c', status: 'SUBMITTED', applicationNumber: 'C1',
                     nextFollowUpOn: '2026-09-02' }],
  });
  const reminders = pendingReminders(b, undefined, NOW);
  eq(reminders.filter((r) => r.kind === 'follow_up_due').length, 1);
});

t('a future follow-up date does not fire early', () => {
  const b = mkBundle({
    legalAid: [{ id: 'a', status: 'SUBMITTED', applicationNumber: 'LA1',
                 nextFollowUpOn: '2027-01-01' }],
  });
  eq(pendingReminders(b, undefined, NOW).some((r) => r.kind === 'follow_up_due'), false);
});

t('a closed case is not nagged about being stale', () => {
  const b = mkBundle({ case: { status: 'CLOSED', updatedAt: iso('2025-01-01') } });
  eq(pendingReminders(b, undefined, NOW).some((r) => r.kind === 'case_stale'), false);
});

t('no reminders at all without a case', () => {
  eq(pendingReminders(null, undefined, NOW).length, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

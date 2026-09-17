/**
 * The bridge between a survivor's case file and their counsellor.
 *
 * This is the one place in AURA where data crosses out of the Recovery Hub,
 * which until now no staff session could read at all. The thing worth pinning
 * is not that the feature works — it is that the boundary holds: that a
 * bundle stuffed with an FIR number, a police station, an incident account
 * and a private note produces rows containing a date and nothing else, that
 * withdrawing puts it back, and that a counsellor cannot take a shared date
 * away from the person who shared it.
 *
 * If a later edit widens what crosses, these fail.
 */
import {
  mergeCaseEvents,
  projectSharedDates,
  sharedDatesToCaseEvents,
  toPlainDate,
} from '../dist-test/recoveryDateProjection.js';
import { assessEscalation } from '../dist-test/escalationEngine.js';
import { readCaseEvents } from '../dist-test/caseEvents.js';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/**
 * A case carrying every sensitive field the Hub can hold. Handed to the
 * projection on purpose: the test is what it refuses to copy.
 */
const mkBundle = (over = {}) => ({
  case: {
    id: 'VR-2026-00042',
    ownerId: 'user-1',
    displayName: 'A real name',
    contactPhone: '9999999999',
    contactEmail: 'someone@example.com',
    state: 'Maharashtra',
    district: 'Pune',
    language: 'en',
    status: 'IN_PROGRESS',
    financialImpacts: ['medical'],
    priorAssistance: 'no',
    shareDatesWithCounsellor: true,
    openedAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...(over.case || {}),
  },
  incident: {
    id: 'inc-1', caseId: 'VR-2026-00042', category: 'assault',
    occurredOn: '2026-08-02', location: 'Near the bus stand',
    policeStation: 'Kothrud', account: 'What they did to me, in my own words.',
    impacts: ['medical'],
  },
  fir: {
    id: 'fir-1', caseId: 'VR-2026-00042', hasFir: true,
    firNumber: '0123/2026', firYear: 2026, policeStation: 'Kothrud',
    district: 'Pune', firDate: '2026-08-05', caseStage: 'investigation',
    verification: 'USER_REPORTED',
  },
  hearings: [
    { id: 'hr-1', caseId: 'VR-2026-00042', hearingOn: day(4),
      note: 'District court, the one my brother testifies at',
      createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  ],
  timeline: [], documents: [], legalAid: [], compensation: [],
  ...over,
});

// ---- the boundary ---------------------------------------------------------

t('a shared row carries a date and a kind, and nothing else', () => {
  const rows = projectSharedDates(mkBundle());
  ok(rows.length > 0, 'expected rows');
  for (const r of rows) {
    const keys = Object.keys(r).sort().join(',');
    eq(keys, 'caseId,id,kind,onDate,ownerId', 'shared row shape widened');
  }
});

t('nothing sensitive from the bundle appears anywhere in the projection', () => {
  const serialised = JSON.stringify(projectSharedDates(mkBundle()));
  for (const secret of [
    '0123/2026',            // FIR number
    'Kothrud',              // police station
    'What they did to me',  // the account
    'my brother',           // their private note on the hearing
    'A real name',
    '9999999999',
    'someone@example.com',
  ]) {
    ok(!serialised.includes(secret), `projection leaked: ${secret}`);
  }
});

t('the private note on a hearing never becomes a case event note', () => {
  const rows = projectSharedDates(mkBundle());
  const events = sharedDatesToCaseEvents(
    rows.map((r) => ({ ...r, sharedAt: '2026-09-17T00:00:00.000Z' })),
    'user-1'
  );
  ok(events.length > 0, 'expected events');
  for (const e of events) {
    eq(e.note, undefined, 'a shared event must carry no note');
  }
});

// ---- the grant ------------------------------------------------------------

t('sharing off projects nothing, however many dates are on file', () => {
  const rows = projectSharedDates(mkBundle({ case: { shareDatesWithCounsellor: false } }));
  eq(rows.length, 0, 'dates escaped while sharing was off');
});

t('sharing off is the default a missing flag falls back to', () => {
  const rows = projectSharedDates(mkBundle({ case: { shareDatesWithCounsellor: undefined } }));
  eq(rows.length, 0);
});

t('turning sharing back on projects the same rows again, by the same ids', () => {
  const on = projectSharedDates(mkBundle());
  const again = projectSharedDates(mkBundle());
  eq(JSON.stringify(on), JSON.stringify(again), 'projection is not deterministic');
});

t('both kinds of date cross, and only those two kinds', () => {
  const kinds = [...new Set(projectSharedDates(mkBundle()).map((r) => r.kind))].sort();
  eq(kinds.join(','), 'fir_filed,hearing');
});

t('a case with no hearings and no FIR date shares nothing', () => {
  const rows = projectSharedDates(mkBundle({ hearings: [], fir: null }));
  eq(rows.length, 0);
});

t('a malformed date is dropped rather than shared as garbage', () => {
  const rows = projectSharedDates(mkBundle({
    hearings: [{ id: 'h', caseId: 'c', hearingOn: 'next Tuesday' }],
    fir: null,
  }));
  eq(rows.length, 0);
});

t('two hearings on the same day produce one shared row', () => {
  const rows = projectSharedDates(mkBundle({
    hearings: [
      { id: 'h1', caseId: 'c', hearingOn: day(3) },
      { id: 'h2', caseId: 'c', hearingOn: day(3) },
    ],
    fir: null,
  }));
  eq(rows.length, 1);
});

t('toPlainDate accepts a date and an ISO timestamp, and rejects prose', () => {
  eq(toPlainDate('2026-09-17'), '2026-09-17');
  eq(toPlainDate('2026-09-17T12:00:00.000Z'), '2026-09-17');
  eq(toPlainDate('sometime in July'), null);
  eq(toPlainDate(''), null);
  eq(toPlainDate(null), null);
});

// ---- what the counsellor ends up with -------------------------------------

const sharedRow = (kind, onDate) => ({
  id: `sd-c-${kind}-${onDate}`, caseId: 'c', ownerId: 'user-1',
  kind, onDate, sharedAt: '2026-09-17T00:00:00.000Z',
});

t('a shared date is marked as the participant\'s, not the counsellor\'s', () => {
  const [e] = sharedDatesToCaseEvents([sharedRow('hearing', day(3))], 'user-1');
  eq(e.source, 'participant_shared');
  eq(e.recordedBy, 'Shared by the participant');
});

t('an FIR date maps to its own type rather than masquerading as police contact', () => {
  const [e] = sharedDatesToCaseEvents([sharedRow('fir_filed', day(-30))], 'user-1');
  eq(e.type, 'fir_filed');
});

t('an FIR date does not, on its own, raise anyone', () => {
  // It is carried for context. Inventing a risk window for it would be
  // guessing with someone's alert level.
  const reading = readCaseEvents(
    sharedDatesToCaseEvents([sharedRow('fir_filed', day(-2))], 'user-1')
  );
  eq(reading.recentIncidents.length, 0, 'fir_filed was treated as an incident');
});

t('the merge prefers the counsellor row when both hold the same day', () => {
  const counsellor = {
    id: 'c1', participantId: 'user-1', type: 'hearing',
    date: new Date(`${day(5)}T12:00:00`).toISOString(),
    note: 'She asked me to come with her', recordedBy: 'Counselor',
    recordedAt: '2026-09-16T00:00:00.000Z',
  };
  const merged = mergeCaseEvents([counsellor], sharedDatesToCaseEvents([sharedRow('hearing', day(5))], 'user-1'));
  eq(merged.length, 1, 'the same hearing was counted twice');
  eq(merged[0].note, 'She asked me to come with her', 'the counsellor note was lost');
});

t('a shared date the counsellor does not have is added', () => {
  const merged = mergeCaseEvents([], sharedDatesToCaseEvents([sharedRow('hearing', day(6))], 'user-1'));
  eq(merged.length, 1);
  eq(merged[0].source, 'participant_shared');
});

t('merging keeps every distinct date', () => {
  const counsellor = {
    id: 'c1', participantId: 'user-1', type: 'threat',
    date: new Date(`${day(-3)}T12:00:00`).toISOString(),
    recordedBy: 'Counselor', recordedAt: '2026-09-16T00:00:00.000Z',
  };
  const merged = mergeCaseEvents(
    [counsellor],
    sharedDatesToCaseEvents([sharedRow('hearing', day(5)), sharedRow('fir_filed', day(-40))], 'user-1')
  );
  eq(merged.length, 3);
});

t('an empty share changes nothing a counsellor already had', () => {
  const counsellor = {
    id: 'c1', participantId: 'user-1', type: 'hearing',
    date: new Date(`${day(5)}T12:00:00`).toISOString(),
    recordedBy: 'Counselor', recordedAt: '2026-09-16T00:00:00.000Z',
  };
  eq(mergeCaseEvents([counsellor], []).length, 1);
  eq(mergeCaseEvents([counsellor], sharedDatesToCaseEvents([], 'user-1')).length, 1);
});

// ---- the point of the whole exercise --------------------------------------

const baseCheckIn = {
  id: 'ci-1', participantId: 'user-1', timestamp: new Date().toISOString(),
  safety: 'Yes', stressLevel: 2, emotionalWellbeing: 4, sleepQuality: 4,
  socialConnection: 4, supportRequested: false, immediateSafetyConcern: false,
};
const calmEngagement = { signals: [], summary: '', level: 'none' };

t('a hearing the person shared raises them, with no counsellor entry at all', () => {
  const before = assessEscalation({
    checkIns: [baseCheckIn], engagement: calmEngagement, caseEvents: [],
  });
  eq(before.level, 'none', 'the control case was not quiet');

  const after = assessEscalation({
    checkIns: [baseCheckIn],
    engagement: calmEngagement,
    caseEvents: sharedDatesToCaseEvents([sharedRow('hearing', day(3))], 'user-1'),
  });
  ok(after.level !== 'none', 'a shared hearing did not reach the engine');
  ok(after.basis.includes('case'), 'the reason was not attributed to the case');
  ok(
    after.evidence.some((e) => e.toLowerCase().includes('hearing')),
    'the counsellor is not told a hearing is why'
  );
});

t('a hearing two days out is treated as more pressing than one a week out', () => {
  const near = assessEscalation({
    checkIns: [baseCheckIn], engagement: calmEngagement,
    caseEvents: sharedDatesToCaseEvents([sharedRow('hearing', day(2))], 'user-1'),
  });
  const far = assessEscalation({
    checkIns: [baseCheckIn], engagement: calmEngagement,
    caseEvents: sharedDatesToCaseEvents([sharedRow('hearing', day(6))], 'user-1'),
  });
  const rank = { none: 0, watch: 1, contact: 2, urgent: 3 };
  ok(rank[near.level] > rank[far.level], 'proximity to the hearing did not matter');
});

t('withdrawing the share puts the engine back exactly where it started', () => {
  const withShare = assessEscalation({
    checkIns: [baseCheckIn], engagement: calmEngagement,
    caseEvents: sharedDatesToCaseEvents([sharedRow('hearing', day(3))], 'user-1'),
  });
  // Withdrawal empties the projection, so the engine sees no case events.
  const afterWithdrawal = assessEscalation({
    checkIns: [baseCheckIn], engagement: calmEngagement,
    caseEvents: sharedDatesToCaseEvents(
      projectSharedDates(mkBundle({ case: { shareDatesWithCounsellor: false } })).map(
        (r) => ({ ...r, sharedAt: '2026-09-17T00:00:00.000Z' })
      ),
      'user-1'
    ),
  });
  ok(withShare.level !== 'none', 'precondition failed');
  eq(afterWithdrawal.level, 'none', 'withdrawal left the escalation raised');
});

// ---- the schema is the guarantee, so read it -------------------------------

const migration = readFileSync(
  new URL('../supabase/migrations/20260917140000_recovery_shared_dates.sql', import.meta.url),
  'utf8'
);

t('the shared table has no free-text column to smuggle anything through', () => {
  const body = migration.slice(
    migration.indexOf('create table if not exists public.recovery_shared_dates'),
    migration.indexOf('create index if not exists recovery_shared_dates_owner')
  );
  for (const banned of ['note', 'description', 'fir_number', 'account', 'detail', 'label']) {
    ok(!new RegExp(`^\\s*${banned}\\s`, 'm').test(body), `recovery_shared_dates grew a ${banned} column`);
  }
});

t('staff can read shared dates and cannot write them', () => {
  const staffPolicies = migration
    .split('create policy')
    .filter((p) => p.includes('is_staff()'));
  eq(staffPolicies.length, 1, 'is_staff() appears in more than one policy');
  ok(/for select/.test(staffPolicies[0]), 'the staff policy is not select-only');
  ok(
    staffPolicies[0].includes('recovery_shared_dates'),
    'is_staff() reached a table other than recovery_shared_dates'
  );
});

t('the survivor\'s own hearing list is never staff-readable', () => {
  const hearingPolicies = migration
    .split('create policy')
    .filter((p) => p.includes('on public.recovery_hearings'));
  ok(hearingPolicies.length >= 4, 'expected the usual four owner policies');
  for (const p of hearingPolicies) {
    ok(!p.includes('is_staff'), 'a staff branch reached recovery_hearings');
  }
});

t('revocation is enforced by the database, not by the client', () => {
  ok(
    /create trigger recovery_cases_revoke_shared_dates/.test(migration),
    'no revocation trigger'
  );
  ok(
    /delete from public\.recovery_shared_dates where case_id = new\.id/.test(migration),
    'the trigger does not delete the shared rows'
  );
});

t('a row cannot be inserted for a case that has not opted in', () => {
  const insert = migration.slice(
    migration.indexOf('create policy recovery_shared_dates_insert'),
    migration.indexOf('drop policy if exists recovery_shared_dates_delete')
  );
  ok(insert.includes('share_dates_with_counsellor is true'), 'the insert policy does not check the grant');
  ok(insert.includes('owner_id = auth.uid()'), 'the insert policy does not check ownership');
});

t('sharing is off by default at the column level', () => {
  ok(
    /share_dates_with_counsellor boolean not null default false/.test(migration),
    'the share column does not default to false'
  );
});

// ---- what the person is told ----------------------------------------------

const card = readFileSync(
  new URL('../src/components/Recovery/CourtDatesCard.tsx', import.meta.url),
  'utf8'
);

t('the consent copy names what is not shared, not only what is', () => {
  ok(/not your FIR number/.test(card), 'the copy does not say the FIR number stays behind');
  ok(/not your documents/.test(card), 'the copy does not say documents stay behind');
  ok(/not what you wrote/.test(card), 'the copy does not say the account stays behind');
});

t('the copy promises withdrawal, which the trigger actually delivers', () => {
  ok(/[Tt]urn this off/.test(card), 'withdrawal is not offered in the copy');
});

t('nothing here claims a date is confirmed by a court', () => {
  for (const claim of ['verified by', 'confirmed by the court', 'official record', 'court system confirms']) {
    ok(!card.toLowerCase().includes(claim.toLowerCase()), `card claims: ${claim}`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

/**
 * District / State / national oversight: the rules that keep it de-identified
 * and the figures that make it useful.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  computeJurisdictionView, groupAlertsForDistrictNotice, caseRef, areaKey, MIN_GROUP_SIZE,
} from '../dist-test/jurisdictionAggregates.js';

const root = fileURLToPath(new URL('..', import.meta.url));
let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const NOW = Date.parse('2026-09-26T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();

// Pune: 6 people (shown). Nagpur: 2 people (suppressed). Karnataka/Mysuru: 5. One with no area.
const P = [];
for (let i = 1; i <= 6; i++) P.push({ id: `P-PUNE-${i}`, state: 'Maharashtra', district: i === 1 ? ' pune ' : 'Pune', status: 'Stable', assignedWorker: i === 6 ? null : 'w1' });
P.push({ id: 'P-NAG-1', state: 'Maharashtra', district: 'Nagpur', status: 'Stable', assignedWorker: 'w1' });
P.push({ id: 'P-NAG-2', state: 'Maharashtra', district: 'Nagpur', status: 'Urgent safety signal', assignedWorker: 'w1' });
for (let i = 1; i <= 5; i++) P.push({ id: `P-MYS-${i}`, state: 'Karnataka', district: 'Mysuru', status: 'Stable', assignedWorker: 'w2' });
P.push({ id: '3f2a9c10-1111-2222-3333-444455556666', state: null, district: null, status: 'Stable', assignedWorker: null });

const C = [
  { participantId: 'P-PUNE-1', score: 80, occurredAt: daysAgo(1) },
  { participantId: 'P-PUNE-1', score: 40, occurredAt: daysAgo(20) },
  { participantId: 'P-PUNE-2', score: 65, occurredAt: daysAgo(2) },
  { participantId: 'P-PUNE-3', score: 62, occurredAt: daysAgo(3) },
  { participantId: 'P-MYS-1', score: 30, occurredAt: daysAgo(40) },
];
const A = [
  // Overdue: RED raised 3 h ago, never acknowledged (1 h target).
  { id: 'a1', participantId: 'P-PUNE-1', severity: 'RED', status: 'NEW', createdAt: hoursAgo(3) },
  // Pending: ORANGE raised 2 h ago (24 h target).
  { id: 'a2', participantId: 'P-PUNE-4', severity: 'ORANGE', status: 'NEW', createdAt: hoursAgo(2) },
  // Closed: never counts.
  { id: 'a3', participantId: 'P-PUNE-5', severity: 'RED', status: 'RESOLVED', createdAt: hoursAgo(50) },
  // Open but acknowledged, and already sent to the district officer.
  { id: 'a4', participantId: 'P-PUNE-2', severity: 'RED', status: 'NEW', createdAt: hoursAgo(1), acknowledgedAt: hoursAgo(0.5), districtNotifiedAt: hoursAgo(1) },
];

const national = computeJurisdictionView({ participants: P, checkIns: C, alerts: A, now: NOW });
const state = computeJurisdictionView({ participants: P, checkIns: C, alerts: A, state: 'maharashtra', now: NOW });
const pune = computeJurisdictionView({ participants: P, checkIns: C, alerts: A, state: 'Maharashtra', district: 'PUNE', now: NOW });
const nagpur = computeJurisdictionView({ participants: P, checkIns: C, alerts: A, state: 'Maharashtra', district: 'Nagpur', now: NOW });

t('levels are chosen by what is given', () => {
  eq(national.level, 'national'); eq(state.level, 'state'); eq(pune.level, 'district');
});

t('national groups by State, with "Not specified" last', () => {
  eq(national.groups.map((g) => g.name).join('|'), 'Maharashtra|Karnataka|Not specified');
  eq(national.totals.participants, P.length);
});

t('district names match regardless of case and spaces', () => {
  eq(areaKey(' pune '), areaKey('PUNE'));
  eq(state.groups.find((g) => g.name.toLowerCase() === 'pune').participants, 6);
});

t(`areas with fewer than ${MIN_GROUP_SIZE} people are suppressed`, () => {
  const nag = state.groups.find((g) => g.name === 'Nagpur');
  ok(nag.suppressed, 'Nagpur not suppressed');
  eq(nag.participants, null); eq(nag.highRisk, null); eq(nag.openHighAlerts, null);
  ok(nagpur.totals.suppressed, 'Nagpur totals not suppressed');
});

t('high risk counts score ≥ 75, urgent status and open high alerts', () => {
  // P-PUNE-1 (score 80 + RED), P-PUNE-2 (open RED, acknowledged), P-PUNE-4 (ORANGE)
  eq(pune.totals.highRisk, 3);
  eq(pune.totals.elevated, 1, 'P-PUNE-3 at 62');
});

t('response time uses the same clocks as the counsellor dashboard', () => {
  eq(pune.totals.openHighAlerts, 3, 'a1 + a2 + a4 open');
  eq(pune.totals.overdueAlerts, 1, 'only a1 is past its 1 h target unacknowledged');
});

t('closed alerts never count', () => {
  ok(!pune.cases.some((c) => c.caseRef === 'P-PUNE-5'), 'resolved alert made a case high-risk');
});

t('trend compares the last 14 days with the 14 before', () => {
  // Only P-PUNE-1 has both windows: 80 vs 40.
  eq(pune.cases.find((c) => c.caseRef === 'P-PUNE-1').trendDelta, 40);
});

t('unassigned and quiet counts', () => {
  eq(pune.totals.unassigned, 1);
  eq(pune.totals.quiet14d, 3, 'P-PUNE-4,5,6 have no check-in');
});

t('district case list is ordered overdue first', () => {
  eq(pune.cases.map((c) => c.responseState).join(','), 'overdue,pending,acknowledged');
  eq(pune.cases[0].caseRef, 'P-PUNE-1');
});

t('national and State views never list individual cases', () => {
  eq(national.cases.length, 0); eq(state.cases.length, 0);
});

t('no name or free text can appear in any output', () => {
  const withNames = P.map((p) => ({ ...p, name: 'SECRET NAME', notes: 'SECRET NOTE' }));
  const out = JSON.stringify([
    computeJurisdictionView({ participants: withNames, checkIns: C, alerts: A, now: NOW }),
    computeJurisdictionView({ participants: withNames, checkIns: C, alerts: A, state: 'Maharashtra', district: 'Pune', now: NOW }),
    groupAlertsForDistrictNotice(withNames, A),
  ]);
  ok(!out.includes('SECRET'), 'a name or note leaked');
});

t('case references hide the account id', () => {
  eq(caseRef('3f2a9c10-1111-2222-3333-444455556666'), 'AURA-3F2A9C10');
  eq(caseRef('P-1042'), 'P-1042');
});

t('district notices cover open, unsent, high alerts with a known district', () => {
  const notices = groupAlertsForDistrictNotice(P, A);
  eq(notices.length, 1);
  eq(notices[0].district, 'pune');
  eq(notices[0].alertIds.sort().join(','), 'a1,a2', 'resolved and already-sent alerts excluded');
});

t('the migration keeps district_officers out of reach of browser sessions', () => {
  const sql = readFileSync(join(root, 'supabase/migrations/20260926090000_jurisdiction_dashboards.sql'), 'utf8');
  ok(/alter table public\.district_officers enable row level security/i.test(sql), 'RLS not enabled');
  ok(!/create policy/i.test(sql), 'a policy would open the table to clients');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

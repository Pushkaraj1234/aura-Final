/**
 * Response-time clocks.
 *
 * FEATURE_AUDIT recorded "no response-time metric", which meant an alert could
 * be raised and never looked at and nothing in the system could tell you. The
 * tests that matter here are the ones stopping the metric from being gameable,
 * because a response-time number a team can improve without responding faster
 * is worse than no number at all.
 */
import { slaStatus, summariseSla, bandFor, SLA_TARGETS }
  from '../dist-test/slaEngine.js';

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log('PASS', n); }
                       catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} got ${a} want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected true'); };

const NOW = Date.parse('2026-09-15T12:00:00Z');
const minsAgo = (m) => new Date(NOW - m * 60000).toISOString();

const alert = (o = {}) => ({
  id: 'a' + Math.random(), participantId: 'p1', severity: 'RED',
  reason: 'test', status: 'NEW', createdAt: minsAgo(10), ...o,
});

// ---- bands -----------------------------------------------------------------

t('severity maps to the three bands', () => {
  eq(bandFor('RED'), 'urgent');
  eq(bandFor('ORANGE'), 'contact');
  eq(bandFor('YELLOW'), 'watch');
});

t('the bands are 1 hour, 24 hours and 7 days', () => {
  eq(SLA_TARGETS.urgent.minutes, 60);
  eq(SLA_TARGETS.contact.minutes, 1440);
  eq(SLA_TARGETS.watch.minutes, 10080);
});

t('an unknown severity gets the tighter clock, not the looser one', () => {
  // A bug in a system that escalates distress should fail towards attention.
  eq(bandFor(undefined), 'contact');
  eq(bandFor(''), 'contact');
  eq(bandFor('PUCE'), 'contact');
});

t('severity matching is case-insensitive', () => {
  eq(bandFor('red'), 'urgent');
  eq(bandFor('Yellow'), 'watch');
});

// ---- one alert's state -----------------------------------------------------

t('a fresh urgent alert is pending, with time left', () => {
  const s = slaStatus(alert({ createdAt: minsAgo(10) }), NOW);
  eq(s.state, 'pending');
  eq(s.minutesRemaining, 50);
});

t('an unacknowledged urgent alert breaches after an hour', () => {
  eq(slaStatus(alert({ createdAt: minsAgo(59) }), NOW).state, 'pending');
  eq(slaStatus(alert({ createdAt: minsAgo(61) }), NOW).state, 'breached');
});

t('acknowledging inside the window meets the target', () => {
  const s = slaStatus(alert({ createdAt: minsAgo(90), acknowledgedAt: minsAgo(45) }), NOW);
  eq(s.state, 'met', 'raised 90 min ago, acknowledged 45 min later');
  eq(s.minutesToAcknowledge, 45);
});

t('acknowledging late is still a breach, and says how late', () => {
  const s = slaStatus(alert({ createdAt: minsAgo(300), acknowledgedAt: minsAgo(60) }), NOW);
  eq(s.state, 'breached', 'acknowledged 240 minutes after a 60 minute target');
  eq(s.minutesToAcknowledge, 240);
});

t('a yellow alert has a week, not an hour', () => {
  const s = slaStatus(alert({ severity: 'YELLOW', createdAt: minsAgo(60 * 24 * 3) }), NOW);
  eq(s.state, 'pending');
  eq(s.band, 'watch');
});

t('resolving without acknowledging is closed, not breached', () => {
  // Historical rows predate the policy. Marking them failures of a rule that
  // did not exist would inflate the breach rate and teach nobody anything.
  const s = slaStatus(alert({ createdAt: minsAgo(10000), status: 'RESOLVED' }), NOW);
  eq(s.state, 'closed');
});

t('contact attempted is tracked separately from acknowledgement', () => {
  const seen = slaStatus(alert({ acknowledgedAt: minsAgo(5) }), NOW);
  eq(seen.contactAttempted, false, 'acknowledging is not contacting');
  const tried = slaStatus(alert({ acknowledgedAt: minsAgo(5), contactAttemptedAt: minsAgo(2) }), NOW);
  eq(tried.contactAttempted, true);
});

t('a missing or unparseable createdAt does not crash or silently breach', () => {
  eq(slaStatus(alert({ createdAt: undefined }), NOW).state, 'pending');
  eq(slaStatus(alert({ createdAt: 'not a date' }), NOW).state, 'pending');
});

// ---- the summary, and the ways it could be gamed ---------------------------

t('the met rate counts only alerts whose clock finished', () => {
  const s = summariseSla([
    alert({ createdAt: minsAgo(90), acknowledgedAt: minsAgo(45) }),   // met
    alert({ createdAt: minsAgo(300), acknowledgedAt: minsAgo(60) }),  // breached
    alert({ createdAt: minsAgo(5) }),                                  // pending
    alert({ createdAt: minsAgo(9999), status: 'RESOLVED' }),            // closed
  ], NOW);
  eq(s.total, 4); eq(s.met, 1); eq(s.breached, 1); eq(s.pending, 1); eq(s.closed, 1);
  eq(s.metRate, 50, 'one met of two judged; pending and closed excluded');
});

t('leaving alerts open cannot improve the met rate', () => {
  const answered = [alert({ createdAt: minsAgo(90), acknowledgedAt: minsAgo(45) })];
  const withStragglers = [...answered, alert({ createdAt: minsAgo(5) }), alert({ createdAt: minsAgo(5) })];
  eq(summariseSla(answered, NOW).metRate, summariseSla(withStragglers, NOW).metRate);
});

t('resolving without looking cannot improve the met rate', () => {
  const base = [
    alert({ createdAt: minsAgo(90), acknowledgedAt: minsAgo(45) }),
    alert({ createdAt: minsAgo(300), acknowledgedAt: minsAgo(60) }),
  ];
  const gamed = [...base, alert({ createdAt: minsAgo(9999), status: 'RESOLVED' })];
  eq(summariseSla(base, NOW).metRate, 50);
  eq(summariseSla(gamed, NOW).metRate, 50, 'a closed alert must not count as met');
});

t('the breach view lists the overdue, longest overdue first', () => {
  const mild = alert({ id: 'mild', createdAt: minsAgo(120) });
  const bad = alert({ id: 'bad', createdAt: minsAgo(600) });
  const fine = alert({ id: 'fine', createdAt: minsAgo(5) });
  const s = summariseSla([mild, fine, bad], NOW);
  eq(s.breached, 2);
  eq(s.breachedAlerts.map((a) => a.id).join(','), 'bad,mild');
});

t('the median acknowledgement time is reported across acknowledged alerts', () => {
  const s = summariseSla([
    alert({ createdAt: minsAgo(100), acknowledgedAt: minsAgo(90) }),  // 10
    alert({ createdAt: minsAgo(100), acknowledgedAt: minsAgo(70) }),  // 30
    alert({ createdAt: minsAgo(100), acknowledgedAt: minsAgo(50) }),  // 50
  ], NOW);
  eq(s.medianMinutesToAcknowledge, 30);
});

t('no alerts means no rate, rather than a flattering 100', () => {
  const s = summariseSla([], NOW);
  eq(s.total, 0);
  eq(s.metRate, null, 'an empty queue has not met anything');
  eq(s.medianMinutesToAcknowledge, null);
});

t('a queue of only pending alerts reports no rate either', () => {
  const s = summariseSla([alert({ createdAt: minsAgo(5) }), alert({ createdAt: minsAgo(5) })], NOW);
  eq(s.metRate, null);
  eq(s.pending, 2);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

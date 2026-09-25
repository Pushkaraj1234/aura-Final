import { slaStatus } from "./slaEngine.js";

/**
 * De-identified district / State / national oversight figures.
 *
 * The problem statement asks for dashboards "at district, State and national
 * levels for monitoring vulnerable victims and high-risk cases". This module
 * computes them from the same rows the counsellor dashboard uses, and it is
 * the only place that decides what an oversight view may show:
 *
 * - counts, risk bands, trends and response-time status, never a name, a
 *   check-in answer or anything a person wrote;
 * - an area with fewer than MIN_GROUP_SIZE participants has its figures
 *   suppressed, because a count of two people in one district is close to
 *   naming them;
 * - individual high-risk cases appear only at district level, and only by a
 *   case reference. The assigned counsellor remains the link to the person.
 *
 * Pure on purpose (no Supabase, no DOM) so the server can run it under the
 * service role and the rules can be tested on their own.
 */

export const MIN_GROUP_SIZE = 5;
/** Matches ALERT_THRESHOLD in alertConfig.ts: the score that raises an alert. */
export const HIGH_SCORE = 75;
export const ELEVATED_SCORE = 60;
export const QUIET_DAYS = 14;
export const ACTIVE_DAYS = 30;
export const TREND_DAYS = 14;
export const UNSPECIFIED = "Not specified";

const DAY = 24 * 60 * 60 * 1000;

export interface JParticipant {
  id: string;
  state?: string | null;
  district?: string | null;
  status?: string | null;
  assignedWorker?: string | null;
}

export interface JCheckIn {
  participantId: string;
  score: number | null;
  occurredAt: string;
}

export interface JAlert {
  id: string;
  participantId: string;
  severity?: string | null;
  status?: string | null;
  createdAt?: string | null;
  acknowledgedAt?: string | null;
  contactAttemptedAt?: string | null;
  districtNotifiedAt?: string | null;
}

export interface AreaMetrics {
  name: string;
  /** Null when suppressed. */
  participants: number | null;
  suppressed: boolean;
  activeLast30d: number | null;
  quiet14d: number | null;
  meanLatestScore: number | null;
  highRisk: number | null;
  elevated: number | null;
  /** Mean score over the last 14 days minus the 14 days before. Positive = worsening. */
  trendDelta: number | null;
  openHighAlerts: number | null;
  overdueAlerts: number | null;
  unassigned: number | null;
}

export interface CaseRow {
  caseRef: string;
  latestScore: number | null;
  latestCheckInAt: string | null;
  trendDelta: number | null;
  status: string | null;
  openAlertSeverity: string | null;
  alertRaisedAt: string | null;
  responseState: "pending" | "overdue" | "acknowledged" | null;
  counsellorAssigned: boolean;
}

export interface JurisdictionView {
  level: "national" | "state" | "district";
  state?: string;
  district?: string;
  totals: AreaMetrics;
  groups: AreaMetrics[];
  cases: CaseRow[];
}

// ---------------------------------------------------------------------------
// Area names
// ---------------------------------------------------------------------------

/** Trim and collapse spaces; empty becomes "". */
export function cleanArea(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

/** Case-insensitive key, so "Pune", "pune " and "PUNE" are one district. */
export function areaKey(value: string | null | undefined): string {
  return cleanArea(value).toLowerCase();
}

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** Display name for a key, preferring the first spelling seen. */
function displayName(key: string, seen: Map<string, string>): string {
  if (!key) return UNSPECIFIED;
  return seen.get(key) || titleCase(key);
}

// ---------------------------------------------------------------------------
// Case references
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A reference an official can quote back to a counsellor without being given
 * the person's identity. Demo ids such as "P-1042" are already opaque.
 */
export function caseRef(participantId: string): string {
  return UUID_RE.test(participantId) ? `AURA-${participantId.slice(0, 8).toUpperCase()}` : participantId;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

const CLOSED_STATUSES = ["RESOLVED", "DISMISSED"];
const HIGH_SEVERITIES = ["RED", "ORANGE", "URGENT", "ELEVATED"];
const ESCALATED_STATUSES = ["SAFETY_ESCALATED", "ESCALATED"];

export function isOpen(a: JAlert): boolean {
  return !CLOSED_STATUSES.includes((a.status || "").toUpperCase());
}

/** The same definition the admin escalations feed uses. */
export function isHighAlert(a: JAlert): boolean {
  return (
    HIGH_SEVERITIES.includes((a.severity || "").toUpperCase()) ||
    ESCALATED_STATUSES.includes((a.status || "").toUpperCase())
  );
}

function responseState(a: JAlert, now: number): CaseRow["responseState"] {
  if (a.acknowledgedAt) return "acknowledged";
  const sla = slaStatus(
    {
      severity: a.severity as any,
      status: a.status as any,
      createdAt: a.createdAt || undefined,
      acknowledgedAt: a.acknowledgedAt || undefined,
      contactAttemptedAt: a.contactAttemptedAt || undefined,
    } as any,
    now
  );
  return sla.state === "breached" ? "overdue" : "pending";
}

const SEVERITY_RANK: Record<string, number> = { RED: 4, URGENT: 4, ORANGE: 3, ELEVATED: 3, YELLOW: 2 };
const rank = (s?: string | null) => SEVERITY_RANK[(s || "").toUpperCase()] || 1;

// ---------------------------------------------------------------------------
// Per-participant facts
// ---------------------------------------------------------------------------

interface Facts {
  p: JParticipant;
  latestScore: number | null;
  latestAt: number | null;
  recentMean: number | null;
  priorMean: number | null;
  openHigh: JAlert[];
  overdue: number;
  isHighRisk: boolean;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

function factsFor(
  participants: JParticipant[],
  checkIns: JCheckIn[],
  alerts: JAlert[],
  now: number
): Facts[] {
  const byP = new Map<string, JCheckIn[]>();
  for (const c of checkIns) {
    if (!c.participantId || typeof c.score !== "number" || !Number.isFinite(c.score)) continue;
    const t = Date.parse(c.occurredAt);
    if (!Number.isFinite(t)) continue;
    const list = byP.get(c.participantId) || [];
    list.push(c);
    byP.set(c.participantId, list);
  }
  const alertsByP = new Map<string, JAlert[]>();
  for (const a of alerts) {
    if (!a.participantId || !isOpen(a) || !isHighAlert(a)) continue;
    const list = alertsByP.get(a.participantId) || [];
    list.push(a);
    alertsByP.set(a.participantId, list);
  }

  return participants.map((p) => {
    const list = (byP.get(p.id) || []).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const latest = list[list.length - 1];
    const recent = list.filter((c) => now - Date.parse(c.occurredAt) <= TREND_DAYS * DAY).map((c) => c.score as number);
    const prior = list
      .filter((c) => {
        const age = now - Date.parse(c.occurredAt);
        return age > TREND_DAYS * DAY && age <= 2 * TREND_DAYS * DAY;
      })
      .map((c) => c.score as number);
    const openHigh = alertsByP.get(p.id) || [];
    const overdue = openHigh.filter((a) => responseState(a, now) === "overdue").length;
    const latestScore = latest ? (latest.score as number) : null;
    const status = p.status || "";
    return {
      p,
      latestScore,
      latestAt: latest ? Date.parse(latest.occurredAt) : null,
      recentMean: mean(recent),
      priorMean: mean(prior),
      openHigh,
      overdue,
      isHighRisk:
        (latestScore !== null && latestScore >= HIGH_SCORE) ||
        status === "Urgent safety signal" ||
        status === "Human review pending" ||
        openHigh.length > 0,
    };
  });
}

function metricsFor(name: string, facts: Facts[], now: number): AreaMetrics {
  const n = facts.length;
  if (n < MIN_GROUP_SIZE) {
    return {
      name,
      participants: null,
      suppressed: true,
      activeLast30d: null,
      quiet14d: null,
      meanLatestScore: null,
      highRisk: null,
      elevated: null,
      trendDelta: null,
      openHighAlerts: null,
      overdueAlerts: null,
      unassigned: null,
    };
  }
  const latestScores = facts.map((f) => f.latestScore).filter((s): s is number => s !== null);
  const recent = facts.map((f) => f.recentMean).filter((s): s is number => s !== null);
  const prior = facts.map((f) => f.priorMean).filter((s): s is number => s !== null);
  const recentMean = mean(recent);
  const priorMean = mean(prior);
  return {
    name,
    participants: n,
    suppressed: false,
    activeLast30d: facts.filter((f) => f.latestAt !== null && now - f.latestAt <= ACTIVE_DAYS * DAY).length,
    quiet14d: facts.filter((f) => f.latestAt === null || now - f.latestAt > QUIET_DAYS * DAY).length,
    meanLatestScore: round1(mean(latestScores)),
    highRisk: facts.filter((f) => f.isHighRisk).length,
    elevated: facts.filter(
      (f) => !f.isHighRisk && f.latestScore !== null && f.latestScore >= ELEVATED_SCORE
    ).length,
    trendDelta: recentMean !== null && priorMean !== null ? round1(recentMean - priorMean) : null,
    openHighAlerts: facts.reduce((s, f) => s + f.openHigh.length, 0),
    overdueAlerts: facts.reduce((s, f) => s + f.overdue, 0),
    unassigned: facts.filter((f) => !f.p.assignedWorker).length,
  };
}

function caseRowFor(f: Facts, now: number): CaseRow {
  const worst = [...f.openHigh].sort(
    (a, b) => rank(b.severity) - rank(a.severity) || Date.parse(a.createdAt || "") - Date.parse(b.createdAt || "")
  )[0];
  return {
    caseRef: caseRef(f.p.id),
    latestScore: f.latestScore,
    latestCheckInAt: f.latestAt !== null ? new Date(f.latestAt).toISOString() : null,
    trendDelta:
      f.recentMean !== null && f.priorMean !== null ? round1(f.recentMean - f.priorMean) : null,
    status: f.p.status || null,
    openAlertSeverity: worst ? (worst.severity || null) : null,
    alertRaisedAt: worst ? worst.createdAt || null : null,
    responseState: worst ? responseState(worst, now) : null,
    counsellorAssigned: !!f.p.assignedWorker,
  };
}

const RESPONSE_ORDER: Record<string, number> = { overdue: 0, pending: 1, acknowledged: 2 };

/**
 * One level of the drill-down. With no state: national, grouped by State.
 * With a state: that State, grouped by district. With both: that district,
 * with its high-risk case list.
 */
export function computeJurisdictionView(input: {
  participants: JParticipant[];
  checkIns: JCheckIn[];
  alerts: JAlert[];
  state?: string;
  district?: string;
  now?: number;
}): JurisdictionView {
  const now = input.now ?? Date.now();
  const stateKey = areaKey(input.state);
  const districtKey = areaKey(input.district);
  const level: JurisdictionView["level"] = !stateKey ? "national" : !districtKey ? "state" : "district";

  const stateSpelling = new Map<string, string>();
  const districtSpelling = new Map<string, string>();
  for (const p of input.participants) {
    const sk = areaKey(p.state);
    const dk = areaKey(p.district);
    if (sk && !stateSpelling.has(sk)) stateSpelling.set(sk, cleanArea(p.state));
    if (dk && !districtSpelling.has(dk)) districtSpelling.set(dk, cleanArea(p.district));
  }

  const inScope = input.participants.filter(
    (p) =>
      (!stateKey || areaKey(p.state) === stateKey) && (!districtKey || areaKey(p.district) === districtKey)
  );
  const facts = factsFor(inScope, input.checkIns, input.alerts, now);

  const scopeName =
    level === "national"
      ? "India"
      : level === "state"
        ? displayName(stateKey, stateSpelling)
        : displayName(districtKey, districtSpelling);

  const groups: AreaMetrics[] = [];
  if (level !== "district") {
    const keyOf = (f: Facts) => (level === "national" ? areaKey(f.p.state) : areaKey(f.p.district));
    const spelling = level === "national" ? stateSpelling : districtSpelling;
    const byKey = new Map<string, Facts[]>();
    for (const f of facts) {
      const k = keyOf(f);
      const list = byKey.get(k) || [];
      list.push(f);
      byKey.set(k, list);
    }
    for (const [k, list] of byKey) groups.push(metricsFor(displayName(k, spelling), list, now));
    // Most urgent first; "Not specified" and suppressed areas last.
    groups.sort((a, b) => {
      const aLast = a.name === UNSPECIFIED || a.suppressed ? 1 : 0;
      const bLast = b.name === UNSPECIFIED || b.suppressed ? 1 : 0;
      if (aLast !== bLast) return aLast - bLast;
      return (
        (b.overdueAlerts ?? 0) - (a.overdueAlerts ?? 0) ||
        (b.highRisk ?? 0) - (a.highRisk ?? 0) ||
        a.name.localeCompare(b.name)
      );
    });
  }

  const cases =
    level === "district"
      ? facts
          .filter((f) => f.isHighRisk)
          .map((f) => caseRowFor(f, now))
          .sort(
            (a, b) =>
              (RESPONSE_ORDER[a.responseState ?? "acknowledged"] ?? 3) -
                (RESPONSE_ORDER[b.responseState ?? "acknowledged"] ?? 3) ||
              rank(b.openAlertSeverity) - rank(a.openAlertSeverity) ||
              (b.latestScore ?? 0) - (a.latestScore ?? 0)
          )
      : [];

  return {
    level,
    state: level === "national" ? undefined : displayName(stateKey, stateSpelling),
    district: level === "district" ? displayName(districtKey, districtSpelling) : undefined,
    totals: metricsFor(scopeName, facts, now),
    groups,
    cases,
  };
}

// ---------------------------------------------------------------------------
// District officer notices
// ---------------------------------------------------------------------------

export interface DistrictNotice {
  stateKey: string;
  districtKey: string;
  state: string;
  district: string;
  alertIds: string[];
  cases: Array<{ caseRef: string; severity: string; raisedAt: string | null; counsellorAssigned: boolean }>;
}

/**
 * Open high-severity alerts that no district officer has been told about yet,
 * grouped by the participant's district. Participants with no district are
 * left out: there is no official to route them to, and they remain on the
 * admin escalations feed.
 */
export function groupAlertsForDistrictNotice(participants: JParticipant[], alerts: JAlert[]): DistrictNotice[] {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const notices = new Map<string, DistrictNotice>();
  for (const a of alerts) {
    if (a.districtNotifiedAt || !isOpen(a) || !isHighAlert(a)) continue;
    const p = byId.get(a.participantId);
    if (!p) continue;
    const sk = areaKey(p.state);
    const dk = areaKey(p.district);
    if (!sk || !dk) continue;
    const key = `${sk}|${dk}`;
    const notice =
      notices.get(key) ||
      ({
        stateKey: sk,
        districtKey: dk,
        state: cleanArea(p.state),
        district: cleanArea(p.district),
        alertIds: [],
        cases: [],
      } as DistrictNotice);
    notice.alertIds.push(a.id);
    notice.cases.push({
      caseRef: caseRef(p.id),
      severity: (a.severity || "").toUpperCase() || "UNKNOWN",
      raisedAt: a.createdAt || null,
      counsellorAssigned: !!p.assignedWorker,
    });
    notices.set(key, notice);
  }
  return Array.from(notices.values());
}

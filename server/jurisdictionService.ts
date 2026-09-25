import { getAdminSupabase } from './adminSupabase.js';
import { sendDistrictNotice } from './mailService.js';
import {
  areaKey,
  computeJurisdictionView,
  groupAlertsForDistrictNotice,
  JAlert,
  JCheckIn,
  JParticipant,
  JurisdictionView,
} from '../src/services/jurisdictionAggregates.js';

/**
 * Data access for the district / State / national oversight views and the
 * district-officer notices. Service role only: every caller must sit behind
 * requireAdmin (adminRouter) or the CRON_SECRET check (apiRouter). What may
 * leave the server is decided in jurisdictionAggregates.ts, which never
 * receives a name or anything a person wrote.
 */

/** Check-ins older than this cannot move any figure the views show. */
const CHECK_IN_WINDOW_DAYS = 60;
const PAGE = 1000;

export const MIGRATION_HINT =
  'The jurisdiction migration has not been applied. Run supabase/migrations/20260926090000_jurisdiction_dashboards.sql in the Supabase SQL editor.';

/** PostgREST caps a select at 1000 rows, so read every page. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const isMissingColumnOrTable = (err: any) =>
  ['42703', '42P01', 'PGRST205', 'PGRST204'].includes(String(err?.code || ''));

export class JurisdictionSetupError extends Error {}

export async function loadJurisdictionData(): Promise<{
  participants: JParticipant[];
  checkIns: JCheckIn[];
  alerts: JAlert[];
}> {
  const supabase = getAdminSupabase();
  const since = new Date(Date.now() - CHECK_IN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [participants, checkIns, alerts] = await Promise.all([
      fetchAll<any>((from, to) =>
        supabase
          .from('participants')
          .select('id, state, district, status, assigned_worker')
          .order('id')
          .range(from, to)
      ),
      fetchAll<any>((from, to) =>
        supabase
          .from('check_ins')
          .select('participant_id, calculated_score, occurred_at')
          .gte('occurred_at', since)
          .order('occurred_at')
          .range(from, to)
      ),
      fetchAll<any>((from, to) =>
        supabase
          .from('alerts')
          .select('id, participant_id, severity, status, created_at, acknowledged_at, contact_attempted_at, district_notified_at')
          // Closed alerts can never count; a null status is kept, like any open alert.
          .or('status.is.null,status.not.in.(RESOLVED,resolved,dismissed,DISMISSED)')
          .order('id')
          .range(from, to)
      ),
    ]);

    return {
      participants: participants.map((p) => ({
        id: p.id,
        state: p.state,
        district: p.district,
        status: p.status,
        assignedWorker: p.assigned_worker,
      })),
      checkIns: checkIns.map((c) => ({
        participantId: c.participant_id,
        score: typeof c.calculated_score === 'number' ? c.calculated_score : Number(c.calculated_score),
        occurredAt: c.occurred_at,
      })),
      alerts: alerts.map((a) => ({
        id: a.id,
        participantId: a.participant_id,
        severity: a.severity,
        status: a.status,
        createdAt: a.created_at,
        acknowledgedAt: a.acknowledged_at,
        contactAttemptedAt: a.contact_attempted_at,
        districtNotifiedAt: a.district_notified_at,
      })),
    };
  } catch (err: any) {
    if (isMissingColumnOrTable(err)) throw new JurisdictionSetupError(MIGRATION_HINT);
    throw err;
  }
}

export async function getJurisdictionView(state?: string, district?: string): Promise<JurisdictionView> {
  const data = await loadJurisdictionData();
  return computeJurisdictionView({ ...data, state, district });
}

export interface DistrictOfficer {
  id: string;
  state: string;
  district: string;
  officerName: string;
  designation: string | null;
  email: string;
  phone: string | null;
}

const officerFromRow = (r: any): DistrictOfficer => ({
  id: r.id,
  state: r.state,
  district: r.district,
  officerName: r.officer_name,
  designation: r.designation ?? null,
  email: r.email,
  phone: r.phone ?? null,
});

export async function listDistrictOfficers(): Promise<DistrictOfficer[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.from('district_officers').select('*').order('state').order('district');
  if (error) {
    if (isMissingColumnOrTable(error)) throw new JurisdictionSetupError(MIGRATION_HINT);
    throw error;
  }
  return (data || []).map(officerFromRow);
}

export interface NotifyResult {
  districtsWithCases: number;
  notified: number;
  alertsMarked: number;
  /** Districts with open high-risk alerts but no officer on file. */
  withoutOfficer: Array<{ state: string; district: string; cases: number }>;
  note?: string;
}

/**
 * Sends each district officer one de-identified notice covering every open
 * high-severity alert in their district that they have not been told about,
 * then stamps those alerts so they are never sent again. An alert is stamped
 * only after its email went out, so a mail failure is retried next run.
 */
export async function notifyDistrictOfficers(options: { dryRun?: boolean } = {}): Promise<NotifyResult> {
  const { participants, alerts } = await loadJurisdictionData();
  const notices = groupAlertsForDistrictNotice(participants, alerts);
  const officers = await listDistrictOfficers();
  const officerFor = new Map(officers.map((o) => [`${areaKey(o.state)}|${areaKey(o.district)}`, o]));

  const result: NotifyResult = {
    districtsWithCases: notices.length,
    notified: 0,
    alertsMarked: 0,
    withoutOfficer: [],
  };

  const routable = notices.filter((n) => {
    if (officerFor.has(`${n.stateKey}|${n.districtKey}`)) return true;
    result.withoutOfficer.push({ state: n.state, district: n.district, cases: n.cases.length });
    return false;
  });

  if (!routable.length) {
    result.note = notices.length
      ? 'No district with open high-risk alerts has an officer on file.'
      : 'No open high-risk alerts are waiting to be sent to a district officer.';
    return result;
  }
  if (options.dryRun) {
    result.note = 'Dry run: nothing was sent.';
    return result;
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    result.note = 'SMTP is not configured, so no email was sent.';
    return result;
  }

  const supabase = getAdminSupabase();
  for (const notice of routable) {
    const officer = officerFor.get(`${notice.stateKey}|${notice.districtKey}`)!;
    try {
      await sendDistrictNotice(officer.email, officer.officerName, notice);
    } catch (err: any) {
      console.warn('[AURA] district notice failed:', err?.message || err);
      continue;
    }
    result.notified++;
    const { error } = await supabase
      .from('alerts')
      .update({ district_notified_at: new Date().toISOString() })
      .in('id', notice.alertIds);
    if (error) console.warn('[AURA] could not mark alerts as sent to the district officer:', error.message);
    else result.alertsMarked += notice.alertIds.length;
  }

  if (!result.notified) result.note = 'Every district notice failed to send; see the server log.';
  return result;
}

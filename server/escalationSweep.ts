import { getAdminSupabase } from './adminSupabase.js';
import { sendEscalationDigest } from './mailService.js';
import { assessEngagement } from '../src/services/engagementSignals.js';
import { assessEscalation } from '../src/services/escalationEngine.js';

/**
 * The scheduled pass that turns a recommendation into something that reaches
 * a person.
 *
 * Until this existed, escalations were computed only while a counsellor had
 * the dashboard open — so a case that deteriorated over a weekend was
 * detected the moment somebody happened to look, which is the same periodic
 * check-in the original problem describes, wearing different clothes.
 *
 * Reuses the browser's engines rather than reimplementing them. They are
 * pure functions over types with no DOM dependency, and two copies of this
 * logic would drift apart within a week — with the copy nobody watches being
 * the one that pages people at midnight.
 */

export interface SweepCase {
  participantId: string;
  participantName?: string;
  assignedWorker?: string | null;
  headline: string;
  level: string;
  withinHours: number | null;
  evidence: string[];
}

export interface SweepResult {
  evaluated: number;
  flagged: SweepCase[];
  notified: number;
  /** Why nobody was emailed, when nobody was. */
  notifyNote?: string;
}

/** Only these reach a counsellor out of hours; "watch" waits for the dashboard. */
const NOTIFY_LEVELS = ['urgent', 'contact'];

export async function runEscalationSweep(options: { notify?: boolean } = {}): Promise<SweepResult> {
  const supabase = getAdminSupabase();

  // case_events may not exist as a table in every deployment — the feature
  // stores them on the participant record client-side — so its absence must
  // degrade the sweep rather than fail it.
  const loadCaseEvents = async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase.from('case_events').select('*');
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  };

  const [{ data: participants }, { data: checkIns }, caseEvents] = await Promise.all([
    supabase.from('participants').select('*'),
    supabase.from('check_ins').select('*'),
    loadCaseEvents(),
  ]);

  const byParticipant = new Map<string, any[]>();
  (checkIns || []).forEach((c: any) => {
    const id = c.participant_id || c.participantId;
    if (!id) return;
    const list = byParticipant.get(id) || [];
    list.push({ ...c, participantId: id, timestamp: c.timestamp || c.created_at });
    byParticipant.set(id, list);
  });

  const eventsByParticipant = new Map<string, any[]>();
  (caseEvents || []).forEach((e: any) => {
    const id = e.participant_id || e.participantId;
    if (!id) return;
    const list = eventsByParticipant.get(id) || [];
    list.push({ ...e, participantId: id });
    eventsByParticipant.set(id, list);
  });

  const flagged: SweepCase[] = [];

  (participants || []).forEach((p: any) => {
    const list = (byParticipant.get(p.id) || []).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const engagement = assessEngagement({ checkIns: list as any });
    const escalation = assessEscalation({
      checkIns: list as any,
      engagement,
      caseEvents: (eventsByParticipant.get(p.id) || []) as any,
    });

    if (!NOTIFY_LEVELS.includes(escalation.level)) return;
    flagged.push({
      participantId: p.id,
      participantName: p.name,
      assignedWorker: p.assigned_worker ?? p.assignedWorker ?? null,
      headline: escalation.headline,
      level: escalation.level,
      withinHours: escalation.withinHours,
      evidence: escalation.evidence,
    });
  });

  const result: SweepResult = {
    evaluated: (participants || []).length,
    flagged,
    notified: 0,
  };

  if (options.notify === false || !flagged.length) return result;

  // Matches exactly what getTransporter requires. Guarding on SMTP_HOST alone
  // meant a half-configured server tried to send, failed inside nodemailer,
  // and reported nothing useful — the caller saw zero notifications with no
  // note explaining them.
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // The sweep is still useful without mail — it is what the response
    // reports — so this degrades rather than throwing.
    result.notifyNote = 'SMTP is not configured, so no email was sent.';
    return result;
  }

  // Group by counsellor so nobody gets one email per case.
  const byWorker = new Map<string, SweepCase[]>();
  flagged.forEach((c) => {
    if (!c.assignedWorker) return;
    const list = byWorker.get(c.assignedWorker) || [];
    list.push(c);
    byWorker.set(c.assignedWorker, list);
  });

  if (!byWorker.size) {
    result.notifyNote = 'Flagged cases have no assigned counsellor to notify.';
    return result;
  }

  const workerIds = Array.from(byWorker.keys());
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', workerIds);

  for (const [workerId, cases] of byWorker) {
    const profile = (profiles || []).find((x: any) => x.id === workerId);
    if (!profile?.email) continue;
    try {
      await sendEscalationDigest(profile.email, profile.name || 'there', cases);
      result.notified++;
    } catch (err: any) {
      console.warn('[AURA] escalation digest failed:', err?.message || err);
    }
  }

  if (!result.notified && !result.notifyNote) {
    result.notifyNote = 'No assigned counsellor had an email address on file.';
  }
  return result;
}

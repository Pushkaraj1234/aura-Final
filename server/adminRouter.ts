import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import {
  checkAdminLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  verifyPasscode,
  issueAdminToken,
  getAdminConfigError,
  requireAdmin,
  AdminRequest,
} from './adminAuth.js';
import { getAdminSupabase } from './adminSupabase.js';
import { sendSupportWorkerCredentials, sendSupportWorkerRejection, sendPasswordReset } from './mailService.js';
import { analyzeCredentialDocument } from './aiService.js';
import {
  getJurisdictionView,
  listDistrictOfficers,
  notifyDistrictOfficers,
  JurisdictionSetupError,
} from './jurisdictionService.js';
import { areaKey, cleanArea } from '../src/services/jurisdictionAggregates.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, PNG, JPEG, or WEBP files are accepted for credential documents.'));
  },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id: unknown): id is string => typeof id === 'string' && UUID_RE.test(id);

function generateTemporaryPassword(): string {
  // 16 random bytes, base64url-ish, trimmed to a manageable but strong length.
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 14) + 'Aa1!';
}

async function logAdminAudit(action: string, description: string, metadata?: any) {
  try {
    const supabase = getAdminSupabase();
    await supabase.from('audit_logs').insert({
      id: `aud-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actor_id: 'admin',
      actor_role: 'ADMIN',
      actor_name: 'Administrator',
      action,
      category: 'ADMIN',
      description,
      severity: 'INFO',
      metadata_json: metadata,
    });
  } catch (err) {
    console.warn('[AURA Admin] audit log write skipped:', (err as any)?.message);
  }
}

// ---------------------------------------------------------------------------
// PUBLIC: counselor application intake (no admin session — this is the
// applicant-facing form, submitted before they have any account at all).
// ---------------------------------------------------------------------------
router.post('/applications', upload.single('credentialFile'), async (req: Request, res: Response) => {
  const { name, email, phone } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ detail: 'Name and email are required.' });
  }
  if (!req.file) {
    return res.status(400).json({ detail: 'A credential document (PDF or image) is required.' });
  }

  try {
    const supabase = getAdminSupabase();
    const id = `swa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase();
    const storagePath = `${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('credential-documents')
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) {
      return res.status(500).json({ detail: `Failed to upload credential document: ${uploadError.message}` });
    }

    // Assistive AI + keyword screening of the uploaded document. Best-effort:
    // a failure here never blocks the application. Runs before the insert so
    // the result is stored on the row and shown in the admin queue immediately.
    let credentialAnalysis: any = null;
    try {
      credentialAnalysis = await Promise.race([
        analyzeCredentialDocument(req.file.buffer.toString('base64'), req.file.mimetype, String(name)),
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'unavailable', reason: 'Analysis timed out.', analyzedAt: new Date().toISOString() }), 25000)
        ),
      ]);
    } catch (e: any) {
      credentialAnalysis = { status: 'unavailable', reason: e?.message || 'Analysis error.', analyzedAt: new Date().toISOString() };
    }

    const { error: insertError } = await supabase.from('support_worker_applications').insert({
      id,
      name,
      email: String(email).trim().toLowerCase(),
      phone: phone || null,
      credential_storage_path: storagePath,
      credential_filename: req.file.originalname,
      credential_analysis: credentialAnalysis,
      status: 'pending',
    });
    if (insertError) {
      return res.status(500).json({ detail: `Failed to record application: ${insertError.message}` });
    }

    res.json({ success: true, applicationId: id, credentialAnalysis });
  } catch (err: any) {
    console.error('[AURA Admin] application submission error:', err);
    res.status(500).json({ detail: err.message || 'Failed to submit application' });
  }
});

// ---------------------------------------------------------------------------
// Admin login
// ---------------------------------------------------------------------------
router.post('/login', checkAdminLockout, (req: Request, res: Response) => {
  // Configuration first. Without this, a deployment missing ADMIN_PASSCODE
  // reports "Incorrect passcode." (getPasscodeHash throws inside the try
  // below and lands in the generic 500), which sends people off hunting for
  // a typo in a passcode that was never going to work.
  const configError = getAdminConfigError();
  if (configError) {
    return res.status(503).json({ detail: configError, configurationError: true });
  }

  const { passcode } = req.body || {};
  if (!passcode) {
    // An empty body here usually means the request never reached this router
    // as JSON — worth saying so rather than blaming the operator's typing.
    return res.status(400).json({
      detail: 'No passcode reached the server. If you did enter one, the API route may be misconfigured — check /api/config-status.',
    });
  }
  try {
    if (!verifyPasscode(String(passcode))) {
      recordFailedAttempt(req);
      return res.status(401).json({ detail: 'Incorrect passcode.' });
    }
    clearFailedAttempts(req);
    const token = issueAdminToken();
    res.json({ token });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Admin login is not configured on the server.' });
  }
});

// ---------------------------------------------------------------------------
// Everything below requires a valid admin session.
// ---------------------------------------------------------------------------

router.get('/pending-workers', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('support_worker_applications')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true });
    if (error) return res.status(500).json({ detail: error.message });

    const withUrls = await Promise.all(
      (data || []).map(async (app) => {
        const { data: signed } = await supabase.storage
          .from('credential-documents')
          .createSignedUrl(app.credential_storage_path, 60 * 30); // 30 min
        return { ...app, credentialUrl: signed?.signedUrl || null };
      })
    );
    res.json(withUrls);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to load pending applications' });
  }
});

router.post('/workers/:id/approve', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  try {
    const supabase = getAdminSupabase();
    const { data: application, error: fetchErr } = await supabase
      .from('support_worker_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !application) return res.status(404).json({ detail: 'Application not found.' });
    if (application.status !== 'pending') {
      return res.status(400).json({ detail: `Application is already ${application.status}.` });
    }

    const temporaryPassword = generateTemporaryPassword();
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: application.email,
      password: temporaryPassword,
      email_confirm: true, // approved by an admin — skip the confirmation-email step entirely
      user_metadata: { name: application.name, role: 'support_worker' },
    });
    if (createErr || !created?.user) {
      return res.status(500).json({ detail: `Failed to create account: ${createErr?.message || 'unknown error'}` });
    }

    await supabase
      .from('support_worker_applications')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'admin',
        created_auth_user_id: created.user.id,
      })
      .eq('id', id);

    let emailSent = false;
    try {
      await sendSupportWorkerCredentials(application.email, application.name, temporaryPassword);
      emailSent = true;
    } catch (mailErr: any) {
      console.warn('[AURA Admin] credential email failed, returning password in response instead:', mailErr.message);
    }

    await logAdminAudit(
      'APPROVE_SUPPORT_WORKER',
      `Approved counselor application for ${application.name} (${application.email}).`,
      { applicationId: id, userId: created.user.id, emailSent }
    );

    res.json({ success: true, userId: created.user.id, emailSent, temporaryPassword });
  } catch (err: any) {
    console.error('[AURA Admin] approve error:', err);
    res.status(500).json({ detail: err.message || 'Failed to approve application' });
  }
});

router.post('/workers/:id/reject', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  try {
    const supabase = getAdminSupabase();
    const { data: application, error: fetchErr } = await supabase
      .from('support_worker_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !application) return res.status(404).json({ detail: 'Application not found.' });

    await supabase
      .from('support_worker_applications')
      .update({
        status: 'rejected',
        rejection_reason: reason || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'admin',
      })
      .eq('id', id);

    try {
      await sendSupportWorkerRejection(application.email, application.name, reason);
    } catch (mailErr: any) {
      console.warn('[AURA Admin] rejection email failed:', mailErr.message);
    }

    await logAdminAudit('REJECT_SUPPORT_WORKER', `Rejected counselor application for ${application.name}.`, {
      applicationId: id,
      reason,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[AURA Admin] reject error:', err);
    res.status(500).json({ detail: err.message || 'Failed to reject application' });
  }
});

router.get('/workers', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'support_worker');
    if (profErr) return res.status(500).json({ detail: profErr.message });

    const { data: participants, error: partErr } = await supabase
      .from('participants')
      .select('id, assigned_worker')
      .not('assigned_worker', 'is', null);
    if (partErr) return res.status(500).json({ detail: partErr.message });

    const caseloadByWorker = new Map<string, number>();
    (participants || []).forEach((p: any) => {
      caseloadByWorker.set(p.assigned_worker, (caseloadByWorker.get(p.assigned_worker) || 0) + 1);
    });

    // Cross-reference ban status from Supabase Auth (suspension is implemented
    // as a native Supabase Auth ban, not a custom column, so login itself is
    // blocked by Supabase — not something this app's own code has to enforce).
    const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const bannedIds = new Set(
      (userList?.users || [])
        .filter((u: any) => u.banned_until && new Date(u.banned_until).getTime() > Date.now())
        .map((u: any) => u.id)
    );

    const workers = (profiles || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      status: bannedIds.has(p.id) ? 'Suspended' : 'Active',
      caseload: caseloadByWorker.get(p.id) || 0,
    }));

    res.json(workers);
  } catch (err: any) {
    console.error('[AURA Admin] list workers error:', err);
    res.status(500).json({ detail: err.message || 'Failed to load counselors' });
  }
});

// Per-counselor aggregated/anonymized distress trend for their caseload
// (Oversight Dashboard requirement: default to aggregate views, require an
// explicit action to see individual-level detail -- enforced client-side by
// PendingQueueTab/WorkersTab keeping individualSeries collapsed until the
// admin explicitly asks for it, but the data itself has to come from
// somewhere, hence this single endpoint returning both).
router.get('/workers/:id/caseload-trends', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  try {
    const supabase = getAdminSupabase();
    const { data: worker } = await supabase.from('profiles').select('name').eq('id', id).maybeSingle();

    const { data: participants, error: pErr } = await supabase
      .from('participants')
      .select('id, status')
      .eq('assigned_worker', id);
    if (pErr) return res.status(500).json({ detail: pErr.message });

    const participantIds = (participants || []).map((p: any) => p.id);
    if (participantIds.length === 0) {
      return res.json({
        workerId: id,
        workerName: worker?.name || 'Unknown',
        caseloadCount: 0,
        aggregateTrend: [],
        individualSeries: [],
      });
    }

    const { data: checkIns, error: ciErr } = await supabase
      .from('check_ins')
      .select('participant_id, calculated_score, occurred_at')
      .in('participant_id', participantIds)
      .order('occurred_at', { ascending: true });
    if (ciErr) return res.status(500).json({ detail: ciErr.message });

    const byDate = new Map<string, { total: number; count: number }>();
    const byParticipant = new Map<string, { date: string; score: number }[]>();

    for (const ci of checkIns || []) {
      const date = String(ci.occurred_at).slice(0, 10);
      const score = Number(ci.calculated_score) || 0;

      const bucket = byDate.get(date) || { total: 0, count: 0 };
      bucket.total += score;
      bucket.count += 1;
      byDate.set(date, bucket);

      const list = byParticipant.get(ci.participant_id) || [];
      list.push({ date, score });
      byParticipant.set(ci.participant_id, list);
    }

    const aggregateTrend = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, { total, count }]) => ({
        date,
        averageScore: Math.round((total / count) * 10) / 10,
        checkInCount: count,
      }));

    const statusByParticipant = new Map((participants || []).map((p: any) => [p.id, p.status]));
    const individualSeries = Array.from(byParticipant.entries()).map(([participantId, points]) => ({
      participantId,
      status: statusByParticipant.get(participantId) || 'Unknown',
      points,
    }));

    res.json({
      workerId: id,
      workerName: worker?.name || 'Unknown',
      caseloadCount: participantIds.length,
      aggregateTrend,
      individualSeries,
    });
  } catch (err: any) {
    console.error('[AURA Admin] caseload trends error:', err);
    res.status(500).json({ detail: err.message || 'Failed to load caseload trends' });
  }
});

router.post('/workers/:id/suspend', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  try {
    const supabase = getAdminSupabase();
    const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' } as any);
    if (error) return res.status(500).json({ detail: error.message });

    // Auto-reassign the suspended counsellor's caseload so nobody is left
    // without support. Distribute to the remaining active counsellors by
    // lowest current caseload (respecting the configured max); if there is
    // no capacity anywhere the participant is unassigned and surfaces in the
    // admin's unassigned queue.
    let reassigned = 0;
    let unassigned = 0;
    try {
      const { data: caseload } = await supabase
        .from('participants')
        .select('id')
        .eq('assigned_worker', id);

      if (caseload && caseload.length > 0) {
        const { data: settingRow } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'max_caseload_default')
          .maybeSingle();
        const maxCaseload = Number(settingRow?.value ?? 15);

        const { data: workerProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'support_worker');
        const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const bannedIds = new Set(
          (userList?.users || [])
            .filter((u: any) => u.banned_until && new Date(u.banned_until).getTime() > Date.now())
            .map((u: any) => u.id)
        );
        bannedIds.add(id);
        const activeWorkerIds = (workerProfiles || [])
          .map((p: any) => p.id)
          .filter((wid: string) => !bannedIds.has(wid));

        const { data: allAssigned } = await supabase
          .from('participants')
          .select('assigned_worker')
          .not('assigned_worker', 'is', null);
        const caseloadByWorker = new Map<string, number>();
        (allAssigned || []).forEach((p: any) => {
          caseloadByWorker.set(p.assigned_worker, (caseloadByWorker.get(p.assigned_worker) || 0) + 1);
        });
        activeWorkerIds.forEach((wid) => {
          if (!caseloadByWorker.has(wid)) caseloadByWorker.set(wid, 0);
        });

        const historyRows: any[] = [];
        for (const participant of caseload) {
          const candidate = activeWorkerIds
            .map((wid) => ({ id: wid, load: caseloadByWorker.get(wid) || 0 }))
            .filter((w) => w.load < maxCaseload)
            .sort((a, b) => a.load - b.load)[0];

          const newWorker = candidate ? candidate.id : null;
          await supabase
            .from('participants')
            .update({ assigned_worker: newWorker })
            .eq('id', participant.id);
          historyRows.push({
            id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            participant_id: participant.id,
            previous_worker_id: isUuid(id) ? id : null,
            new_worker_id: newWorker,
            assigned_by: 'admin_suspension',
            reason: candidate
              ? 'Auto-reassigned after counsellor suspension'
              : 'Unassigned after counsellor suspension (no capacity)',
          });
          if (candidate) {
            caseloadByWorker.set(candidate.id, candidate.load + 1);
            reassigned++;
          } else {
            unassigned++;
          }
        }
        if (historyRows.length > 0) {
          await supabase.from('assignment_history').insert(historyRows);
        }
      }
    } catch (reassignErr: any) {
      console.error('[AURA Admin] caseload reassignment after suspension failed:', reassignErr);
    }

    await logAdminAudit(
      'SUSPEND_SUPPORT_WORKER',
      `Suspended counselor ${id}. Reassigned ${reassigned} participant(s)${unassigned ? `, ${unassigned} left unassigned (no capacity)` : ''}.`,
      { userId: id, reassigned, unassigned }
    );
    res.json({ success: true, reassigned, unassigned });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to suspend worker' });
  }
});

router.post('/workers/:id/reactivate', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  try {
    const supabase = getAdminSupabase();
    const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: 'none' } as any);
    if (error) return res.status(500).json({ detail: error.message });
    await logAdminAudit('REACTIVATE_SUPPORT_WORKER', `Reactivated counselor ${id}.`, { userId: id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to reactivate worker' });
  }
});

router.post('/workers/:id/reset-password', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  try {
    const supabase = getAdminSupabase();
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', id)
      .maybeSingle();
    if (profErr || !profile) return res.status(404).json({ detail: 'Counselor not found.' });

    const temporaryPassword = generateTemporaryPassword();
    const { error } = await supabase.auth.admin.updateUserById(id, { password: temporaryPassword });
    if (error) return res.status(500).json({ detail: error.message });

    let emailSent = false;
    try {
      await sendPasswordReset(profile.email, profile.name, temporaryPassword);
      emailSent = true;
    } catch (mailErr: any) {
      console.warn('[AURA Admin] password reset email failed, returning password in response instead:', mailErr.message);
    }

    await logAdminAudit('RESET_SUPPORT_WORKER_PASSWORD', `Reset password for counselor ${profile.name}.`, {
      userId: id,
      emailSent,
    });

    res.json({ success: true, emailSent, temporaryPassword });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to reset password' });
  }
});

router.get('/users', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { data: participants, error } = await supabase.from('participants').select('*');
    if (error) return res.status(500).json({ detail: error.message });

    // profiles.id is uuid — passing a legacy/demo id like "P-1003" (or an
    // assigned_worker stored as a plain name string) to `.in('id', ...)` makes
    // PostgREST reject the ENTIRE query with "invalid input syntax for type
    // uuid", which previously wiped every name to "Unknown". Only ever query
    // profiles for uuid-shaped ids.
    const ids = Array.from(new Set((participants || []).map((p: any) => p.id))).filter(isUuid);
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, name, email').in('id', ids)
      : { data: [] as any[] };
    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));

    const workerIds = Array.from(
      new Set((participants || []).map((p: any) => p.assigned_worker).filter(Boolean))
    ).filter(isUuid);
    const { data: workerProfiles } = workerIds.length
      ? await supabase.from('profiles').select('id, name').in('id', workerIds)
      : { data: [] as any[] };
    const workerNameById = new Map((workerProfiles || []).map((p: any) => [p.id, p.name]));

    const users = (participants || []).map((p: any) => ({
      id: p.id,
      // Fall back to the raw id (never a bare "Unknown") so a row is still
      // identifiable even if its profile is missing.
      name: profileById.get(p.id)?.name || p.id,
      email: profileById.get(p.id)?.email || null,
      status: p.status,
      assignedWorkerId: p.assigned_worker || null,
      assignedWorkerName: p.assigned_worker
        ? workerNameById.get(p.assigned_worker) || (isUuid(p.assigned_worker) ? 'Unknown worker' : p.assigned_worker)
        : null,
    }));

    res.json(users);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to load users' });
  }
});

router.post('/assignments', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { participantId, workerId, reason, override } = req.body || {};
  if (!participantId) {
    return res.status(400).json({ detail: 'participantId is required.' });
  }

  // Unassign path: no workerId supplied -> clear the participant's counsellor.
  if (!workerId) {
    try {
      const supabase = getAdminSupabase();
      const { data: participant, error: fetchErr } = await supabase
        .from('participants')
        .select('assigned_worker')
        .eq('id', participantId)
        .maybeSingle();
      if (fetchErr || !participant) return res.status(404).json({ detail: 'User not found.' });

      const { error: updateErr } = await supabase
        .from('participants')
        .update({ assigned_worker: null })
        .eq('id', participantId);
      if (updateErr) return res.status(500).json({ detail: updateErr.message });

      await supabase.from('assignment_history').insert({
        id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        participant_id: participantId,
        previous_worker_id: isUuid(participant.assigned_worker) ? participant.assigned_worker : null,
        new_worker_id: null,
        assigned_by: 'admin',
        reason: reason || 'Unassigned by admin',
      });
      await logAdminAudit('UNASSIGN_SUPPORT_WORKER', `Unassigned counsellor from user ${participantId}.`, {
        participantId,
        previousWorkerId: participant.assigned_worker || null,
      });
      return res.json({ success: true, unassigned: true });
    } catch (err: any) {
      console.error('[AURA Admin] unassign error:', err);
      return res.status(500).json({ detail: err.message || 'Failed to unassign user' });
    }
  }

  try {
    const supabase = getAdminSupabase();

    const { data: settingRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'max_caseload_default')
      .maybeSingle();
    const maxCaseload = Number(settingRow?.value ?? 15);

    const { count: currentCaseload } = await supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_worker', workerId);

    if (!override && (currentCaseload || 0) >= maxCaseload) {
      return res.status(409).json({
        warning: true,
        detail: `This worker already has ${currentCaseload} assigned users (max ${maxCaseload}). Confirm to assign anyway.`,
        currentCaseload,
        maxCaseload,
      });
    }

    const { data: participant, error: fetchErr } = await supabase
      .from('participants')
      .select('assigned_worker')
      .eq('id', participantId)
      .maybeSingle();
    if (fetchErr || !participant) return res.status(404).json({ detail: 'User not found.' });

    const { error: updateErr } = await supabase
      .from('participants')
      .update({ assigned_worker: workerId })
      .eq('id', participantId);
    if (updateErr) return res.status(500).json({ detail: updateErr.message });

    await supabase.from('assignment_history').insert({
      id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      participant_id: participantId,
      previous_worker_id: participant.assigned_worker || null,
      new_worker_id: workerId,
      assigned_by: 'admin',
      reason: reason || null,
    });

    await logAdminAudit('ASSIGN_SUPPORT_WORKER', `Assigned user ${participantId} to worker ${workerId}.`, {
      participantId,
      workerId,
      previousWorkerId: participant.assigned_worker || null,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[AURA Admin] assignment error:', err);
    res.status(500).json({ detail: err.message || 'Failed to assign user' });
  }
});

router.post('/assignments/bulk-auto', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();

    const { data: settingRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'max_caseload_default')
      .maybeSingle();
    const maxCaseload = Number(settingRow?.value ?? 15);

    const { data: unassignedAll, error: unassignedErr } = await supabase
      .from('participants')
      .select('id, preferred_support')
      .is('assigned_worker', null);
    if (unassignedErr) return res.status(500).json({ detail: unassignedErr.message });

    // Respect the participant's stated support preference: don't auto-assign a
    // counsellor to someone who chose self-guided / in-app-only support. They
    // can still be assigned manually.
    const wantsCounselor = (pref?: string | null) => {
      const p = (pref || '').toLowerCase();
      return !(p.includes('in-app') || p.includes('self-guid') || p.includes('self guided'));
    };
    const unassigned = (unassignedAll || []).filter((p: any) => wantsCounselor(p.preferred_support));
    const skippedByPreference = (unassignedAll || []).length - unassigned.length;

    const { data: workerParticipants } = await supabase
      .from('participants')
      .select('assigned_worker')
      .not('assigned_worker', 'is', null);
    const caseloadByWorker = new Map<string, number>();
    (workerParticipants || []).forEach((p: any) => {
      caseloadByWorker.set(p.assigned_worker, (caseloadByWorker.get(p.assigned_worker) || 0) + 1);
    });

    const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const { data: workerProfiles } = await supabase.from('profiles').select('id').eq('role', 'support_worker');
    const bannedIds = new Set(
      (userList?.users || [])
        .filter((u: any) => u.banned_until && new Date(u.banned_until).getTime() > Date.now())
        .map((u: any) => u.id)
    );
    const activeWorkerIds = (workerProfiles || []).map((p: any) => p.id).filter((id: string) => !bannedIds.has(id));
    activeWorkerIds.forEach((id) => {
      if (!caseloadByWorker.has(id)) caseloadByWorker.set(id, 0);
    });

    let assignedCount = 0;
    const historyRows: any[] = [];
    const updates: { id: string; assigned_worker: string }[] = [];

    for (const participant of unassigned || []) {
      // Pick the active worker with the lowest current caseload that still
      // has room under the configured max.
      const candidate = activeWorkerIds
        .map((id) => ({ id, load: caseloadByWorker.get(id) || 0 }))
        .filter((w) => w.load < maxCaseload)
        .sort((a, b) => a.load - b.load)[0];
      if (!candidate) break; // no capacity left anywhere

      updates.push({ id: participant.id, assigned_worker: candidate.id });
      historyRows.push({
        id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        participant_id: participant.id,
        previous_worker_id: null,
        new_worker_id: candidate.id,
        assigned_by: 'admin_bulk',
        reason: 'Bulk auto-distribution',
      });
      caseloadByWorker.set(candidate.id, candidate.load + 1);
      assignedCount++;
    }

    for (const update of updates) {
      await supabase.from('participants').update({ assigned_worker: update.assigned_worker }).eq('id', update.id);
    }
    if (historyRows.length > 0) {
      await supabase.from('assignment_history').insert(historyRows);
    }

    await logAdminAudit('BULK_AUTO_ASSIGN', `Bulk auto-assigned ${assignedCount} user(s) across ${activeWorkerIds.length} counsellor(s).`, {
      assignedCount,
      skippedByPreference,
    });

    res.json({
      success: true,
      assignedCount,
      skippedByPreference,
      unassignedRemaining: (unassigned.length || 0) - assignedCount,
    });
  } catch (err: any) {
    console.error('[AURA Admin] bulk assign error:', err);
    res.status(500).json({ detail: err.message || 'Failed to bulk-assign users' });
  }
});

router.get('/dashboard', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();

    const [{ count: totalUsers }, { count: totalWorkers }, { count: pendingVerifications }, { count: unassignedUsers }] =
      await Promise.all([
        supabase.from('participants').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'support_worker'),
        supabase.from('support_worker_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('participants').select('id', { count: 'exact', head: true }).is('assigned_worker', null),
      ]);

    const averageCaseload =
      totalWorkers && totalWorkers > 0 ? ((totalUsers || 0) - (unassignedUsers || 0)) / totalWorkers : 0;

    const { data: flagged } = await supabase
      .from('participants')
      .select('id, status, assigned_worker')
      .in('status', ['Urgent safety signal', 'Human review pending'])
      .is('assigned_worker', null);

    const flaggedIds = (flagged || []).map((f: any) => f.id).filter(isUuid);
    const flaggedNameById = new Map<string, string>();
    if (flaggedIds.length) {
      const { data: fp } = await supabase.from('profiles').select('id, name').in('id', flaggedIds);
      (fp || []).forEach((p: any) => flaggedNameById.set(p.id, p.name));
    }

    res.json({
      totalUsers: totalUsers || 0,
      totalWorkers: totalWorkers || 0,
      pendingVerifications: pendingVerifications || 0,
      unassignedUsers: unassignedUsers || 0,
      averageCaseload: Math.round(averageCaseload * 10) / 10,
      flaggedUnassignedUsers: (flagged || []).map((f: any) => ({
        ...f,
        name: flaggedNameById.get(f.id) || f.id,
      })),
    });
  } catch (err: any) {
    console.error('[AURA Admin] dashboard error:', err);
    res.status(500).json({ detail: err.message || 'Failed to load dashboard' });
  }
});

// Platform-wide live feed of high-severity / escalated alerts across every
// participant, regardless of who they're assigned to — the oversight view a
// platform admin needs to confirm nothing critical is being dropped. Read
// only; admins act through the assigned counselor, not directly on a case.
router.get('/escalations', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('id, participant_id, severity, category, title, reason, status, score, assigned_to, created_at')
      .or('severity.in.(RED,ORANGE,urgent,elevated),status.in.(SAFETY_ESCALATED,escalated)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ detail: error.message });

    const open = (alerts || []).filter(
      (a) => !['RESOLVED', 'resolved', 'dismissed'].includes(String(a.status))
    );

    // Source of truth for "whose case is this" is the participant's CURRENT
    // assigned_worker — an alert's own assigned_to can be stale if the
    // participant was (re)assigned after the alert was raised.
    const participantIds = Array.from(new Set(open.map((a) => a.participant_id)));
    const currentWorkerByParticipant = new Map<string, string | null>();
    if (participantIds.length) {
      const { data: parts } = await supabase
        .from('participants')
        .select('id, assigned_worker')
        .in('id', participantIds);
      (parts || []).forEach((p: any) => currentWorkerByParticipant.set(p.id, p.assigned_worker || null));
    }

    const effectiveWorker = (a: any): string | null =>
      currentWorkerByParticipant.get(a.participant_id) || a.assigned_to || null;

    const ids = Array.from(
      new Set([
        ...open.map((a) => a.participant_id),
        ...open.map((a) => effectiveWorker(a)).filter(Boolean),
      ])
    ).filter((id) => isUuid(id));

    const nameById = new Map<string, string>();
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids as string[]);
      (profiles || []).forEach((p: any) => nameById.set(p.id, p.name));
    }

    res.json(
      open.map((a) => {
        const w = effectiveWorker(a);
        return {
          id: a.id,
          participantId: a.participant_id,
          participantName: nameById.get(a.participant_id) || a.participant_id,
          severity: a.severity,
          category: a.category,
          title: a.title,
          reason: a.reason,
          status: a.status,
          score: a.score,
          assignedWorkerName: w ? nameById.get(w) || (isUuid(w) ? 'Assigned' : w) : null,
          createdAt: a.created_at,
        };
      })
    );
  } catch (err: any) {
    console.error('[AURA Admin] escalations error:', err);
    res.status(500).json({ detail: err.message || 'Failed to load escalations' });
  }
});

// ---------------------------------------------------------------------------
// District / State / national oversight
//
// De-identified by construction: jurisdictionAggregates.ts decides what may
// leave the server (counts, risk bands, response-time status, and at district
// level high-risk cases by case reference only). No route here returns a
// participant's name, contact details or anything they wrote.
// ---------------------------------------------------------------------------

const setupError = (res: Response, err: any) =>
  err instanceof JurisdictionSetupError
    ? res.status(503).json({ detail: err.message, setupRequired: true })
    : null;

const cleanField = (value: unknown, max: number): string =>
  typeof value === 'string' ? cleanArea(value).slice(0, max) : '';

router.get('/jurisdictions', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const state = cleanField(req.query.state, 120) || undefined;
    const district = state ? cleanField(req.query.district, 120) || undefined : undefined;
    const view = await getJurisdictionView(state, district);
    let officer = null;
    if (view.level === 'district') {
      const officers = await listDistrictOfficers();
      officer =
        officers.find((o) => areaKey(o.state) === areaKey(state) && areaKey(o.district) === areaKey(district)) || null;
    }
    res.json({ ...view, officer });
  } catch (err: any) {
    if (setupError(res, err)) return;
    console.error('[AURA Admin] jurisdictions error:', err);
    res.status(500).json({ detail: err.message || 'Failed to load the jurisdiction view' });
  }
});

router.get('/district-officers', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    res.json(await listDistrictOfficers());
  } catch (err: any) {
    if (setupError(res, err)) return;
    res.status(500).json({ detail: err.message || 'Failed to load district officers' });
  }
});

/** Adds the officer for a district, or replaces the one already on file. */
router.post('/district-officers', requireAdmin, async (req: AdminRequest, res: Response) => {
  const state = cleanField(req.body?.state, 120);
  const district = cleanField(req.body?.district, 120);
  const officerName = cleanField(req.body?.officerName, 120);
  const designation = cleanField(req.body?.designation, 120) || null;
  const email = cleanField(req.body?.email, 200).toLowerCase();
  const phone = cleanField(req.body?.phone, 40) || null;

  if (!state || !district || !officerName) {
    return res.status(400).json({ detail: 'State, district and officer name are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ detail: 'A valid email address is required.' });
  }

  try {
    const supabase = getAdminSupabase();
    const existing = (await listDistrictOfficers()).find(
      (o) => areaKey(o.state) === areaKey(state) && areaKey(o.district) === areaKey(district)
    );
    const row = {
      state,
      district,
      officer_name: officerName,
      designation,
      email,
      phone,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from('district_officers').update(row).eq('id', existing.id)
      : await supabase.from('district_officers').insert(row);
    if (error) return res.status(500).json({ detail: error.message });

    await logAdminAudit(
      existing ? 'UPDATE_DISTRICT_OFFICER' : 'ADD_DISTRICT_OFFICER',
      `${existing ? 'Updated' : 'Added'} the district officer for ${district}, ${state}.`,
      { state, district }
    );
    res.json(await listDistrictOfficers());
  } catch (err: any) {
    if (setupError(res, err)) return;
    res.status(500).json({ detail: err.message || 'Failed to save the district officer' });
  }
});

router.delete('/district-officers/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ detail: 'Invalid officer id.' });
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from('district_officers').delete().eq('id', id).select('state, district');
    if (error) return res.status(500).json({ detail: error.message });
    const removed = (data || [])[0];
    if (removed) {
      await logAdminAudit('REMOVE_DISTRICT_OFFICER', `Removed the district officer for ${removed.district}, ${removed.state}.`, {
        state: removed.state,
        district: removed.district,
      });
    }
    res.json(await listDistrictOfficers());
  } catch (err: any) {
    if (setupError(res, err)) return;
    res.status(500).json({ detail: err.message || 'Failed to remove the district officer' });
  }
});

/** Sends pending de-identified notices now, instead of waiting for the daily sweep. */
router.post('/jurisdictions/notify', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const result = await notifyDistrictOfficers({ dryRun: req.body?.dryRun === true });
    await logAdminAudit(
      'NOTIFY_DISTRICT_OFFICERS',
      `District officer notices: ${result.notified} sent, ${result.alertsMarked} alerts covered${result.note ? ` (${result.note})` : ''}.`,
      { notified: result.notified, alertsMarked: result.alertsMarked, withoutOfficer: result.withoutOfficer.length }
    );
    res.json(result);
  } catch (err: any) {
    if (setupError(res, err)) return;
    res.status(500).json({ detail: err.message || 'Failed to notify district officers' });
  }
});

router.get('/audit-log', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    let query = supabase.from('audit_logs').select('*').order('occurred_at', { ascending: false }).limit(200);
    if (req.query.category) query = query.eq('category', String(req.query.category));
    const { data, error } = await query;
    if (error) return res.status(500).json({ detail: error.message });
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to load audit log' });
  }
});

router.get('/settings/max-caseload', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'max_caseload_default').maybeSingle();
    res.json({ maxCaseload: Number(data?.value ?? 15) });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to load setting' });
  }
});

router.put('/settings/max-caseload', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { maxCaseload } = req.body || {};
  if (!Number.isFinite(maxCaseload) || maxCaseload < 1) {
    return res.status(400).json({ detail: 'maxCaseload must be a positive number.' });
  }
  try {
    const supabase = getAdminSupabase();
    await supabase
      .from('app_settings')
      .upsert({ key: 'max_caseload_default', value: maxCaseload, updated_at: new Date().toISOString() });
    await logAdminAudit('UPDATE_MAX_CASELOAD', `Set default max caseload to ${maxCaseload}.`, { maxCaseload });
    res.json({ success: true, maxCaseload });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to update setting' });
  }
});

// ---------------------------------------------------------------------------
// AI alert-threshold configuration (sensitivity tuning).
// The tunable keys map 1:1 onto src/services/alertConfig.ts. Only a bounded
// allowlist is accepted so the admin can never inject arbitrary config.
// ---------------------------------------------------------------------------
const ALERT_THRESHOLD_KEYS = [
  'MONITORING_MAX',
  'MODERATE_MAX',
  'ELEVATED_MAX',
  'ALERT_THRESHOLD',
  'HIGH_MAX',
  'VERY_HIGH_THRESHOLD',
  'SUDDEN_CHANGE_THRESHOLD',
  'PERSISTENT_INCREASE_COUNT',
  'PERSISTENT_ELEVATED_COUNT',
  'RECOVERY_DROP_THRESHOLD',
  'IMPROVEMENT_DROP_THRESHOLD',
] as const;

function sanitizeThresholds(input: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of ALERT_THRESHOLD_KEYS) {
    const v = Number(input[k]);
    if (Number.isFinite(v) && v >= 0 && v <= 100) out[k] = Math.round(v);
  }
  return out;
}

// PUBLIC read — non-sensitive tuning config the client-side alert engine
// loads at startup. No admin session required (mirrors the public
// /applications intake route above).
router.get('/config/alert-thresholds', async (_req: Request, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'alert_thresholds').maybeSingle();
    res.json({ thresholds: sanitizeThresholds(data?.value) });
  } catch (err: any) {
    res.status(200).json({ thresholds: {} }); // never block the engine on a config read
  }
});

router.get('/settings/alert-thresholds', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'alert_thresholds').maybeSingle();
    res.json({ thresholds: sanitizeThresholds(data?.value), keys: ALERT_THRESHOLD_KEYS });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to load alert thresholds' });
  }
});

router.put('/settings/alert-thresholds', requireAdmin, async (req: AdminRequest, res: Response) => {
  const clean = sanitizeThresholds(req.body?.thresholds);
  if (Object.keys(clean).length === 0) {
    return res.status(400).json({ detail: 'No valid threshold values supplied (each must be 0-100).' });
  }
  try {
    const supabase = getAdminSupabase();
    await supabase
      .from('app_settings')
      .upsert({ key: 'alert_thresholds', value: clean, updated_at: new Date().toISOString() });
    await logAdminAudit('UPDATE_ALERT_THRESHOLDS', 'Updated AI alert-threshold configuration.', clean);
    res.json({ success: true, thresholds: clean });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to update alert thresholds' });
  }
});

// ---------------------------------------------------------------------------
// AI alert-engine accuracy review (false-positive / false-negative queue).
// Lets a clinical lead mark the engine's past alerts true/false positive, or
// log a case it missed (false negative), and see a running accuracy estimate.
// ---------------------------------------------------------------------------
const FLAG_VERDICTS = ['true_positive', 'false_positive', 'false_negative', 'unclear'];

router.get('/flag-reviews', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();

    const [{ data: alerts, error: aErr }, { data: reviews, error: rErr }] = await Promise.all([
      supabase
        .from('alerts')
        .select('id, participant_id, severity, category, title, reason, status, score, created_at')
        .order('created_at', { ascending: false })
        .limit(80),
      supabase.from('ai_flag_reviews').select('*').order('reviewed_at', { ascending: false }).limit(300),
    ]);
    if (aErr) return res.status(500).json({ detail: aErr.message });
    if (rErr) return res.status(500).json({ detail: rErr.message });

    const reviewByAlert = new Map<string, any>();
    (reviews || []).forEach((r: any) => {
      if (r.alert_id && !reviewByAlert.has(r.alert_id)) reviewByAlert.set(r.alert_id, r);
    });

    const ids = Array.from(
      new Set([
        ...(alerts || []).map((a: any) => a.participant_id),
        ...(reviews || []).map((r: any) => r.participant_id),
      ])
    ).filter(isUuid);
    const nameById = new Map<string, string>();
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids);
      (profiles || []).forEach((p: any) => nameById.set(p.id, p.name));
    }

    const items = (alerts || []).map((a: any) => {
      const rev = reviewByAlert.get(a.id) || null;
      return {
        alertId: a.id,
        participantId: a.participant_id,
        participantName: nameById.get(a.participant_id) || a.participant_id,
        severity: a.severity,
        category: a.category,
        title: a.title,
        reason: a.reason,
        status: a.status,
        score: a.score,
        createdAt: a.created_at,
        verdict: rev?.verdict || null,
        reviewNote: rev?.note || null,
        reviewedAt: rev?.reviewed_at || null,
      };
    });

    // Manually logged false negatives (no alert_id).
    const missed = (reviews || [])
      .filter((r: any) => !r.alert_id && r.verdict === 'false_negative')
      .map((r: any) => ({
        id: r.id,
        participantId: r.participant_id,
        participantName: nameById.get(r.participant_id) || r.participant_id,
        note: r.note,
        reviewedAt: r.reviewed_at,
      }));

    const counts = { true_positive: 0, false_positive: 0, false_negative: 0, unclear: 0 };
    (reviews || []).forEach((r: any) => {
      if (r.verdict in counts) counts[r.verdict as keyof typeof counts]++;
    });
    const tp = counts.true_positive;
    const fp = counts.false_positive;
    const fn = counts.false_negative;
    const stats = {
      ...counts,
      reviewed: tp + fp + fn + counts.unclear,
      precision: tp + fp > 0 ? Math.round((tp / (tp + fp)) * 100) : null,
      recall: tp + fn > 0 ? Math.round((tp / (tp + fn)) * 100) : null,
    };

    res.json({ items, missed, stats, verdicts: FLAG_VERDICTS });
  } catch (err: any) {
    console.error('[AURA Admin] flag-reviews error:', err);
    res.status(500).json({ detail: err.message || 'Failed to load flag reviews' });
  }
});

router.post('/flag-reviews', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { alertId, participantId, verdict, note, flaggedScore, flaggedSeverity, originalReason } = req.body || {};
  if (!FLAG_VERDICTS.includes(verdict)) {
    return res.status(400).json({ detail: `verdict must be one of: ${FLAG_VERDICTS.join(', ')}` });
  }
  if (!participantId) {
    return res.status(400).json({ detail: 'participantId is required.' });
  }
  try {
    const supabase = getAdminSupabase();
    const id = alertId ? `rev-${alertId}` : `rev-fn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await supabase.from('ai_flag_reviews').upsert({
      id,
      alert_id: alertId || null,
      participant_id: participantId,
      flagged_score: flaggedScore ?? null,
      flagged_severity: flaggedSeverity ?? null,
      original_reason: originalReason ?? null,
      verdict,
      reviewer: 'admin',
      note: note || null,
      reviewed_at: new Date().toISOString(),
    });
    if (error) return res.status(500).json({ detail: error.message });
    await logAdminAudit(
      'REVIEW_AI_FLAG',
      `Marked ${alertId ? `alert ${alertId}` : `participant ${participantId} (missed case)`} as ${verdict}.`,
      { alertId: alertId || null, participantId, verdict }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to record review' });
  }
});

export default router;

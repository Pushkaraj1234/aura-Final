import { Router, Request, Response } from 'express';
import {
  analyzeComprehensiveCheckIn,
  analyzeReflection,
  analyzeVoiceTone,
  generateCaseSummary,
  handleChat,
  AcousticFeatures,
} from './aiService.js';
import { predictFutureRisk, ML_MODEL_METADATA } from './predictiveModel.js';
import { getSupabaseForRequest } from './supabaseServer.js';
import { runEscalationSweep } from './escalationSweep.js';
import {
  BHASHINI_LANGUAGES,
  bhashiniConfigSummary,
  isBhashiniConfigured,
  resetBhashiniCache,
  translateBatch,
} from './bhashiniService.js';

const router = Router();

// ---------------------------------------------------------
// Health check
// ---------------------------------------------------------
router.get('/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', service: 'aura-api', persistence: 'supabase-postgres' })
);

// ---------------------------------------------------------
// Scheduled escalation sweep
//
// Called by Vercel Cron (see vercel.json). Until this existed, escalations
// were only computed while a counsellor had the dashboard open — which is
// the same periodic check-in the problem describes, wearing different
// clothes. This evaluates every case on a schedule and emails the assigned
// counsellor when one needs attention inside 24 or 72 hours.
// ---------------------------------------------------------

/**
 * Authorises the sweep.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without a secret
 * set the route is refused outright rather than left open: it reads every
 * participant's record, so an unauthenticated caller must never reach it.
 */
function cronAuthorised(req: Request): { ok: boolean; detail?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, detail: 'CRON_SECRET is not configured, so the sweep is disabled.' };
  }
  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : String(req.query.key || '');
  if (provided !== secret) return { ok: false, detail: 'Not authorised.' };
  return { ok: true };
}

router.all('/cron/escalations', async (req: Request, res: Response) => {
  const auth = cronAuthorised(req);
  if (!auth.ok) return res.status(401).json({ detail: auth.detail });

  try {
    // `?dry=1` evaluates without emailing, so the schedule can be verified
    // against real data without paging anyone.
    const notify = req.query.dry !== '1';
    const result = await runEscalationSweep({ notify });
    res.json({ status: 'ok', notify, ...result });
  } catch (err: any) {
    console.warn('[AURA] escalation sweep failed:', err?.message || err);
    res.status(500).json({ detail: err?.message || 'Escalation sweep failed.' });
  }
});

// ---------------------------------------------------------
// Translation (Bhashini / MeitY)
//
// The credentials stay here for the same reason GEMINI_API_KEY does: nothing
// that authorises a paid or rate-limited service belongs in a bundle anyone
// can read. The client sends phrases and gets phrases back.
// ---------------------------------------------------------

/** The languages the picker offers. Static, so it costs nothing to serve. */
router.get('/translate/languages', (_req: Request, res: Response) =>
  res.json({ languages: BHASHINI_LANGUAGES, configured: isBhashiniConfigured() })
);

/**
 * Reports whether translation is wired up, without revealing any key.
 *
 * This exists because the deployed environment is the only place the
 * credentials are real: a translation that silently falls back to English
 * looks identical to one that was never configured, and this is how you tell
 * the two apart from outside the server.
 */
router.get('/translate/status', async (req: Request, res: Response) => {
  const summary = bhashiniConfigSummary();
  if (req.query.probe !== '1' || !summary.configured) {
    return res.json({ ...summary, probed: false });
  }

  // A single short round trip through the real pipeline, so the answer
  // reflects the credentials rather than just their presence.
  if (req.query.fresh === '1') resetBhashiniCache();
  const probe = await translateBatch(['Hello'], String(req.query.lang || 'hi'));
  res.json({
    ...summary,
    probed: true,
    reachable: !probe.degraded,
    via: probe.via,
    sample: probe.degraded ? null : probe.translations[0],
    reason: probe.reason,
  });
});

/**
 * Translates a batch of interface strings.
 *
 * Never fails the request on an upstream problem — it answers with the
 * original English and `degraded: true`, because a person mid-check-in needs
 * a screen they can read far more than they need an accurate error.
 */
router.post('/translate', async (req: Request, res: Response) => {
  const { texts, target, source } = req.body || {};

  if (!Array.isArray(texts)) {
    return res.status(400).json({ detail: '"texts" must be an array of strings.' });
  }
  if (texts.length > 500) {
    return res.status(400).json({ detail: 'Send at most 500 strings per request.' });
  }
  if (typeof target !== 'string' || !target) {
    return res.status(400).json({ detail: '"target" language code is required.' });
  }

  try {
    const result = await translateBatch(
      texts.map((t: unknown) => (typeof t === 'string' ? t : '')),
      target,
      typeof source === 'string' && source ? source : 'en'
    );
    if (result.degraded) {
      console.warn('[AURA] translation degraded:', result.reason);
    }
    res.json(result);
  } catch (err: any) {
    console.warn('[AURA] translation failed:', err?.message || err);
    res.json({
      translations: texts.map((t: unknown) => (typeof t === 'string' ? t : '')),
      degraded: true,
      reason: err?.message || 'Translation service unavailable.',
    });
  }
});

// ---------------------------------------------------------
// AI Endpoints (Gemini)
// All domain data (participants, check-ins, alerts, etc.) is read/written
// directly from the frontend against Supabase, protected by row-level
// security. This server only exists to keep the GEMINI_API_KEY off the client.
// ---------------------------------------------------------

async function logAiAudit(
  req: Request,
  action: string,
  description: string,
  participantId?: string
) {
  try {
    const supabase = getSupabaseForRequest(req);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    await supabase.from('audit_logs').insert({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actor_id: user?.id || 'system',
      actor_role: (user?.user_metadata as any)?.role || 'system',
      actor_name: (user?.user_metadata as any)?.name || 'AURA AI Engine',
      action,
      category: 'ai_evaluation',
      participant_id: participantId,
      description,
      severity: 'INFO',
    });
  } catch (err) {
    // Audit logging must never break the primary request.
    console.warn('[AURA] audit log write skipped:', (err as any)?.message);
  }
}

router.post('/ai/comprehensive-analysis', async (req: Request, res: Response) => {
  const { checkInData, transcript } = req.body || {};
  if (!checkInData) {
    return res.status(400).json({ detail: 'Check-in data is required' });
  }

  try {
    const analysis = await analyzeComprehensiveCheckIn(checkInData, transcript || '');
    res.json(analysis);
  } catch (error: any) {
    console.error('Comprehensive analysis error:', error);
    res.status(500).json({ detail: error.message || 'Analysis failed' });
  }
});

router.post('/ai/analyze-reflection', async (req: Request, res: Response) => {
  const { text, participantId } = req.body || {};
  if (!text) {
    return res.status(400).json({ detail: 'Text is required for analysis' });
  }

  try {
    const analysis = await analyzeReflection(text);
    await logAiAudit(
      req,
      'ANALYZE_REFLECTION',
      'Used Gemini to screen a text reflection for trauma indicators and distress signals.',
      participantId
    );
    res.json(analysis);
  } catch (error: any) {
    console.error('Error analyzing reflection:', error);
    res.status(500).json({ detail: error.message || 'Failed to analyze text' });
  }
});

router.post('/ai/analyze-voice-tone', async (req: Request, res: Response) => {
  const { transcript, acousticFeatures, participantId } = req.body || {};
  const features: AcousticFeatures | undefined = acousticFeatures;

  if (!features || typeof features.durationSeconds !== 'number') {
    return res.status(400).json({ detail: 'acousticFeatures (from the recorded audio) is required' });
  }

  try {
    const analysis = await analyzeVoiceTone(transcript || '', features);
    await logAiAudit(
      req,
      'ANALYZE_VOICE_TONE',
      'Used Gemini to infer emotional tone from voice-reflection transcript + vocal delivery features (pitch/pace/pauses/energy).',
      participantId
    );
    res.json(analysis);
  } catch (error: any) {
    console.error('Error analyzing voice tone:', error);
    res.status(500).json({ detail: error.message || 'Failed to analyze voice tone' });
  }
});

router.post('/ai/summarize-case', async (req: Request, res: Response) => {
  const { participant_id } = req.body || {};
  if (!participant_id) {
    return res.status(400).json({ detail: 'Participant ID is required' });
  }

  try {
    const supabase = getSupabaseForRequest(req);
    const { data: participant, error: pErr } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participant_id)
      .maybeSingle();

    if (pErr || !participant) {
      return res.status(404).json({ detail: 'Participant not found' });
    }

    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('*')
      .eq('participant_id', participant_id)
      .order('occurred_at', { ascending: false })
      .limit(10);

    const summary = await generateCaseSummary(participant, checkIns || []);

    await logAiAudit(req, 'GENERATE_CASE_SUMMARY', 'Generated worker case summary via Gemini.', participant_id);

    res.json({ summary });
  } catch (error: any) {
    console.error('Error summarizing case:', error);
    res.status(500).json({ detail: error.message || 'Failed to generate summary' });
  }
});

router.post('/chat', async (req: Request, res: Response) => {
  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ detail: 'Messages array is required' });
  }

  try {
    const reply = await handleChat(messages);
    res.json({ reply });
  } catch (error: any) {
    console.error('Error generating chat reply:', error);
    res.status(500).json({ detail: error.message || 'Failed to generate chat reply' });
  }
});

// ---------------------------------------------------------
// ML Endpoint (deterministic trajectory/risk model — reads history from Supabase)
// ---------------------------------------------------------
router.get('/ml/predict/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;

  try {
    const supabase = getSupabaseForRequest(req);
    const { data: checkIns, error } = await supabase
      .from('check_ins')
      .select('*')
      .eq('participant_id', participantId)
      .order('occurred_at', { ascending: true });

    if (error) {
      return res.status(403).json({ detail: error.message });
    }

    // predictiveModel expects camelCase-ish `timestamp`; check_ins uses occurred_at.
    const normalized = (checkIns || []).map((c) => ({ ...c, timestamp: c.occurred_at }));
    const prediction = predictFutureRisk(participantId, normalized);

    await supabase.from('risk_history').insert({
      id: `rh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      participant_id: participantId,
      score: Math.round(prediction.probability * 100),
      level: prediction.riskCategory,
      source: 'ml_prediction',
    });

    await logAiAudit(
      req,
      'GENERATE_RISK_PREDICTION',
      `Generated risk assessment with ${prediction.confidence} confidence.`,
      participantId
    );

    res.json({ prediction, metadata: ML_MODEL_METADATA });
  } catch (err: any) {
    console.error('Prediction error:', err);
    res.status(500).json({ detail: 'Error generating prediction' });
  }
});

export default router;

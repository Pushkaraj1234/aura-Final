import { Router, Request, Response } from 'express';
import {
  analyzeComprehensiveCheckIn,
  analyzeReflection,
  analyzeVoiceTone,
  generateCaseSummary,
  handleChat,
  AcousticFeatures,
} from './aiService.js';
import {
  crisisAlertAction,
  crisisAlertReason,
  crisisResponse,
  detectCrisis,
  screenAssistantReply,
  type CrisisTier,
} from './crisisDetection.js';
import { detectAtrocityExposure } from '../src/services/atrocityLexicon.js';
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
// Called by Vercel Cron (see vercel.json — daily at 03:00 UTC, because the
// Hobby plan refuses any cron running more than once a day and fails the
// deployment rather than degrading; every six hours is right on Pro).
// Until this existed, escalations
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
  participantId?: string,
  options: { category?: string; severity?: 'INFO' | 'WARNING' | 'HIGH' } = {}
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
      category: options.category || 'ai_evaluation',
      participant_id: participantId,
      description,
      severity: options.severity || 'INFO',
    });
  } catch (err) {
    // Audit logging must never break the primary request.
    console.warn('[AURA] audit log write skipped:', (err as any)?.message);
  }
}

/**
 * Raises the alert behind a crisis reply, and reports whether it landed.
 *
 * The return value is load-bearing rather than informational: the person is
 * only told a counsellor has been notified when a row was actually written.
 * Row-level security is what decides that, not this code — the alerts insert
 * policy allows a participant to raise an alert only about themselves, so a
 * client sending someone else's id gets rejected by Postgres and the person
 * correctly reads the copy that promises nothing.
 */
async function raiseCrisisAlert(
  req: Request,
  participantId: string | undefined,
  tier: CrisisTier
): Promise<boolean> {
  if (!participantId) return false;
  try {
    const supabase = getSupabaseForRequest(req);
    const { error } = await supabase.from('alerts').insert({
      id: `ALT-CRISIS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      participant_id: participantId,
      category: 'SAFETY_CONCERN',
      severity: 'RED',
      title: 'Crisis language in the assistant chat',
      reason: crisisAlertReason(tier),
      // Deliberately not the person's words. Staff can read alert rows, and a
      // verbatim crisis sentence stored here would be readable by everyone
      // with caseload access forever. What they need to act is the tier.
      description:
        'The assistant stopped replying and showed crisis resources. The message itself is not stored.',
      recommended_action: crisisAlertAction(tier),
      status: 'NEW',
      score: 100,
      requires_human_review: true,
      contributing_factors: [],
    });
    if (error) {
      console.warn('[AURA] crisis alert insert rejected:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[AURA] crisis alert insert failed:', (err as any)?.message);
    return false;
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

    // Described atrocity exposure, read deterministically rather than asked of
    // the model. Two reasons it is not left to Gemini: a lexicon cannot be
    // unavailable, rate-limited or differently-moody between two check-ins,
    // and a counsellor can read the phrase that matched and disagree with it.
    //
    // It is returned alongside the analysis, never merged into it, because
    // exposure and symptom state are different quantities. Folding what
    // happened to someone into how distressed they are would mean a survivor
    // who mentions a boycott calmly scores worse than one who does not
    // mention it, which measures nothing.
    const exposure = detectAtrocityExposure(text);

    await logAiAudit(
      req,
      'ANALYZE_REFLECTION',
      'Used Gemini to screen a text reflection for trauma indicators and distress signals.' +
        (exposure.signals.length > 0
          ? ` Lexicon additionally described ${exposure.signals.length} atrocity exposure categor${exposure.signals.length === 1 ? 'y' : 'ies'}.`
          : ''),
      participantId
    );
    res.json({ ...analysis, atrocityExposure: exposure });
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

/**
 * The assistant chat, with a crisis gate in front of the model.
 *
 * Order matters here. The gate runs before the model is called, not after,
 * so that a person disclosing suicidal intent is never answered by a
 * generative model on a best-effort basis. Gemini's own guardrails may well
 * handle it; they are not a safety layer this product controls, they fail
 * silently, and they raise no alert and write no audit record.
 *
 * On a hit the endpoint still returns 200 with a reply. A 4xx would surface
 * in the chat window as "Sorry, I encountered an error", which is the worst
 * possible answer to what the person just said.
 */
router.post('/chat', async (req: Request, res: Response) => {
  const { messages, participantId, language } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ detail: 'Messages array is required' });
  }

  // Only the newest message from the person. Rescanning the whole thread
  // would re-fire on every subsequent turn of a conversation that already
  // got resources, and would also scan the assistant's own crisis reply.
  const lastUserMessage = [...messages]
    .reverse()
    .find((m: any) => m?.role === 'user' && typeof m?.content === 'string');
  const inbound = detectCrisis(lastUserMessage?.content || '');

  if (inbound.triggered && inbound.tier) {
    const notified = await raiseCrisisAlert(req, participantId, inbound.tier);
    await logAiAudit(
      req,
      'CHAT_CRISIS_INTERCEPT',
      `Crisis language (${inbound.tier}) detected in assistant chat. Model call skipped, ` +
        `crisis resources returned, alert ${notified ? 'raised' : 'not raised (no participant context)'}.`,
      participantId,
      { category: 'SAFETY', severity: 'HIGH' }
    );
    return res.json({
      reply: crisisResponse(language, notified),
      crisis: { tier: inbound.tier, counsellorNotified: notified },
    });
  }

  try {
    const reply = await handleChat(messages);

    // Defence in depth. The gate above means a flagged message never reaches
    // the model, so this only catches the model volunteering means or method
    // in answer to something that read as ordinary.
    const outbound = screenAssistantReply(reply);
    if (outbound.triggered) {
      const notified = await raiseCrisisAlert(req, participantId, 'self_harm');
      await logAiAudit(
        req,
        'CHAT_UNSAFE_REPLY_SUPPRESSED',
        'Model reply matched an unsafe-content pattern and was replaced with crisis resources.',
        participantId,
        { category: 'SAFETY', severity: 'HIGH' }
      );
      return res.json({
        reply: crisisResponse(language, notified),
        crisis: { tier: 'self_harm', counsellorNotified: notified },
      });
    }

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

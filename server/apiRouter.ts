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

const router = Router();

// ---------------------------------------------------------
// Health check
// ---------------------------------------------------------
router.get('/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', service: 'aura-api', persistence: 'supabase-postgres' })
);

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

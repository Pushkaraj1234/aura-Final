import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getAdminSupabase } from './adminSupabase.js';
import {
  GUARDIAN_QUESTIONS,
  guardianFallbackSummary,
  summariseGuardianAnswers,
} from '../src/services/guardianQuestions.js';

/**
 * The guardian questionnaire, reached without an account.
 *
 * Everything here is unauthenticated, so the token in the link is the only
 * thing standing between a stranger and a form about someone's mental health.
 * That shapes the whole file:
 *
 *   - the token is compared by SHA-256 hash, and only the hash is stored, so a
 *     leaked database does not yield working links;
 *   - a link is single-use and expires, so one forwarded message does not grant
 *     indefinite access;
 *   - the form reveals no participant name. Whoever holds the link learns only
 *     that someone asked them to answer five questions. The counsellor tells
 *     the guardian who it is about when they hand over the link, through a
 *     channel they already trust.
 *
 * The service role is used because there is no session to run RLS against. It
 * is confined to this file's two routes, each of which is reachable only with a
 * valid unspent token.
 */

const router = Router();

const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 14;

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const newToken = (): string => crypto.randomBytes(TOKEN_BYTES).toString('base64url');

/**
 * Resolves a token to its assessment, or explains why it will not open.
 *
 * getAdminSupabase() throws when the service-role key is missing, and this is
 * an unauthenticated route: an uncaught throw here takes the whole API down for
 * everyone, which is a far worse outcome than one guardian seeing an error. So
 * every failure becomes a message.
 */
async function findByToken(token: string) {
  if (!token || token.length < 20) return { row: null, reason: 'This link is not valid.' };

  let supabase;
  try {
    supabase = getAdminSupabase();
  } catch (err: any) {
    console.error('[AURA Guardian] server not configured:', err?.message || err);
    return { row: null, reason: 'This form is unavailable right now. Please try again later.' };
  }

  const { data, error } = await supabase
    .from('guardian_assessments')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (error) return { row: null, reason: 'We could not open this form just now.' };
  if (!data) return { row: null, reason: 'This link is not valid.' };
  if (data.status === 'revoked') return { row: null, reason: 'This link has been withdrawn.' };
  if (data.status === 'submitted') return { row: null, reason: 'This form has already been completed. Thank you.' };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { row: null, reason: 'This link has expired. Ask for a new one.' };
  }
  return { row: data, reason: null };
}

/**
 * The blank form.
 *
 * Returns the questions and nothing else. In particular it does not return the
 * participant's name, id, or anything about their care — a link that went to
 * the wrong person should not tell that person who is being treated.
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { row, reason } = await findByToken(String(req.params.token || ''));
    if (!row) return res.status(404).json({ detail: reason });
    res.json({ questions: GUARDIAN_QUESTIONS, expiresAt: row.expires_at });
  } catch (err: any) {
    console.error('[AURA Guardian] open failed:', err?.message || err);
    res.status(500).json({ detail: 'We could not open this form just now.' });
  }
});

/**
 * Submission. Spends the link, stores the answers, and summarises them.
 *
 * The concern level is computed from the answers by the same arithmetic the
 * frontend could run — the model is asked only for a sentence of prose, and its
 * absence degrades the summary rather than failing the submission. A guardian
 * who has just filled this in should never lose their answers because an
 * external API was down.
 */
router.post('/:token', async (req: Request, res: Response) => {
  try {
  const token = String(req.params.token || '');
  const { row, reason } = await findByToken(token);
  if (!row) return res.status(404).json({ detail: reason });

  const submitted = Array.isArray(req.body?.answers) ? req.body.answers : null;
  if (!submitted) return res.status(400).json({ detail: 'Answers are required.' });

  // Only recognised questions and recognised options are stored. Anything else
  // is discarded rather than written through to the counsellor's screen.
  const answers = submitted
    .map((a: any) => {
      const q = GUARDIAN_QUESTIONS.find((x) => x.id === a?.questionId);
      if (!q) return null;
      const opt = q.options.find((o) => o.label === a?.value);
      return opt ? { questionId: q.id, value: opt.label } : null;
    })
    .filter(Boolean) as Array<{ questionId: string; value: string }>;

  if (!answers.length) return res.status(400).json({ detail: 'No recognised answers were submitted.' });

  const { concern } = summariseGuardianAnswers(answers);
  let summary = guardianFallbackSummary(answers);

  if (process.env.GEMINI_API_KEY) {
    try {
      const { summariseGuardianReport } = await import('./aiService.js');
      const prose = await summariseGuardianReport(answers, concern);
      if (prose) summary = prose;
    } catch (err: any) {
      // Keep the computed summary. The answers are what matter, and they are
      // about to be saved either way.
      console.warn('[AURA Guardian] summary unavailable:', err?.message || err);
    }
  }

  let supabase;
  try {
    supabase = getAdminSupabase();
  } catch (err: any) {
    console.error('[AURA Guardian] server not configured:', err?.message || err);
    return res.status(503).json({ detail: 'We could not save your answers just now. Please try again later.' });
  }

  const { error } = await supabase
    .from('guardian_assessments')
    .update({
      answers,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      concern_level: concern,
      ai_summary: summary.slice(0, 800),
      summarised_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'sent');

  if (error) return res.status(500).json({ detail: 'We could not save your answers. Please try again.' });
  res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[AURA Guardian] submit failed:', err?.message || err);
    res.status(500).json({ detail: 'We could not save your answers. Please try again.' });
  }
});

export default router;

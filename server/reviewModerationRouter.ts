import { Router, Response } from 'express';
import { requireAdmin, AdminRequest } from './adminAuth.js';
import { getAdminSupabase } from './adminSupabase.js';

/**
 * Review moderation for the admin portal.
 *
 * Mounted as a new route group. Nothing in the existing admin router is
 * touched, and no existing admin permission changes.
 *
 * One deliberate omission: reviewer_id is never returned, not even here. The
 * admin portal is built so that an administrator cannot see who said what about
 * their own care, and a moderation queue that revealed the author would quietly
 * undo that. Moderation needs the text, not the name. The column still exists
 * on the row for abuse handling, and reaching it is a database operation with
 * an audit trail rather than a screen someone can browse.
 */

const router = Router();

/**
 * Words and shapes that usually mean a review has drifted from "how was this
 * counsellor" into the reviewer's own medical or identifying detail.
 *
 * This only ever raises a flag for a human to look at. It never rejects on its
 * own: a false positive that auto-rejected someone's review would silently
 * discard feedback they took the trouble to write.
 */
const SENSITIVE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'phone number', re: /(?:\+?\d[\s-]?){9,}/ },
  { label: 'email address', re: /[^\s@]+@[^\s@]+\.[^\s@]+/ },
  { label: 'diagnosis or medication', re: /\b(diagnos\w*|prescrib\w*|medication|antidepress\w*|sertraline|fluoxetine|dosage|mg\b)/i },
  { label: 'self-harm or crisis detail', re: /\b(suicid\w*|self[-\s]?harm|overdose)\b/i },
  { label: 'case or complaint number', re: /\b(?:fir|case|complaint)\s*(?:no\.?|number|#)?\s*[\w/-]{4,}/i },
  { label: 'a named person', re: /\b(?:dr|mr|mrs|ms|shri|smt)\.?\s+[A-Z][a-z]+/ },
];

function flagsFor(body: string | null | undefined): string[] {
  if (!body) return [];
  return SENSITIVE_PATTERNS.filter((p) => p.re.test(body)).map((p) => p.label);
}

/** Pending reviews, newest last, with automated flags for the moderator. */
router.get('/pending', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('counsellor_reviews')
      .select('id, worker_id, rating, body, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ detail: error.message });

    const workerIds = Array.from(new Set((data || []).map((r: any) => r.worker_id)));
    const { data: profiles } = workerIds.length
      ? await supabase.from('profiles').select('id, name').in('id', workerIds)
      : { data: [] as any[] };
    const nameById = new Map((profiles || []).map((p: any) => [p.id, p.name]));

    res.json(
      (data || []).map((r: any) => ({
        id: r.id,
        workerId: r.worker_id,
        workerName: nameById.get(r.worker_id) || 'Unknown counsellor',
        rating: r.rating,
        body: r.body,
        createdAt: r.created_at,
        flags: flagsFor(r.body),
      }))
    );
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to load pending reviews' });
  }
});

/** How many are waiting, for a badge on the admin dashboard. */
router.get('/pending/count', requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const supabase = getAdminSupabase();
    const { count, error } = await supabase
      .from('counsellor_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) return res.status(500).json({ detail: error.message });
    res.json({ pending: count ?? 0 });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to count pending reviews' });
  }
});

/**
 * Publish or reject. A moderator may also publish an edited body — a review
 * that names a doctor is usually worth keeping once the name is removed, and
 * throwing it away instead loses real feedback.
 */
router.post('/:id/decide', requireAdmin, async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  const { decision, note, editedBody } = req.body || {};

  if (decision !== 'publish' && decision !== 'reject') {
    return res.status(400).json({ detail: "decision must be 'publish' or 'reject'." });
  }
  if (typeof editedBody === 'string' && editedBody.length > 600) {
    return res.status(400).json({ detail: 'Review text cannot exceed 600 characters.' });
  }

  try {
    const supabase = getAdminSupabase();
    const payload: Record<string, unknown> = {
      status: decision === 'publish' ? 'published' : 'rejected',
      moderation_note: typeof note === 'string' && note.trim() ? note.trim() : null,
      moderated_at: new Date().toISOString(),
    };
    if (decision === 'publish' && typeof editedBody === 'string') {
      payload.body = editedBody.trim() || null;
    }

    const { error } = await supabase
      .from('counsellor_reviews')
      .update(payload)
      .eq('id', id)
      .eq('status', 'pending');
    if (error) return res.status(500).json({ detail: error.message });

    res.json({ status: 'ok', decision });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to moderate review' });
  }
});

export default router;

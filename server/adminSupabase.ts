import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client, used ONLY by admin routes (mounted behind
 * requireAdmin — see adminAuth.ts). This bypasses Row Level Security
 * entirely, which is necessary because an admin session is a standalone
 * passcode-issued JWT, not a Supabase Auth session — there is no auth.uid()
 * for RLS policies like is_staff() to check. Every route that uses this
 * client MUST be behind requireAdmin; never import this into a route that
 * isn't.
 *
 * SUPABASE_SERVICE_ROLE_KEY must be set in the server environment (Supabase
 * dashboard -> Project Settings -> API -> service_role key). It is never
 * logged, returned to a client, or given a fallback value here — if it's
 * missing, admin routes that need it fail loudly instead of silently
 * degrading to the anon key (which would just get RLS-denied everywhere).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wtkhcndftvsiaxstspsp.supabase.co';

export function getAdminSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Admin actions cannot run without it.'
    );
  }
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

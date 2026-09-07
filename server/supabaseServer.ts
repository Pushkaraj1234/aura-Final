import { createClient } from "@supabase/supabase-js";
import { Request } from "express";

// Server-side Supabase access. We deliberately do NOT use a service-role key here:
// every request builds a client authenticated as the calling user (their Supabase
// access token, forwarded from the frontend's Authorization header), so Postgres
// row-level security applies exactly as it does for direct client access. A
// counselor's token can read across participants (per the RLS policies);
// a participant's token is restricted to their own rows.

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://wtkhcndftvsiaxstspsp.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_pAO38QpFGfuP_d17dYn5eA_CsUJXfz1";

export function getSupabaseForRequest(req: Request) {
  const authHeader = req.headers["authorization"];
  const token = typeof authHeader === "string" ? authHeader.split(" ")[1] : undefined;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

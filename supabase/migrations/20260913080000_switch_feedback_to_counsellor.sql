-- The counsellor who was left can read what was written about them.
--
-- This reverses the routing chosen in 20260912210000. That migration sent exit
-- notes to the service only, reasoning that a counsellor with a small caseload
-- can work out who left. The project owner's call is that the note's whole
-- value is helping that counsellor improve, which does not happen if they never
-- read it. Implemented as asked.
--
-- What does not change: the writer's identity. participant_id is not in the
-- view, no timestamp finer than a month is, and there is no column a counsellor
-- could join back to a person. That mirrors counsellor_reviews_public, where
-- the date is coarsened to a month for exactly this reason — an exact
-- timestamp hands the identity back to a counsellor who knows who they saw
-- that day.
--
-- Honest limit, recorded here rather than implied away: with a small caseload
-- this is deniability, not anonymity. A counsellor who knows one client left in
-- September can guess. The participant-facing copy says this plainly rather
-- than promising anonymity the shape of the data cannot deliver.

drop view if exists public.my_switch_feedback_received;
create view public.my_switch_feedback_received as
  select f.id,
         f.rating,
         f.body,
         -- Month, never the day. See the header.
         to_char(f.created_at, 'YYYY-MM') as received_month
  from public.counsellor_switch_feedback f
  where f.previous_worker_id = auth.uid()
    and f.status <> 'dismissed';

grant select on public.my_switch_feedback_received to authenticated;

-- The view is the only way in. The table itself still has no select policy for
-- staff, so a counsellor querying counsellor_switch_feedback directly — which
-- would return participant_id — gets nothing.

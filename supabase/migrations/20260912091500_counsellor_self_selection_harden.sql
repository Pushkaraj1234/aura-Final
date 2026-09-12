-- Follow-up to 20260912090000_counsellor_self_selection.sql, applied after the
-- Supabase security linter flagged the directory view.
--
-- The view referenced auth.users directly to drop suspended counsellors, which
-- makes it an auth.users exposure surface even though it only ever read a
-- boolean out of it. The lookup now sits behind a function that is not callable
-- from the API, so the view learns "is this account active" and nothing else.
--
-- The remaining linter ERROR on both views (security_definer_view) is
-- deliberate and is the mechanism the privacy guarantees rest on. These views
-- are a fixed projection: participants are granted the view and never the
-- underlying tables, so no future RLS mistake can widen them into exposing
-- profiles.email or counsellor_reviews.reviewer_id. Switching them to
-- security_invoker would require giving participants a SELECT policy on
-- profiles, and RLS cannot restrict columns — that would expose every
-- counsellor's email address to every signed-in user. The definer view is the
-- safer of the two, so the lint is accepted knowingly rather than silenced.
create or replace function public.worker_account_active(p_worker uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select not exists (
    select 1 from auth.users u
    where u.id = p_worker
      and u.banned_until is not null
      and u.banned_until > now()
  );
$$;

revoke all on function public.worker_account_active(uuid) from public, anon, authenticated;

-- Pinned because this runs inside CHECK constraints: a mutable search_path here
-- decides what counts as a valid tag.
create or replace function public.tags_are_known(tags text[])
returns boolean
language sql
stable
set search_path = public
as $$
  select tags is null
      or not exists (
        select 1 from unnest(tags) t
        where t not in (select tag from public.support_tags)
      );
$$;

create or replace view public.counsellor_directory as
select
  cp.worker_id,
  coalesce(nullif(cp.display_name, ''), pr.name)  as display_name,
  cp.photo_path,
  cp.bio,
  cp.specialties,
  cp.languages,
  cp.session_formats,
  cp.years_experience,
  cp.gender,
  (cp.accepting_new_clients
     and (cp.max_caseload is null or coalesce(load.current_caseload, 0) < cp.max_caseload))
                                                   as accepting_new_clients,
  coalesce(load.current_caseload, 0)               as current_caseload,
  case when agg.published_count >= 5 then round(agg.avg_rating, 2) end as rating_avg,
  case when agg.published_count >= 5 then agg.published_count end      as rating_count
from public.counsellor_profiles cp
join public.profiles pr on pr.id = cp.worker_id and pr.role = 'support_worker'
left join lateral (
  select count(*)::int as current_caseload
  from public.participants p
  where p.assigned_worker = cp.worker_id::text
) load on true
left join lateral (
  select count(*)::int as published_count, avg(r.rating)::numeric as avg_rating
  from public.counsellor_reviews r
  where r.worker_id = cp.worker_id and r.status = 'published'
) agg on true
where cp.published
  and public.worker_account_active(cp.worker_id);

revoke all on public.counsellor_directory from anon, authenticated;
grant select on public.counsellor_directory to authenticated;

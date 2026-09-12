-- ---------------------------------------------------------------------------
-- Counsellor self-selection: profiles, matching quiz, sessions, reviews.
--
-- Additive. The admin assignment path is untouched: participants.assigned_worker
-- stays the single source of truth for who is assigned, and assignment_history
-- keeps recording every change. The only thing this adds there is a second
-- legal value for assignment_history.assigned_by ('self' alongside 'admin'),
-- which needs no schema change.
--
-- Type note, because it is easy to get wrong here: participants.id is TEXT and
-- profiles.id is UUID, so participant references below are text and counsellor
-- references are uuid. participants.assigned_worker is also TEXT even though it
-- holds a uuid, which is why the backfill at the bottom guards the cast.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Vocabulary for the quiz and for counsellor tagging.
--
-- This is a closed list on purpose. The quiz must stay preference data rather
-- than clinical data, and the way that guarantee actually survives contact with
-- a future feature request is that there is nowhere to put free text.
-- ---------------------------------------------------------------------------
create table if not exists public.support_tags (
  tag         text primary key,
  label       text not null,
  sort_order  smallint not null default 100
);

insert into public.support_tags (tag, label, sort_order) values
  ('anxiety',           'Anxiety',                        10),
  ('stress',            'Stress',                         20),
  ('sleep',             'Sleep',                          30),
  ('grief',             'Grief and loss',                 40),
  ('relationships',     'Relationships',                  50),
  ('family',            'Family',                         60),
  ('academic_pressure', 'Academic pressure',              70),
  ('work_pressure',     'Work pressure',                  80),
  ('addiction',         'Addiction',                      90),
  ('discrimination',    'Discrimination and harassment', 100),
  ('legal_stress',      'Legal case stress',             110),
  ('financial_stress',  'Financial stress',              120),
  ('displacement',      'Displacement and housing',      130)
on conflict (tag) do nothing;

create or replace function public.tags_are_known(tags text[])
returns boolean language sql stable as $$
  select tags is null
      or not exists (
        select 1 from unnest(tags) t
        where t not in (select tag from public.support_tags)
      );
$$;

-- ---------------------------------------------------------------------------
-- 1. Counsellor public profile
--
-- published defaults to false: appearing in a browsable directory is something
-- a counsellor opts into, not something that happens to them when this ships.
-- gender is nullable and self-declared, so the matching filter degrades to
-- "no preference" rather than forcing anyone to state it.
-- ---------------------------------------------------------------------------
create table if not exists public.counsellor_profiles (
  worker_id             uuid primary key references public.profiles(id) on delete cascade,
  display_name          text,
  photo_path            text,
  bio                   text check (bio is null or char_length(bio) <= 600),
  specialties           text[] not null default '{}' check (public.tags_are_known(specialties)),
  languages             text[] not null default '{}',
  session_formats       text[] not null default '{}'
                          check (session_formats <@ array['video','audio','chat']::text[]),
  years_experience      smallint check (years_experience is null or years_experience between 0 and 70),
  gender                text check (gender is null or gender in ('woman','man','non_binary','prefer_not_to_say')),
  accepting_new_clients boolean not null default false,
  max_caseload          smallint check (max_caseload is null or max_caseload > 0),
  published             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists counsellor_profiles_published_idx
  on public.counsellor_profiles (published) where published;
create index if not exists counsellor_profiles_specialties_idx
  on public.counsellor_profiles using gin (specialties);
create index if not exists counsellor_profiles_languages_idx
  on public.counsellor_profiles using gin (languages);

-- ---------------------------------------------------------------------------
-- 2. Counselling sessions
--
-- Deliberately holds no notes and no clinical content — that stays in
-- support_notes. Keeping this table content-free is what lets the review system
-- verify "did this session happen" without the permission to verify ever
-- becoming permission to read what was said.
-- ---------------------------------------------------------------------------
create table if not exists public.counselling_sessions (
  id             uuid primary key default gen_random_uuid(),
  participant_id text not null references public.participants(id) on delete cascade,
  worker_id      uuid not null references public.profiles(id) on delete cascade,
  scheduled_at   timestamptz,
  held_at        timestamptz,
  status         text not null default 'scheduled'
                   check (status in ('scheduled','completed','no_show','cancelled')),
  format         text check (format is null or format in ('video','audio','chat')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- A completed session is the thing a review hangs off, so it must have a time.
  constraint counselling_sessions_completed_has_time
    check (status <> 'completed' or held_at is not null)
);

create index if not exists counselling_sessions_participant_idx
  on public.counselling_sessions (participant_id, status);
create index if not exists counselling_sessions_worker_idx
  on public.counselling_sessions (worker_id, status);

-- ---------------------------------------------------------------------------
-- 3. Matching quiz responses
--
-- Preference data only, kept in its own table, never joined into check_ins,
-- reflections or any other clinical record. Retaking inserts a new row; the
-- most recent row is the active one.
-- ---------------------------------------------------------------------------
create table if not exists public.matching_quiz_responses (
  id                  uuid primary key default gen_random_uuid(),
  participant_id      text not null references public.participants(id) on delete cascade,
  looking_for         text[] not null default '{}' check (public.tags_are_known(looking_for)),
  preferred_languages text[] not null default '{}',
  gender_preference   text not null default 'no_preference'
                        check (gender_preference in ('no_preference','woman','man','non_binary')),
  preferred_formats   text[] not null default '{}'
                        check (preferred_formats <@ array['video','audio','chat']::text[]),
  start_urgency       text not null default 'no_rush'
                        check (start_urgency in ('asap','this_week','no_rush')),
  created_at          timestamptz not null default now()
);

create index if not exists matching_quiz_responses_participant_idx
  on public.matching_quiz_responses (participant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Reviews
--
-- reviewer_id is stored (moderation and abuse handling need it) and is never
-- exposed through any view a user or counsellor can read.
-- ---------------------------------------------------------------------------
create table if not exists public.counsellor_reviews (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null unique references public.counselling_sessions(id) on delete cascade,
  worker_id       uuid not null references public.profiles(id) on delete cascade,
  reviewer_id     text not null references public.participants(id) on delete cascade,
  rating          smallint not null check (rating between 1 and 5),
  body            text check (body is null or char_length(body) <= 600),
  status          text not null default 'pending'
                    check (status in ('pending','published','rejected')),
  moderation_note text,
  moderated_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists counsellor_reviews_worker_published_idx
  on public.counsellor_reviews (worker_id) where status = 'published';
create index if not exists counsellor_reviews_moderation_idx
  on public.counsellor_reviews (status, created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- 5. Message ownership pinned at send time
--
-- Until now messages_select resolved "the assigned pair" through
-- participants.assigned_worker, which is live. That meant switching counsellor
-- handed the entire previous thread to the new counsellor. Pinning the
-- counsellor on the row makes a switch mean what a person would expect: they
-- keep their history, the previous counsellor loses access, the new one never
-- sees it.
-- ---------------------------------------------------------------------------
alter table public.messages add column if not exists worker_id uuid references public.profiles(id);

-- Backfill from the current assignment. assigned_worker is text and older demo
-- rows hold non-uuid values, so only cast what is actually a uuid.
update public.messages m
set worker_id = p.assigned_worker::uuid
from public.participants p
where p.id = m.participant_id
  and m.worker_id is null
  and p.assigned_worker ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

create index if not exists messages_worker_idx on public.messages (worker_id);

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select using (
  exists (select 1 from public.participants p
          where p.id = messages.participant_id and p.user_id = auth.uid())
  or messages.worker_id = auth.uid()
  -- Rows predating this column (and demo rows with a non-uuid assignment) keep
  -- the old behaviour rather than becoming invisible to the counsellor.
  or (messages.worker_id is null
      and exists (select 1 from public.participants p
                  where p.id = messages.participant_id
                    and p.assigned_worker = auth.uid()::text))
);

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update using (
  exists (select 1 from public.participants p
          where p.id = messages.participant_id and p.user_id = auth.uid())
  or messages.worker_id = auth.uid()
  or (messages.worker_id is null
      and exists (select 1 from public.participants p
                  where p.id = messages.participant_id
                    and p.assigned_worker = auth.uid()::text))
);

-- Sending is still restricted to the current pair: you may not write into a
-- thread you are no longer assigned to.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.participants p
              where p.id = messages.participant_id
                and (p.user_id = auth.uid() or p.assigned_worker = auth.uid()::text))
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.counsellor_profiles     enable row level security;
alter table public.counselling_sessions    enable row level security;
alter table public.matching_quiz_responses enable row level security;
alter table public.counsellor_reviews      enable row level security;
alter table public.support_tags            enable row level security;

-- The tag vocabulary is reference data; everyone signed in may read it.
drop policy if exists support_tags_read on public.support_tags;
create policy support_tags_read on public.support_tags for select using (auth.uid() is not null);

-- A counsellor owns their own profile row. Participants never read this table
-- directly — they read counsellor_directory, which exposes a fixed projection.
drop policy if exists counsellor_profiles_own_read on public.counsellor_profiles;
create policy counsellor_profiles_own_read on public.counsellor_profiles
  for select using (worker_id = auth.uid());

drop policy if exists counsellor_profiles_own_write on public.counsellor_profiles;
create policy counsellor_profiles_own_write on public.counsellor_profiles
  for insert with check (worker_id = auth.uid());

drop policy if exists counsellor_profiles_own_update on public.counsellor_profiles;
create policy counsellor_profiles_own_update on public.counsellor_profiles
  for update using (worker_id = auth.uid()) with check (worker_id = auth.uid());

-- Sessions: the counsellor who held it, and the participant it was with.
drop policy if exists counselling_sessions_read on public.counselling_sessions;
create policy counselling_sessions_read on public.counselling_sessions for select using (
  worker_id = auth.uid()
  or exists (select 1 from public.participants p
             where p.id = counselling_sessions.participant_id and p.user_id = auth.uid())
);

drop policy if exists counselling_sessions_worker_write on public.counselling_sessions;
create policy counselling_sessions_worker_write on public.counselling_sessions
  for insert with check (worker_id = auth.uid());

drop policy if exists counselling_sessions_worker_update on public.counselling_sessions;
create policy counselling_sessions_worker_update on public.counselling_sessions
  for update using (worker_id = auth.uid()) with check (worker_id = auth.uid());

-- Quiz answers belong to the person who answered them. There is deliberately
-- no staff policy here: is_staff() does not open this table, so counsellors
-- cannot read it even though they can read participants.
drop policy if exists matching_quiz_own on public.matching_quiz_responses;
create policy matching_quiz_own on public.matching_quiz_responses for all
  using (exists (select 1 from public.participants p
                 where p.id = matching_quiz_responses.participant_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.participants p
                      where p.id = matching_quiz_responses.participant_id and p.user_id = auth.uid()));

-- A participant may read their own reviews back and write one, but only for a
-- completed session that was actually theirs. The counsellor gets no policy on
-- this table at all — they read the aggregate view.
drop policy if exists counsellor_reviews_own_read on public.counsellor_reviews;
create policy counsellor_reviews_own_read on public.counsellor_reviews for select using (
  exists (select 1 from public.participants p
          where p.id = counsellor_reviews.reviewer_id and p.user_id = auth.uid())
);

drop policy if exists counsellor_reviews_insert on public.counsellor_reviews;
create policy counsellor_reviews_insert on public.counsellor_reviews for insert with check (
  status = 'pending'
  and exists (select 1 from public.participants p
              where p.id = counsellor_reviews.reviewer_id and p.user_id = auth.uid())
  and exists (select 1 from public.counselling_sessions s
              where s.id = counsellor_reviews.session_id
                and s.status = 'completed'
                and s.participant_id = counsellor_reviews.reviewer_id
                and s.worker_id = counsellor_reviews.worker_id)
);

-- ---------------------------------------------------------------------------
-- Views: where the privacy guarantees actually live
--
-- Both run with the definer's rights (the Postgres default for a view), which
-- is the point: they are a fixed, safe projection. Participants are granted the
-- view and never the underlying tables, so no policy mistake can widen them
-- into exposing profiles.email or counsellor_reviews.reviewer_id.
-- ---------------------------------------------------------------------------
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
  -- Withheld entirely below five published reviews: on a caseload this small,
  -- an average over two reviews identifies the reviewers.
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
where cp.published;
-- Suspended counsellors are filtered out by the follow-up migration, which
-- moves the Supabase Auth ban lookup behind worker_account_active().

create or replace view public.counsellor_reviews_public as
select
  r.worker_id,
  r.rating,
  r.body,
  -- Truncated to the month on purpose. Hiding the reviewer's id does nothing if
  -- an exact timestamp tells a counsellor which client they saw that day.
  date_trunc('month', r.created_at) as reviewed_month
from public.counsellor_reviews r
join public.counsellor_profiles cp on cp.worker_id = r.worker_id
where r.status = 'published'
  and (select count(*) from public.counsellor_reviews r2
       where r2.worker_id = r.worker_id and r2.status = 'published') >= 5;

revoke all on public.counsellor_directory     from anon, authenticated;
revoke all on public.counsellor_reviews_public from anon, authenticated;
grant select on public.counsellor_directory      to authenticated;
grant select on public.counsellor_reviews_public to authenticated;

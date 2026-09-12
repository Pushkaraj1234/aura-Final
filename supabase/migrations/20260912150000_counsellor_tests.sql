-- Counsellor-authored tests, assigned to one participant at a time.
--
-- The questions are the counsellor's own, so they live as JSON rather than a
-- fixed schema: a table of columns would decide in advance what a counsellor is
-- allowed to ask.
--
-- The marking is kept on the same 0-100 scale as the distress score so the two
-- can be plotted against each other, but it is never folded into that score.
-- That score is derived from the person's own answers and shown to them with
-- its full arithmetic; a counsellor's judgement is a different kind of number
-- and mixing them would make the breakdown untrue.
--
-- Applied to the Aura project on 2026-09-12. See the repository for the app
-- code that reads these tables.
create table if not exists public.counsellor_tests (
  id             uuid primary key default gen_random_uuid(),
  participant_id text not null references public.participants(id) on delete cascade,
  worker_id      uuid not null references public.profiles(id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 160),
  instructions   text check (instructions is null or char_length(instructions) <= 1000),
  questions      jsonb not null default '[]'::jsonb,
  status         text not null default 'draft'
                   check (status in ('draft','assigned','submitted','reviewed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists counsellor_tests_participant_idx
  on public.counsellor_tests (participant_id, status);
create index if not exists counsellor_tests_worker_idx
  on public.counsellor_tests (worker_id, status);

create table if not exists public.counsellor_test_responses (
  id             uuid primary key default gen_random_uuid(),
  test_id        uuid not null unique references public.counsellor_tests(id) on delete cascade,
  participant_id text not null references public.participants(id) on delete cascade,
  answers        jsonb not null default '[]'::jsonb,
  submitted_at   timestamptz,
  mark           smallint check (mark is null or mark between 0 and 100),
  review_text    text check (review_text is null or char_length(review_text) <= 2000),
  reviewed_at    timestamptz,
  reviewed_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

create index if not exists counsellor_test_responses_participant_idx
  on public.counsellor_test_responses (participant_id, reviewed_at desc);

alter table public.counsellor_tests          enable row level security;
alter table public.counsellor_test_responses enable row level security;

drop policy if exists counsellor_tests_worker_all on public.counsellor_tests;
create policy counsellor_tests_worker_all on public.counsellor_tests for all
  using (worker_id = auth.uid()) with check (worker_id = auth.uid());

-- A draft is the counsellor still writing, and should not appear on anyone
-- else's screen.
drop policy if exists counsellor_tests_participant_read on public.counsellor_tests;
create policy counsellor_tests_participant_read on public.counsellor_tests for select using (
  status <> 'draft'
  and exists (select 1 from public.participants p
              where p.id = counsellor_tests.participant_id and p.user_id = auth.uid())
);

drop policy if exists counsellor_test_responses_participant_write on public.counsellor_test_responses;
create policy counsellor_test_responses_participant_write on public.counsellor_test_responses
  for insert with check (
    mark is null and review_text is null and reviewed_at is null
    and exists (select 1 from public.participants p
                where p.id = counsellor_test_responses.participant_id and p.user_id = auth.uid())
    and exists (select 1 from public.counsellor_tests t
                where t.id = counsellor_test_responses.test_id
                  and t.participant_id = counsellor_test_responses.participant_id
                  and t.status = 'assigned')
  );

drop policy if exists counsellor_test_responses_participant_update on public.counsellor_test_responses;
create policy counsellor_test_responses_participant_update on public.counsellor_test_responses
  for update using (
    reviewed_at is null
    and exists (select 1 from public.participants p
                where p.id = counsellor_test_responses.participant_id and p.user_id = auth.uid())
  ) with check (mark is null and review_text is null and reviewed_at is null);

drop policy if exists counsellor_test_responses_participant_read on public.counsellor_test_responses;
create policy counsellor_test_responses_participant_read on public.counsellor_test_responses
  for select using (
    exists (select 1 from public.participants p
            where p.id = counsellor_test_responses.participant_id and p.user_id = auth.uid())
  );

drop policy if exists counsellor_test_responses_worker_read on public.counsellor_test_responses;
create policy counsellor_test_responses_worker_read on public.counsellor_test_responses
  for select using (
    exists (select 1 from public.counsellor_tests t
            where t.id = counsellor_test_responses.test_id and t.worker_id = auth.uid())
  );

drop policy if exists counsellor_test_responses_worker_review on public.counsellor_test_responses;
create policy counsellor_test_responses_worker_review on public.counsellor_test_responses
  for update using (
    exists (select 1 from public.counsellor_tests t
            where t.id = counsellor_test_responses.test_id and t.worker_id = auth.uid())
  ) with check (
    exists (select 1 from public.counsellor_tests t
            where t.id = counsellor_test_responses.test_id and t.worker_id = auth.uid())
  );

-- What the participant is shown of a reviewed test: the written advice, never
-- the mark. RLS cannot hide a column, so this projection does it instead.
create or replace view public.my_test_reviews as
select
  r.test_id,
  r.participant_id,
  t.title,
  r.answers,
  r.submitted_at,
  r.review_text,
  r.reviewed_at
from public.counsellor_test_responses r
join public.counsellor_tests t on t.id = r.test_id
where r.reviewed_at is not null
  and exists (select 1 from public.participants p
              where p.id = r.participant_id and p.user_id = auth.uid());

revoke all on public.my_test_reviews from anon, authenticated;
grant select on public.my_test_reviews to authenticated;

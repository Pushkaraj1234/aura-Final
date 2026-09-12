-- A short questionnaire a counsellor sends to someone close to the participant.
--
-- The guardian has no account, so the form is reached with a one-time link and
-- served by the API under the service role rather than by RLS. The token in
-- that link is therefore a credential: only its SHA-256 hash is stored, so a
-- copy of this table does not let anyone open the forms it describes.
--
-- The questions are fixed rather than counsellor-authored. They were specified
-- for this instrument, and a guardian answering a different set each time would
-- make two assessments of the same person incomparable.
--
-- Applied to the Aura project on 2026-09-12.
create table if not exists public.guardian_assessments (
  id             uuid primary key default gen_random_uuid(),
  participant_id text not null references public.participants(id) on delete cascade,
  worker_id      uuid not null references public.profiles(id) on delete cascade,
  guardian_label text not null check (char_length(guardian_label) between 1 and 120),
  token_hash     text not null unique,
  expires_at     timestamptz not null,
  status         text not null default 'sent' check (status in ('sent','submitted','revoked')),
  answers        jsonb,
  submitted_at   timestamptz,
  concern_level  text check (concern_level is null or concern_level in ('low','moderate','high')),
  ai_summary     text check (ai_summary is null or char_length(ai_summary) <= 800),
  summarised_at  timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists guardian_assessments_participant_idx
  on public.guardian_assessments (participant_id, created_at desc);
create index if not exists guardian_assessments_worker_idx
  on public.guardian_assessments (worker_id, status);

alter table public.guardian_assessments enable row level security;

drop policy if exists guardian_assessments_worker_all on public.guardian_assessments;
create policy guardian_assessments_worker_all on public.guardian_assessments for all
  using (worker_id = auth.uid()) with check (worker_id = auth.uid());

-- The participant is told that someone was asked, and who — never what they
-- said. A guardian who knew their answers would be read by the person they are
-- about would soften them; a participant who never learned it happened could
-- not object to the wrong person being asked.
drop policy if exists guardian_assessments_participant_read on public.guardian_assessments;
create policy guardian_assessments_participant_read on public.guardian_assessments for select using (
  exists (select 1 from public.participants p
          where p.id = guardian_assessments.participant_id and p.user_id = auth.uid())
);

-- Exactly what the participant is shown. RLS cannot hide a column, so the
-- answers, the summary and the concern level are omitted here instead.
create or replace view public.my_guardian_assessments as
select
  g.id,
  g.participant_id,
  g.guardian_label,
  g.status,
  g.created_at,
  g.submitted_at
from public.guardian_assessments g
where exists (select 1 from public.participants p
              where p.id = g.participant_id and p.user_id = auth.uid());

revoke all on public.my_guardian_assessments from anon, authenticated;
grant select on public.my_guardian_assessments to authenticated;

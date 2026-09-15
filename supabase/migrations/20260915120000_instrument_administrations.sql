-- Validated-instrument administrations, stored separately from AURA's score.
--
-- AURA's 0-100 distress score is auditable, which is a different and lesser
-- property than validated: its weights were chosen rather than derived, and
-- nothing here has been psychometrically tested on anybody. This table holds
-- results from instruments other people validated, so the two can be shown
-- side by side and the difference between them stays visible.
--
-- Three decisions are deliberate.
--
-- Raw item responses are stored, not only the total. A total cannot be
-- re-scored, re-checked against a corrected scoring rule, or re-analysed at
-- item level. An instrument you cannot re-score is one you are asking people
-- to take on trust, which is the thing this table exists to avoid.
--
-- Every row records the instrument version that produced it, so revising an
-- item or a scoring rule never silently reinterprets answers collected under
-- the previous one.
--
-- There is no UPDATE policy, on purpose. An administration is a measurement
-- taken at a moment. It can be superseded by a later one, never edited into a
-- different answer. check_ins allows staff updates; this does not, and the
-- absence is the point rather than an oversight.

create table if not exists public.instrument_administrations (
  id                 text primary key,
  participant_id     text not null references public.participants(id) on delete cascade,
  instrument_id      text not null,
  instrument_version smallint not null,
  -- Keyed by the instrument's stable item ids, never by position, so
  -- reordering the items in a later version cannot scramble stored answers.
  item_responses     jsonb not null,
  raw_score          smallint not null,
  scaled_score       smallint not null,
  administered_at    timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

comment on table public.instrument_administrations is
  'One completed administration of a validated instrument (currently WHO-5). Never blended into the AURA distress score: the instrument is the anchor, AURA is the trend detector, and they are reported side by side.';
comment on column public.instrument_administrations.item_responses is
  'Raw per-item responses keyed by instrument item id. Stored so any total can be recomputed and checked rather than trusted.';
comment on column public.instrument_administrations.instrument_version is
  'The version of the instrument definition in force when this was answered. Required so a later revision cannot reinterpret these responses.';

create index if not exists instrument_admin_participant_time
  on public.instrument_administrations (participant_id, administered_at desc);

alter table public.instrument_administrations enable row level security;

-- Mirrors check_ins: a participant sees their own, staff see the caseload they
-- are already entitled to. user_participant_id() and is_staff() are the same
-- gates used everywhere else, so this table cannot drift into its own weaker
-- access rule.
drop policy if exists instrument_admin_select on public.instrument_administrations;
create policy instrument_admin_select on public.instrument_administrations
  for select
  using ((participant_id = public.user_participant_id()) or public.is_staff());

drop policy if exists instrument_admin_insert on public.instrument_administrations;
create policy instrument_admin_insert on public.instrument_administrations
  for insert
  with check ((participant_id = public.user_participant_id()) or public.is_staff());

-- District, State and national oversight dashboards.
--
-- The problem statement asks for dashboards "at district, State and national
-- levels for monitoring vulnerable victims and high-risk cases" and for alerts
-- to reach "district authorities and designated officials". This migration
-- adds only what that needs, and nothing that widens who can read a person's
-- clinical record.
--
-- 1. participants.state / participants.district
--    Where a participant is, entered by the participant themselves (optional).
--    The only geography on the table until now was `region`, free text with no
--    State/district split. Existing rows are left empty and show as "Not
--    specified" rather than being guessed from anything else: the Recovery Hub
--    also records a district, but THREAT_MODEL.md makes sharing that data an
--    explicit per-case grant, so it is not read here.
--
-- 2. district_officers
--    The designated official to notify for each district. RLS is enabled with
--    no policies at all, so no browser session (participant or counsellor) can
--    read or write it. Only the admin API, which uses the service role behind
--    requireAdmin, touches this table.
--
-- 3. alerts.district_notified_at
--    When the district officer was told about this alert, so the same alert is
--    never emailed twice however often the sweep runs.
--
-- What officials are shown is decided in the API, not here: counts, risk
-- bands, response-time status and high-risk cases by case reference only.
-- No names, no check-in answers, no reflections, and aggregates over fewer
-- than five people are suppressed.

alter table public.participants
  add column if not exists state text,
  add column if not exists district text;

comment on column public.participants.state is
  'State or UT the participant says they live in (optional, self-reported). Used only for de-identified district/State/national totals.';
comment on column public.participants.district is
  'District the participant says they live in (optional, self-reported). Used only for de-identified district/State/national totals.';

create index if not exists participants_state_district
  on public.participants (lower(state), lower(district));

alter table public.alerts
  add column if not exists district_notified_at timestamptz;

comment on column public.alerts.district_notified_at is
  'When the district officer was sent a de-identified notice about this alert. Null until then; set once so an alert is never re-sent.';

create table if not exists public.district_officers (
  id            uuid primary key default gen_random_uuid(),
  state         text not null check (length(trim(state)) > 0),
  district      text not null check (length(trim(district)) > 0),
  officer_name  text not null check (length(trim(officer_name)) > 0),
  designation   text,
  email         text not null check (position('@' in email) > 1),
  phone         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.district_officers is
  'Designated official per district who receives de-identified high-risk notices. Admin-managed through the server; no client access.';

-- One officer per district, matched without regard to case or stray spaces.
create unique index if not exists district_officers_one_per_district
  on public.district_officers (lower(trim(state)), lower(trim(district)));

-- RLS on and no policies: anon and authenticated sessions get nothing.
alter table public.district_officers enable row level security;

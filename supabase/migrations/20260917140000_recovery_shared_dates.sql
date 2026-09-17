-- Court dates, and the narrow grant that lets a counsellor see them.
--
-- WHY THIS MIGRATION EXISTS
--
-- 20260916120000_recovery_hub.sql closed the Recovery Hub to staff completely,
-- and said so in its own header: "No staff policy, no service-role convenience
-- policy, no 'shared with counsellor' escape hatch. Adding one is a deliberate
-- future migration, not something a later edit can do by accident."
--
-- This is that deliberate migration, and it is deliberately the smallest one
-- that works.
--
-- THE PROBLEM IT SOLVES
--
-- src/services/caseEvents.ts already knows that a court hearing is the one
-- distress spike that can be anticipated rather than discovered afterwards,
-- and escalationEngine.ts already raises someone in the days before one. But
-- the only hearing dates AURA held were the ones a counsellor typed in. The
-- survivor's own case file — the place where they actually know when their
-- next hearing is — could not reach it. The engine built to see a hearing
-- coming was running blind on the people who knew the date.
--
-- WHAT IS SHARED, AND WHAT IS NOT
--
-- recovery_shared_dates is the only table in the Recovery Hub that staff can
-- read, and it is shaped so that reading it tells them almost nothing. It
-- holds a date and a kind. That is the entire schema. There is no note
-- column, no description, no FIR number, no case stage, no location, no
-- free text of any kind, so "only the dates are shared" is a property of the
-- table rather than a promise made by the code that writes to it. A future
-- edit cannot widen it without a migration that visibly adds a column.
--
-- The survivor's own hearing list (recovery_hearings) may carry a note — "at
-- the district court", "the one my brother is testifying at" — and that note
-- stays participant-only. Projecting a row deliberately drops it.
--
-- REVOCATION IS ENFORCED HERE, NOT IN THE CLIENT
--
-- Turning sharing off deletes the shared rows, by trigger. A client that
-- forgets to clean up, or a request that fails halfway, cannot leave dates
-- visible to staff after the person has said stop. Withdrawal that depends on
-- a successful second network call is not withdrawal.
--
-- HOW STAFF FIND THE RIGHT PERSON
--
-- owner_id is auth.uid(), and this application already treats a participant's
-- clinical record id as their auth user id (participantStore.getParticipantForUser
-- matches on p.id === user.id). So owner_id is the join key, and no second
-- identifier has to be introduced or kept in step.

-- ---------------------------------------------------------------------------
-- The survivor's own court dates
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_hearings (
  id           text primary key,
  case_id      text not null references public.recovery_cases(id) on delete cascade,

  -- A date, not a timestamp. Nobody knows their hearing to the minute, and
  -- storing an instant would invent a precision the person never gave.
  hearing_on   date not null,

  -- The person's own reminder to themselves. Participant-only: never
  -- projected into recovery_shared_dates, whatever the sharing flag says.
  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists recovery_hearings_case_date
  on public.recovery_hearings (case_id, hearing_on);

comment on table public.recovery_hearings is
  'Court dates as the survivor knows them. Past and future both belong here: the days after a hearing matter as much as the days before.';
comment on column public.recovery_hearings.note is
  'The person''s own note. Participant-only and never shared with staff, even when date sharing is on.';

-- ---------------------------------------------------------------------------
-- The grant itself
-- ---------------------------------------------------------------------------

alter table public.recovery_cases
  add column if not exists share_dates_with_counsellor boolean not null default false;

comment on column public.recovery_cases.share_dates_with_counsellor is
  'Off by default. When on, the case''s dates (and only its dates) are projected into recovery_shared_dates, where the counsellor can read them. Turning it off deletes those rows by trigger.';

-- ---------------------------------------------------------------------------
-- The projection: the only staff-readable table in the Recovery Hub
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_shared_dates (
  id           text primary key,
  case_id      text not null references public.recovery_cases(id) on delete cascade,

  -- Denormalised on purpose. A counsellor reading this table must not have to
  -- join back to recovery_cases, because they cannot read recovery_cases.
  owner_id     uuid not null references auth.users(id) on delete cascade,

  -- A closed vocabulary, so the column cannot become a smuggling route for
  -- free text. Anything new needs a migration that changes this constraint.
  kind         text not null check (kind in ('hearing', 'fir_filed')),

  on_date      date not null,

  shared_at    timestamptz not null default now(),

  -- One row per kind per date per case: re-sharing is idempotent.
  unique (case_id, kind, on_date)
);

create index if not exists recovery_shared_dates_owner
  on public.recovery_shared_dates (owner_id, on_date);

comment on table public.recovery_shared_dates is
  'Dates a survivor has chosen to share with their counsellor. The ONLY Recovery Hub table readable by staff. A date and a kind is the whole schema: there is no note, description, FIR number or free-text column, so the narrowness of the disclosure is structural rather than a convention the writing code is trusted to follow.';

-- ---------------------------------------------------------------------------
-- Revocation
-- ---------------------------------------------------------------------------

create or replace function public.recovery_revoke_shared_dates()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- Fires when the person turns sharing off. Deleting here means withdrawal
  -- takes effect in the same transaction as the decision, rather than in a
  -- follow-up request that may never arrive.
  if old.share_dates_with_counsellor is true
     and new.share_dates_with_counsellor is false then
    delete from public.recovery_shared_dates where case_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists recovery_cases_revoke_shared_dates on public.recovery_cases;
create trigger recovery_cases_revoke_shared_dates
  after update of share_dates_with_counsellor on public.recovery_cases
  for each row execute function public.recovery_revoke_shared_dates();

comment on function public.recovery_revoke_shared_dates() is
  'Deletes the shared date rows the moment sharing is turned off, so revocation cannot depend on a client cleaning up after itself.';

-- ---------------------------------------------------------------------------
-- updated_at, matching the rest of the Hub
-- ---------------------------------------------------------------------------

drop trigger if exists recovery_hearings_touch on public.recovery_hearings;
create trigger recovery_hearings_touch
  before update on public.recovery_hearings
  for each row execute function public.recovery_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.recovery_hearings     enable row level security;
alter table public.recovery_shared_dates enable row level security;

-- HEARINGS: participant-only, owned through the case, exactly like every other
-- child table in the Hub. Staff appear nowhere here.
drop policy if exists recovery_hearings_select on public.recovery_hearings;
create policy recovery_hearings_select on public.recovery_hearings
  for select using (public.recovery_owns_case(case_id));

drop policy if exists recovery_hearings_insert on public.recovery_hearings;
create policy recovery_hearings_insert on public.recovery_hearings
  for insert with check (public.recovery_owns_case(case_id));

drop policy if exists recovery_hearings_update on public.recovery_hearings;
create policy recovery_hearings_update on public.recovery_hearings
  for update using (public.recovery_owns_case(case_id))
  with check (public.recovery_owns_case(case_id));

drop policy if exists recovery_hearings_delete on public.recovery_hearings;
create policy recovery_hearings_delete on public.recovery_hearings
  for delete using (public.recovery_owns_case(case_id));

-- SHARED DATES: the survivor writes, the counsellor reads.
--
-- Writes are gated on owning the case AND on the flag actually being set, so
-- a row cannot be created for someone who has not opted in — the grant is
-- checked by the database rather than assumed from the fact that a write
-- arrived.
drop policy if exists recovery_shared_dates_insert on public.recovery_shared_dates;
create policy recovery_shared_dates_insert on public.recovery_shared_dates
  for insert with check (
    owner_id = auth.uid()
    and public.recovery_owns_case(case_id)
    and exists (
      select 1 from public.recovery_cases c
      where c.id = case_id and c.share_dates_with_counsellor is true
    )
  );

-- The person can always take a single date back without turning the whole
-- grant off.
drop policy if exists recovery_shared_dates_delete on public.recovery_shared_dates;
create policy recovery_shared_dates_delete on public.recovery_shared_dates
  for delete using (owner_id = auth.uid());

-- No update policy. A shared date is deleted and re-inserted, never edited in
-- place, so there is no path by which a row's date changes under a counsellor
-- who has already acted on it.

-- The one staff-readable policy in the Recovery Hub. SELECT only: staff can
-- read a date, and can neither create one nor remove one. What is shared stays
-- the survivor's decision in both directions.
drop policy if exists recovery_shared_dates_select on public.recovery_shared_dates;
create policy recovery_shared_dates_select on public.recovery_shared_dates
  for select using (owner_id = auth.uid() or public.is_staff());

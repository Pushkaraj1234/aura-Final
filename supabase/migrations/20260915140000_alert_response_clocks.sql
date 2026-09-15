-- Response-time clocks on alerts.
--
-- FEATURE_AUDIT recorded, accurately, "no response-time metric". An alert could
-- be raised and never looked at, and nothing in the system could tell you. A
-- tool whose whole purpose is bringing a person to a human's attention, with no
-- way of knowing whether that happened, is measuring its own output and calling
-- it an outcome.
--
-- Two clocks rather than one, because "seen" and "acted on" are different
-- promises. Collapsing them would let a team acknowledge its way to a clean
-- dashboard without anyone having been contacted.
--
-- A breach is measured against acknowledgement, not contact, because
-- acknowledgement is the promise the team actually controls. Whether a
-- participant picks up the phone inside an hour is not something a counsellor
-- can guarantee; whether the counsellor has looked at the alert is.
--
-- Targets live in src/services/slaEngine.ts, by severity:
--   RED    -> urgent,  1 hour
--   ORANGE -> contact, 24 hours
--   YELLOW -> watch,   7 days
--
-- Both columns are nullable with no backfill. The 34 alerts already in this
-- database were raised before any of this existed, and slaEngine treats a
-- resolved alert with no acknowledgement as "closed" rather than "breached" for
-- exactly that reason: marking historical rows as failures of a policy written
-- after them would inflate the breach rate and teach nobody anything.

alter table public.alerts
  add column if not exists acknowledged_at      timestamptz,
  add column if not exists contact_attempted_at timestamptz;

comment on column public.alerts.acknowledged_at is
  'When a human opened this alert and took it on. The clock a breach is measured against, because it is the promise the team controls: whether someone picks up inside an hour is not something a counsellor can guarantee, whether they have looked at the alert is.';
comment on column public.alerts.contact_attempted_at is
  'When someone actually tried to reach the participant. Deliberately separate from acknowledged_at: collapsing the two lets a team acknowledge its way to a clean dashboard without anybody having been contacted.';

-- Partial index: the breach view only ever asks for alerts nobody has picked
-- up yet, so the index covers that question rather than the whole table.
create index if not exists alerts_open_by_raised
  on public.alerts (created_at)
  where acknowledged_at is null;

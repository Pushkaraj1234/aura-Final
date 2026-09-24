-- Proctored trauma assessments: the camera-checked PCL-5 screening.
--
-- One row is one completed session of the opt-in proctored assessment
-- (src/features/proctoredAssessment). It sits beside
-- instrument_administrations rather than inside it because a session is more
-- than an instrument score: it also carries the functional-impact ratings, the
-- session-condition checks and the written report, and none of that belongs
-- in a table whose rows are single validated instruments.
--
-- The same decisions as instrument_administrations, for the same reasons.
--
-- Raw PCL-5 item responses are stored, not only the total, so any total here
-- can be recomputed and checked rather than trusted. The client service
-- derives every score from those responses before inserting.
--
-- Every row records the assessment version that produced it, so a later
-- change to an item or a scoring rule never reinterprets earlier answers.
--
-- items_answered is stored because the session can be ended early from the
-- pause screen. A partial PCL-5 is not a full measurement, and a reader of
-- this table must be able to tell the two apart without guessing.
--
-- There is no UPDATE and no DELETE policy, on purpose. A session is a
-- measurement taken at a moment; it can be followed by a later one, never
-- edited into a different answer.
--
-- Nothing here is video, audio or an image. The camera and microphone are
-- analysed in the browser and only the summary counts in sensor_stats and the
-- event log in session_events are kept.

create table if not exists public.proctored_assessments (
  id                   text primary key,
  participant_id       text not null references public.participants(id) on delete cascade,
  assessment_version   text not null,
  -- Keyed by PCL-5 item number (1-20).
  pcl5_responses       jsonb not null,
  items_answered       smallint not null check (items_answered between 0 and 20),
  total_score          smallint not null check (total_score between 0 and 80),
  cut_point            smallint not null check (cut_point between 0 and 80),
  above_threshold      boolean not null,
  -- { "intrusion": n, "avoidance": n, "negativeCognitions": n, "arousal": n }
  cluster_scores       jsonb not null,
  -- Keyed by functional-impact domain id, each 0-4.
  functional_responses jsonb not null default '{}'::jsonb,
  functional_average   numeric(3,1) not null default 0,
  -- PC-PTSD-5 brief screen, keyed by item number. Empty when skipped.
  pc_ptsd_responses    jsonb not null default '{}'::jsonb,
  index_trauma_label   text,
  session_integrity    text not null check (session_integrity in
                         ('VERIFIED', 'MINOR_SESSION_EVENTS', 'SIGNIFICANT_SESSION_EVENTS', 'UNABLE_TO_VERIFY')),
  sensor_stats         jsonb,
  session_events       jsonb not null default '[]'::jsonb,
  user_report          text not null default '',
  session_report       text not null default '',
  research_consent     boolean not null default false,
  administered_at      timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

comment on table public.proctored_assessments is
  'One completed session of the opt-in, camera-checked PCL-5 trauma screening. A screening result, never a diagnosis, and never blended into the AURA distress score.';
comment on column public.proctored_assessments.pcl5_responses is
  'Raw PCL-5 item responses (0-4) keyed by item number. Stored so the total can be recomputed rather than trusted.';
comment on column public.proctored_assessments.items_answered is
  'How many of the 20 PCL-5 items were answered. Below 20 means the session was ended early and the total is incomplete.';
comment on column public.proctored_assessments.session_integrity is
  'Summary of the session-condition checks (camera, microphone, window focus). Describes the session only; never used to judge the answers.';

create index if not exists proctored_assessments_participant_time
  on public.proctored_assessments (participant_id, administered_at desc);

alter table public.proctored_assessments enable row level security;

-- Read: the participant sees their own, staff see the caseload they are
-- already entitled to. The same two gates as check_ins and
-- instrument_administrations, so this table cannot drift into a weaker rule.
drop policy if exists proctored_assessments_select on public.proctored_assessments;
create policy proctored_assessments_select on public.proctored_assessments
  for select
  using ((participant_id = public.user_participant_id()) or public.is_staff());

-- Write: only the participant, about themselves. Unlike the WHO-5 there is no
-- staff insert, because this is a self-administered, camera-checked session:
-- a row written by anyone else would claim checks that never ran on them.
drop policy if exists proctored_assessments_insert on public.proctored_assessments;
create policy proctored_assessments_insert on public.proctored_assessments
  for insert
  with check (participant_id = public.user_participant_id());

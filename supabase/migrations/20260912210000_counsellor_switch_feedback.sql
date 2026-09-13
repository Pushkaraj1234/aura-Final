-- Why someone changed counsellor.
--
-- Switching is deliberately free: no approval, no reason required, nobody
-- told. This table is the *optional* thing a person may choose to say
-- afterwards, and none of that changes if they say nothing.
--
-- Why it is not counsellor_reviews: that table is keyed on a completed
-- session, because a public star rating has to be earned by a session that
-- actually happened. Most switches have no session behind them at all —
-- someone browses, picks, changes their mind an hour later. Forcing this into
-- counsellor_reviews would either break that rule or silently drop the
-- feedback.
--
-- Who can read it: the service, not the counsellor. A counsellor with four
-- clients who is told "one of your clients left, and here is what they wrote"
-- can usually work out which one, so an "anonymous" exit note read by the
-- person being left is not anonymous in any way that protects the writer. It
-- is therefore readable by the participant who wrote it and by the admin
-- portal through the service role, and by nobody else — is_staff() does not
-- open this table.

-- ---------------------------------------------------------------------------
-- "Was this person ever my counsellor?"
--
-- The insert policy below needs this, and cannot ask assignment_history
-- directly: that table is staff-read only (is_staff()), so the subquery would
-- return nothing for every participant and every insert would fail — a policy
-- that looks right and rejects everybody.
--
-- It is SECURITY DEFINER for that reason, and it answers only about the
-- caller's own participant record, so it cannot be used as an oracle for
-- "who was assigned to whom".
-- ---------------------------------------------------------------------------
create or replace function public.was_my_counsellor(p_participant text, p_worker uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.participants p
    where p.id = p_participant
      and p.user_id = auth.uid()
      and (
        p.assigned_worker = p_worker::text
        or exists (
          select 1 from public.assignment_history h
          where h.participant_id = p.id
            and (h.previous_worker_id = p_worker or h.new_worker_id = p_worker)
        )
      )
  );
$$;

revoke all on function public.was_my_counsellor(text, uuid) from public, anon;
grant execute on function public.was_my_counsellor(text, uuid) to authenticated;

create table if not exists public.counsellor_switch_feedback (
  id                 uuid primary key default gen_random_uuid(),
  participant_id     text not null references public.participants(id) on delete cascade,
  previous_worker_id uuid not null references public.profiles(id) on delete cascade,
  new_worker_id      uuid references public.profiles(id) on delete set null,
  rating             smallint check (rating is null or rating between 1 and 5),
  body               text check (body is null or char_length(body) <= 600),
  status             text not null default 'pending'
                       check (status in ('pending','reviewed','dismissed')),
  moderation_note    text,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  -- A note with neither a rating nor any words carries nothing; it would only
  -- add rows to a queue a human has to read.
  constraint counsellor_switch_feedback_not_empty
    check (rating is not null or (body is not null and btrim(body) <> ''))
);

create index if not exists counsellor_switch_feedback_participant_idx
  on public.counsellor_switch_feedback (participant_id, created_at desc);
create index if not exists counsellor_switch_feedback_queue_idx
  on public.counsellor_switch_feedback (status, created_at) where status = 'pending';

alter table public.counsellor_switch_feedback enable row level security;

-- The writer owns it: they may add one and read their own back. There is
-- deliberately no update or delete policy, and no staff policy — see header.
drop policy if exists counsellor_switch_feedback_own_read on public.counsellor_switch_feedback;
create policy counsellor_switch_feedback_own_read
  on public.counsellor_switch_feedback for select using (
    exists (select 1 from public.participants p
            where p.id = counsellor_switch_feedback.participant_id
              and p.user_id = auth.uid())
  );

drop policy if exists counsellor_switch_feedback_insert on public.counsellor_switch_feedback;
create policy counsellor_switch_feedback_insert
  on public.counsellor_switch_feedback for insert with check (
    status = 'pending'
    and exists (select 1 from public.participants p
                where p.id = counsellor_switch_feedback.participant_id
                  and p.user_id = auth.uid())
    and public.was_my_counsellor(participant_id, previous_worker_id)
  );

-- What the person who wrote it sees afterwards: their own words back, and
-- nothing about who has read them.
drop view if exists public.my_switch_feedback;
create view public.my_switch_feedback as
  select f.id,
         f.previous_worker_id,
         f.new_worker_id,
         f.rating,
         f.body,
         f.created_at
  from public.counsellor_switch_feedback f
  join public.participants p
    on p.id = f.participant_id and p.user_id = auth.uid();

grant select on public.my_switch_feedback to authenticated;

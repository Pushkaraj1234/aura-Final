-- Self-selection as one atomic action, plus the photo bucket.
--
-- Choosing a counsellor updates participants.assigned_worker AND appends to
-- assignment_history, and those two must not be able to drift apart. Doing it
-- in the database also means a participant never needs an INSERT grant on
-- assignment_history, which is otherwise a staff-read table.
--
-- The admin path is untouched: it still writes both itself with
-- assigned_by = 'admin'. This writes 'self'. Latest write wins, which is
-- already how admin reassignment behaves.
create or replace function public.select_counsellor(p_worker uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant text;
  v_previous    text;
begin
  select p.id, p.assigned_worker into v_participant, v_previous
  from public.participants p
  where p.user_id = auth.uid();

  if v_participant is null then
    raise exception 'No participant record for the signed-in user'
      using errcode = 'P0002';
  end if;

  -- Only someone actually listed in the directory can be chosen: this rejects a
  -- crafted request naming an unpublished, suspended or full counsellor.
  if not exists (
    select 1 from public.counsellor_directory d
    where d.worker_id = p_worker and d.accepting_new_clients
  ) then
    raise exception 'That counsellor is not currently accepting new clients'
      using errcode = 'P0001';
  end if;

  update public.participants
  set assigned_worker = p_worker::text,
      updated_at      = now()
  where id = v_participant;

  insert into public.assignment_history (id, participant_id, previous_worker_id, new_worker_id, assigned_by, reason)
  values (
    'asg-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6),
    v_participant,
    case when v_previous ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
         then v_previous::uuid else null end,
    p_worker,
    'self',
    'Chosen by the participant'
  );

  return v_participant;
end;
$$;

revoke all on function public.select_counsellor(uuid) from public, anon;
grant execute on function public.select_counsellor(uuid) to authenticated;

-- Private bucket: the directory hands out short-lived signed URLs rather than
-- permanent public links, matching how credential files are already handled.
insert into storage.buckets (id, name, public)
values ('counsellor-photos', 'counsellor-photos', false)
on conflict (id) do nothing;

drop policy if exists counsellor_photo_read on storage.objects;
create policy counsellor_photo_read on storage.objects for select
  using (bucket_id = 'counsellor-photos' and auth.uid() is not null);

-- A counsellor may only write into a folder named for their own user id.
drop policy if exists counsellor_photo_write on storage.objects;
create policy counsellor_photo_write on storage.objects for insert
  with check (
    bucket_id = 'counsellor-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists counsellor_photo_update on storage.objects;
create policy counsellor_photo_update on storage.objects for update
  using (
    bucket_id = 'counsellor-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

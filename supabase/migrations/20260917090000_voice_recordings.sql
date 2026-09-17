-- Audio kept because the person turned on "Keep the recording afterwards".
--
-- WHY THIS TABLE HAD TO EXIST
--
-- The consent screen offered three separate voice choices, and two of them
-- were decorative. "Keep the recording afterwards" said "Stores the audio
-- itself once the session ends", and nothing stored anything: stopRecording
-- produced a blob URL, which lives in one browser tab and dies with it. The
-- switch was a promise about retention that no code kept, in either
-- direction, which is the worst shape a consent control can have.
--
-- WHY IT IS NOT READABLE BY STAFF
--
-- Counsellors already see reflections and transcripts where the person has
-- allowed it. A recording is a different disclosure: it carries a survivor's
-- voice, who else was in the room, and how they sounded saying it. No consent
-- on the screen covers a counsellor listening to that, so none of them may.
-- If that is ever wanted it has to be its own switch, and the absence of a
-- staff policy here is what forces that to be asked out loud.

create table if not exists public.voice_recordings (
  id             text primary key,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  participant_id text references public.participants(id) on delete set null,
  storage_path   text not null unique,
  duration_seconds integer,
  size_bytes     integer,
  mime_type      text,
  transcript     text,
  recorded_at    timestamptz not null default now()
);

comment on table public.voice_recordings is
  'Audio kept because the person turned on "Keep the recording afterwards". Before this table that switch stored nothing: the recorder made a blob URL that died with the browser tab, so the consent promised a retention that never happened. Rows exist only while that consent is on, and are removed when it is turned off.';

comment on column public.voice_recordings.transcript is
  'The transcript as it stood when the recording was kept, so a person playing an old recording back can see what was read from it. Never regenerated.';

create index if not exists voice_recordings_owner_time
  on public.voice_recordings (owner_id, recorded_at desc);

alter table public.voice_recordings enable row level security;

drop policy if exists voice_recordings_select on public.voice_recordings;
create policy voice_recordings_select on public.voice_recordings
  for select using (owner_id = auth.uid());

drop policy if exists voice_recordings_insert on public.voice_recordings;
create policy voice_recordings_insert on public.voice_recordings
  for insert with check (owner_id = auth.uid());

-- No UPDATE policy: a recording is a thing that happened. It can be deleted,
-- never edited into a different recording.
drop policy if exists voice_recordings_delete on public.voice_recordings;
create policy voice_recordings_delete on public.voice_recordings
  for delete using (owner_id = auth.uid());

-- Private bucket. 25 MB and an audio-only allowlist, enforced by the storage
-- service rather than by the client.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-recordings',
  'voice-recordings',
  false,
  26214400,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare p text;
begin
  foreach p in array array[
    'voice_rec_select','voice_rec_insert','voice_rec_delete'
  ] loop
    execute format('drop policy if exists %I on storage.objects', p);
  end loop;
end $$;

create policy voice_rec_select on storage.objects
  for select to authenticated
  using (bucket_id = 'voice-recordings'
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy voice_rec_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voice-recordings'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy voice_rec_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'voice-recordings'
         and (storage.foldername(name))[1] = auth.uid()::text);

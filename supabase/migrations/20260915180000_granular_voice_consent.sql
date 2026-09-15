-- Splits one voice switch into the three separate things it was covering.
--
-- The umbrella review on AI for mental health monitoring (Yeasmin et al.,
-- Health Science Reports 2025) reports that people readily permit some kinds
-- of monitoring while declining others, and that voice is consistently among
-- the inputs they are most reluctant about. AURA offered a single
-- optional_voice_feature boolean covering three genuinely different things:
-- turning speech into text, measuring how it was said, and keeping the
-- recording. Someone happy to speak but unwilling to have their delivery
-- analysed had no way to say so, so the honest reading of that switch was
-- "all three or nothing".
--
-- The old column is kept rather than dropped. It is the only record of what
-- existing participants actually agreed to, and the three new columns are
-- backfilled from it: a person who consented to the bundle is treated as
-- having consented to each part, which is what they were in fact told. A
-- default of false would silently revoke a consent they gave; a default of
-- true for new rows would manufacture one they never gave. Hence: backfill
-- from the old value, default the new columns to false.

alter table public.consents
  add column if not exists voice_transcription     boolean not null default false,
  add column if not exists voice_acoustic_analysis boolean not null default false,
  add column if not exists voice_audio_retention   boolean not null default false;

comment on column public.consents.voice_transcription is
  'Speech may be turned into text. Without this the voice companion cannot work at all.';
comment on column public.consents.voice_acoustic_analysis is
  'How something was said (pitch variability, pace, pauses, loudness) may be measured on-device and summarised as numbers. Separate from transcription because it is the part people most often decline.';
comment on column public.consents.voice_audio_retention is
  'The recording itself may be kept after the session. Declining this leaves transcription and analysis working; nothing audio is stored.';
comment on column public.consents.optional_voice_feature is
  'DEPRECATED, retained as the record of what pre-split participants agreed to. Read the three voice_* columns instead.';

-- Backfill: anyone who agreed to the bundle agreed to each part of it.
update public.consents
set voice_transcription     = true,
    voice_acoustic_analysis = true,
    voice_audio_retention   = true
where optional_voice_feature is true
  and voice_transcription is false
  and voice_acoustic_analysis is false
  and voice_audio_retention is false;

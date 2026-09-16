-- The Victim Recovery Hub: a survivor's own administrative file.
--
-- WHY THIS IS NOT KEYED ON participant_id
--
-- Every other table in this schema is keyed on participants.id and readable by
-- is_staff(), because everything else here is clinical: check-ins, alerts,
-- scores, the things a counsellor is meant to act on. This is not that. An FIR
-- number, a caste certificate, a medical report and the account of what was
-- done to someone are the person's own legal and administrative records, and
-- they do not become staff-readable because the person also uses the check-in.
--
-- So these tables are owned by auth.uid() and every policy is
-- `owner_id = auth.uid()`. is_staff() appears nowhere in this file, on purpose.
-- A counsellor with a full staff session sees nothing here. If case sharing is
-- ever wanted it has to be built as an explicit, per-case, revocable grant,
-- and the absence of a staff policy is what forces that conversation to happen
-- rather than letting the data quietly widen.
--
-- WHY NOTHING HERE IS EVER "OFFICIAL" BY DEFAULT
--
-- AURA has no authorised integration with any police, court or compensation
-- system, so it cannot know the real status of anybody's case. Every table
-- that carries a status also carries a verification column defaulting to
-- USER_REPORTED, and the check constraint makes OFFICIALLY_VERIFIED a value
-- that has to be written deliberately. A survivor planning around a status
-- this app invented would be actively harmed, which is why the default is the
-- honest one rather than the flattering one.

-- ---------------------------------------------------------------------------
-- Shared vocabulary
-- ---------------------------------------------------------------------------

-- Workflow status. Deliberately closed: "pending", "processing" and similar
-- tell a person nothing about whose desk their file is on.
create or replace function public.recovery_is_status(v text)
returns boolean language sql immutable as $$
  select v in (
    'NOT_STARTED','IN_PROGRESS','SUBMITTED','UNDER_REVIEW',
    'VERIFICATION_REQUIRED','APPROVED','REJECTED','COMPLETED','CLOSED'
  );
$$;

-- Where a piece of information came from. Kept separate from status, because
-- "under review, according to the applicant" and "under review, according to
-- the authority" are different claims and the difference is the whole point.
create or replace function public.recovery_is_verification(v text)
returns boolean language sql immutable as $$
  select v in ('USER_REPORTED','DOCUMENT_VERIFIED','OFFICIALLY_VERIFIED');
$$;

comment on function public.recovery_is_status(text) is
  'Closed set of workflow statuses for Recovery Hub rows. Kept as a function rather than an enum so adding a status is a migration, not an ALTER TYPE with a table rewrite.';
comment on function public.recovery_is_verification(text) is
  'How a Recovery Hub row came to be believed. Separate from status by design: the source of a claim and the claim itself are different facts.';

-- ---------------------------------------------------------------------------
-- Case identifiers
-- ---------------------------------------------------------------------------

create sequence if not exists public.recovery_case_seq;

-- VR-2026-00124. Human-readable because a person under stress has to be able
-- to read it down a phone line to a helpline worker; a UUID cannot be. It is
-- not a security boundary (RLS is) and it is never an FIR or government
-- number, which the UI states wherever it is displayed.
create or replace function public.next_recovery_case_id()
returns text language sql volatile as $$
  select 'VR-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.recovery_case_seq')::text, 5, '0');
$$;

comment on function public.next_recovery_case_id() is
  'Generates the next Recovery Hub case id (VR-YYYY-NNNNN). Readable aloud on purpose. Never an FIR number, court number or government application number.';

-- ---------------------------------------------------------------------------
-- CASE
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_cases (
  id                 text primary key default public.next_recovery_case_id(),
  owner_id           uuid not null references auth.users(id) on delete cascade,

  -- Asked for, never required. Someone may open a case before they are ready
  -- to give a name, and a form that refuses to proceed without one turns the
  -- first screen into a checkpoint.
  display_name       text,
  contact_phone      text,
  contact_email      text,
  state              text,
  district           text,
  language           text not null default 'en',

  status             text not null default 'IN_PROGRESS'
                     check (public.recovery_is_status(status)),

  -- §13. Modelled as columns rather than a child table: these are the
  -- checkboxes a person ticked about their own situation, not events with
  -- their own identity, dates or lifecycle. A row per checkbox would add joins
  -- and give nothing back.
  financial_impacts  text[] not null default '{}',
  prior_assistance   text check (prior_assistance in ('yes','no','unsure')),

  opened_at          timestamptz not null default now(),
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.recovery_cases is
  'One survivor-owned recovery file. Owned by auth.uid(), never readable by staff: see the header of this migration.';
comment on column public.recovery_cases.financial_impacts is
  'Self-reported financial impact categories. Used to surface resources that MAY be relevant; never to assert eligibility, which only the relevant authority decides.';

-- ---------------------------------------------------------------------------
-- INCIDENT
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_incidents (
  id                 text primary key,
  case_id            text not null unique
                     references public.recovery_cases(id) on delete cascade,

  -- Null until the person chooses, and 'unknown' is a first-class answer.
  -- Someone who cannot yet categorise what happened to them is not an invalid
  -- form state.
  category           text,
  occurred_on        date,
  occurred_time_note text,
  location           text,
  state              text,
  district           text,
  police_station     text,

  -- The person's own words, stored exactly as given. Nothing in this codebase
  -- rewrites, summarises or reclassifies this column: a legal conclusion drawn
  -- from it by software would be both wrong and quotable against them.
  account            text,
  account_source     text check (account_source in ('typed','voice')),

  impacts            text[] not null default '{}',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column public.recovery_incidents.account is
  'The survivor''s own account, verbatim. Never summarised, reclassified or replaced by a generated version. Preserving the original wording is the point.';
comment on column public.recovery_incidents.category is
  'Self-selected category, including "unknown". Advisory only: it never determines eligibility and is never presented as a legal characterisation of the incident.';

-- ---------------------------------------------------------------------------
-- FIR
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_firs (
  id                 text primary key,
  case_id            text not null unique
                     references public.recovery_cases(id) on delete cascade,

  -- Tri-state on purpose: null means "not asked yet", which is different from
  -- "no FIR" and drives a different next step.
  has_fir            boolean,
  fir_number         text,
  fir_year           smallint check (fir_year is null or fir_year between 1950 and 2100),
  police_station     text,
  district           text,
  fir_date           date,

  -- The case's stage as the person understands it. Free text against a UI
  -- vocabulary rather than the workflow status set, because "investigation"
  -- and "charge sheet filed" are stages of a criminal case, not of a form.
  case_stage         text,

  verification       text not null default 'USER_REPORTED'
                     check (public.recovery_is_verification(verification)),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.recovery_firs is
  'FIR details as the survivor reports them. AURA does not register FIRs and has no police integration: verification stays USER_REPORTED unless a document or an authorised source says otherwise.';

-- ---------------------------------------------------------------------------
-- TIMELINE
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_timeline_events (
  id                 text primary key,
  case_id            text not null references public.recovery_cases(id) on delete cascade,

  stage              text not null,
  occurred_on        date,
  status             text not null default 'NOT_STARTED'
                     check (public.recovery_is_status(status)),
  description        text,

  -- §28. Where this came from, so the UI can show it beside the claim rather
  -- than presenting every row in the same confident voice.
  source_name        text,
  source_url         text,
  source_checked_on  date,
  verification       text not null default 'USER_REPORTED'
                     check (public.recovery_is_verification(verification)),

  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists recovery_timeline_case_time
  on public.recovery_timeline_events (case_id, occurred_on desc nulls last, created_at desc);

-- ---------------------------------------------------------------------------
-- DOCUMENTS
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_documents (
  id                 text primary key,
  case_id            text not null references public.recovery_cases(id) on delete cascade,

  doc_type           text not null,
  label              text,
  -- Path inside the private recovery-documents bucket. Always prefixed with
  -- the owner's uid, which is what the storage policy below keys on.
  storage_path       text not null unique,
  mime_type          text,
  size_bytes         integer,

  verification       text not null default 'USER_REPORTED'
                     check (public.recovery_is_verification(verification)),

  uploaded_at        timestamptz not null default now()
);

create index if not exists recovery_documents_case
  on public.recovery_documents (case_id, doc_type);

comment on column public.recovery_documents.storage_path is
  'Object key in the private recovery-documents bucket, always <auth.uid()>/<case_id>/<id>.<ext>. The leading folder is the ownership check in the storage policy, so it must never be written any other way.';

-- ---------------------------------------------------------------------------
-- LEGAL AID
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_legal_aid_applications (
  id                 text primary key,
  case_id            text not null references public.recovery_cases(id) on delete cascade,

  application_number text,
  applied_on         date,
  authority          text,
  lawyer_name        text,
  lawyer_contact     text,

  status             text not null default 'NOT_STARTED'
                     check (public.recovery_is_status(status)),
  verification       text not null default 'USER_REPORTED'
                     check (public.recovery_is_verification(verification)),

  next_follow_up_on  date,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- COMPENSATION
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_compensation_applications (
  id                 text primary key,
  case_id            text not null references public.recovery_cases(id) on delete cascade,

  -- Which scheme this was prepared against, keyed to the resource catalogue in
  -- src/services/officialResources.ts. Stored as a key rather than a URL so a
  -- portal moving does not orphan the row.
  scheme_key         text,
  application_number text,
  applied_on         date,
  authority          text,

  status             text not null default 'NOT_STARTED'
                     check (public.recovery_is_status(status)),
  verification       text not null default 'USER_REPORTED'
                     check (public.recovery_is_verification(verification)),

  -- Deliberately not an amount column. AURA does not know what anybody will be
  -- awarded, and a number in this row would be read as a promise.
  next_follow_up_on  date,
  notes              text,

  -- The prepared answers, so the guided workflow can be resumed and reviewed
  -- before the person submits anything on the official portal themselves.
  draft              jsonb not null default '{}'::jsonb,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.recovery_compensation_applications is
  'Preparation and tracking only. AURA never submits to any government portal; the survivor does that themselves on the official site, and this row records what they prepared and what they told us happened next.';

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_notifications (
  id                 text primary key,
  owner_id           uuid not null references auth.users(id) on delete cascade,
  case_id            text references public.recovery_cases(id) on delete cascade,

  kind               text not null,
  -- §20. The title is what may appear in a push or email preview, so it is
  -- written to carry no case detail; body is only ever shown in-app behind the
  -- session.
  title              text not null,
  body               text,

  read_at            timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists recovery_notifications_owner
  on public.recovery_notifications (owner_id, created_at desc);

comment on column public.recovery_notifications.title is
  'Safe for an out-of-app preview: no FIR number, no incident detail, no scheme name. Anything sensitive belongs in body, which is only rendered inside an authenticated session.';

-- ---------------------------------------------------------------------------
-- AUDIT
-- ---------------------------------------------------------------------------

create table if not exists public.recovery_audit_log (
  id                 text primary key,
  owner_id           uuid not null references auth.users(id) on delete cascade,
  case_id            text references public.recovery_cases(id) on delete set null,
  action             text not null,
  detail             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists recovery_audit_owner
  on public.recovery_audit_log (owner_id, created_at desc);

comment on table public.recovery_audit_log is
  'Append-only. There is no UPDATE or DELETE policy: a log the subject can rewrite is not a log.';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.recovery_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'recovery_cases','recovery_incidents','recovery_firs',
    'recovery_timeline_events','recovery_legal_aid_applications',
    'recovery_compensation_applications'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.recovery_touch_updated_at()',
      t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Ownership
-- ---------------------------------------------------------------------------

-- Child rows hang off the case, so ownership is asked once, here. SECURITY
-- DEFINER because this reads recovery_cases from inside the policies that
-- protect recovery_cases; without it the check would recurse through RLS.
-- search_path is pinned for the usual reason: a SECURITY DEFINER function that
-- resolves names against the caller's path is a privilege-escalation vector.
create or replace function public.recovery_owns_case(p_case_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.recovery_cases c
    where c.id = p_case_id and c.owner_id = auth.uid()
  );
$$;

revoke all on function public.recovery_owns_case(text) from public;
grant execute on function public.recovery_owns_case(text) to authenticated;

comment on function public.recovery_owns_case(text) is
  'True when the current session owns the given Recovery Hub case. The single ownership check behind every child-table policy. Note there is no is_staff() branch: this data is participant-only by design.';

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Same shape on every table: you reach your own rows and nothing else. No
-- staff policy, no service-role convenience policy, no "shared with counsellor"
-- escape hatch. Adding one is a deliberate future migration, not something a
-- later edit can do by accident.
-- ---------------------------------------------------------------------------

alter table public.recovery_cases                      enable row level security;
alter table public.recovery_incidents                  enable row level security;
alter table public.recovery_firs                       enable row level security;
alter table public.recovery_timeline_events            enable row level security;
alter table public.recovery_documents                  enable row level security;
alter table public.recovery_legal_aid_applications     enable row level security;
alter table public.recovery_compensation_applications  enable row level security;
alter table public.recovery_notifications              enable row level security;
alter table public.recovery_audit_log                  enable row level security;

-- CASE: owned directly.
drop policy if exists recovery_cases_select on public.recovery_cases;
create policy recovery_cases_select on public.recovery_cases
  for select using (owner_id = auth.uid());

drop policy if exists recovery_cases_insert on public.recovery_cases;
create policy recovery_cases_insert on public.recovery_cases
  for insert with check (owner_id = auth.uid());

drop policy if exists recovery_cases_update on public.recovery_cases;
create policy recovery_cases_update on public.recovery_cases
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- §21 requires the person can delete their own file. Cascades clear every
-- child row; stored objects are removed by the client before this runs.
drop policy if exists recovery_cases_delete on public.recovery_cases;
create policy recovery_cases_delete on public.recovery_cases
  for delete using (owner_id = auth.uid());

-- CHILD TABLES: owned through the case.
do $$
declare t text;
begin
  foreach t in array array[
    'recovery_incidents','recovery_firs','recovery_timeline_events',
    'recovery_documents','recovery_legal_aid_applications',
    'recovery_compensation_applications'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select
         using (public.recovery_owns_case(case_id))', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert
         with check (public.recovery_owns_case(case_id))', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update
         using (public.recovery_owns_case(case_id))
         with check (public.recovery_owns_case(case_id))', t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete
         using (public.recovery_owns_case(case_id))', t || '_delete', t);
  end loop;
end $$;

-- NOTIFICATIONS: owned directly. Read state is the only thing the person
-- changes, but a narrower UPDATE policy would need column privileges to be
-- meaningful, so ownership is the boundary and the client writes read_at.
drop policy if exists recovery_notifications_select on public.recovery_notifications;
create policy recovery_notifications_select on public.recovery_notifications
  for select using (owner_id = auth.uid());

drop policy if exists recovery_notifications_insert on public.recovery_notifications;
create policy recovery_notifications_insert on public.recovery_notifications
  for insert with check (owner_id = auth.uid());

drop policy if exists recovery_notifications_update on public.recovery_notifications;
create policy recovery_notifications_update on public.recovery_notifications
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists recovery_notifications_delete on public.recovery_notifications;
create policy recovery_notifications_delete on public.recovery_notifications
  for delete using (owner_id = auth.uid());

-- AUDIT: append and read. No update policy and no delete policy, so neither is
-- possible through the API regardless of what a future client tries.
drop policy if exists recovery_audit_select on public.recovery_audit_log;
create policy recovery_audit_select on public.recovery_audit_log
  for select using (owner_id = auth.uid());

drop policy if exists recovery_audit_insert on public.recovery_audit_log;
create policy recovery_audit_insert on public.recovery_audit_log
  for insert with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Document storage
--
-- Private bucket. The type and size limits are set on the bucket itself rather
-- than in the client, so they are enforced by the storage service and a
-- modified client cannot talk its way past them. AURA does not scan uploads
-- for malware; that is stated in the UI rather than implied away.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recovery-documents',
  'recovery-documents',
  false,
  15728640, -- 15 MB
  array[
    'application/pdf',
    'image/jpeg','image/png','image/webp','image/heic','image/heif'
  ]
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ownership is the first path segment: <auth.uid()>/<case_id>/<doc_id>.<ext>.
do $$
declare p text;
begin
  foreach p in array array[
    'recovery_docs_select','recovery_docs_insert',
    'recovery_docs_update','recovery_docs_delete'
  ] loop
    execute format('drop policy if exists %I on storage.objects', p);
  end loop;
end $$;

create policy recovery_docs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'recovery-documents'
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy recovery_docs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recovery-documents'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy recovery_docs_update on storage.objects
  for update to authenticated
  using (bucket_id = 'recovery-documents'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recovery-documents'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy recovery_docs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'recovery-documents'
         and (storage.foldername(name))[1] = auth.uid()::text);

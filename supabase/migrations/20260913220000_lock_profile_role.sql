-- Make profiles.role something a person cannot award themselves.
--
-- is_staff() decides who may read every participant, check-in, alert and
-- support note in the database, and it answers by reading profiles.role. That
-- column was writable by the person it describes, through three doors:
--
--   1. profiles_update_self was USING ((id = auth.uid()) OR is_staff()) with no
--      WITH CHECK. Postgres reuses USING as the check when one is absent, and
--      neither expression mentions the role column — so `update profiles set
--      role = 'admin' where id = auth.uid()` passed.
--   2. handle_new_user() copied the role out of raw_user_meta_data, which the
--      client supplies verbatim at signUp().
--   3. Failing both, it fell back to `email ilike '%worker%'`.
--
-- The publishable key ships in the browser bundle by design, so all three were
-- reachable by anyone with the public site and no special tooling: one sign-up
-- and one update returned every survivor's records.
--
-- The fix is a trigger rather than a cleverer policy. A policy sees only the
-- row being written; deciding whether a *change of role* is allowed needs the
-- old row and the new one together, which is what BEFORE UPDATE gives us.

-- ---------------------------------------------------------------------------
-- The guard
-- ---------------------------------------------------------------------------

-- Two things here are load-bearing, and both were got wrong on the way to this
-- version, so they are worth stating plainly:
--
--   SECURITY INVOKER. Inside a SECURITY DEFINER function current_user is the
--   function's owner, not the caller, so the client test below matched nothing
--   and the guard waved every update through. It was written DEFINER first and
--   a test promoting a participant to admin passed when it should have failed.
--
--   current_user as the only signal. An earlier version also read the role
--   claim out of request.jwt.claims and OR-ed the two, which refused a
--   service-role connection whenever a claim left over from an earlier
--   statement in the same transaction still said 'authenticated' — that would
--   have broken promoting a counsellor from the admin panel. PostgREST already
--   switches the database role to match the key presented, so current_user
--   answers "is this a browser session?" exactly.
create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  -- anon and authenticated are the two roles PostgREST gives a browser. Naming
  -- those, rather than trying to enumerate the trusted server-side roles, stays
  -- correct if Supabase adds another internal role later.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  caller_is_admin := coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );

  -- A self-insert is quietly held to 'participant' rather than refused: the row
  -- is created for the person during sign-up, and failing their sign-up over a
  -- field they did not knowingly set would be the wrong trade. Staff are
  -- promoted deliberately, through the admin panel, never by signing up.
  if tg_op = 'INSERT' then
    if new.role is distinct from 'participant' and not caller_is_admin then
      new.role := 'participant';
    end if;
    return new;
  end if;

  -- An update that changes the role is refused outright. Unlike sign-up there
  -- is no benign reading of it: nothing in the app asks a participant to change
  -- their own role, so a request that does is either a mistake worth surfacing
  -- or an attempt worth stopping.
  if new.role is distinct from old.role and not caller_is_admin then
    raise exception 'profiles.role cannot be changed from a client session'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_profile_role_guard() is
  'Stops a client session awarding itself a staff role. is_staff() trusts profiles.role, so this column is a privilege boundary. Must stay SECURITY INVOKER so current_user is the caller.';

drop trigger if exists profiles_role_guard on public.profiles;

create trigger profiles_role_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_role_guard();

-- ---------------------------------------------------------------------------
-- Close the sign-up door
-- ---------------------------------------------------------------------------

-- Everyone who signs up is a participant. The role is no longer read from
-- raw_user_meta_data (client-supplied), and the '%worker%' email heuristic is
-- gone — an address is not a credential, and "worker" is an ordinary word to
-- find in one.
--
-- Consequence worth knowing: on a fresh database the demo counsellor account
-- (worker.demo@auraapp.dev), which authService provisions through signUp with
-- role metadata, now comes up as a participant. Promote it once from the admin
-- panel, or seed it with the service role. On this database that account
-- already exists as support_worker and is unaffected.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, email, language, age_range, support_preference, consent_given)
  values (
    new.id,
    'participant',
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'language', 'English'),
    coalesce(new.raw_user_meta_data->>'ageRange', '25-34'),
    coalesce(new.raw_user_meta_data->>'supportPreference', 'Human support worker'),
    coalesce((new.raw_user_meta_data->>'consentGiven')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Say what the update policy checks
-- ---------------------------------------------------------------------------

-- The same expression the policy already enforced implicitly, written out.
-- This changes no behaviour; it removes the null WITH CHECK that made the
-- policy read as though writes were unconstrained.
drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self on public.profiles
  for update
  using ((id = auth.uid()) or is_staff())
  with check ((id = auth.uid()) or is_staff());

-- Topper answer copies: who has opened which.
--
-- The copies themselves are not in the database. They come from a pipeline
-- run as lib/toppers/<subject>.json, so the file in the repository is the
-- record; the PDFs sit in a private R2 bucket and are served as five-minute
-- signed URLs (lib/toppers/r2.ts). What has to live here is the free
-- allowance: anyone signed in may open five copies, any five, and after that
-- they need a subscription to the optional the copy belongs to.
--
-- Same shape as the flashcard allowance (006_flashcards.sql), and for the same
-- reasons:
--   * The allowance is a set of copies, not a count. Re-opening a copy already
--     opened costs nothing, and opening it again in Compare costs nothing
--     either. On the history site every open was charged, Compare's two panes
--     included, so a reader could spend their free views on one copy.
--   * Keyed on the Firebase uid. Every page here needs an account, and this
--     site does not meter on a client-supplied fingerprint.
--   * The check and the insert run under an advisory lock on the reader, so
--     requests fired in parallel cannot open more than five between them.
--   * Nothing is readable or callable with the public key. The route decides
--     who may open what and calls these with the service key; the copy ids it
--     passes are checked against the copy list first, so an id that is not a
--     copy is never charged.
--
-- Run once, inside a transaction. Safe to re-run.

create table if not exists public.topper_unlocks (
  id           bigserial primary key,
  firebase_uid text not null,
  -- lib/toppers/<subject>.json ids, e.g. '2401-1a-riya-saini'. An id is
  -- unique within its optional; the subject is part of the key so two
  -- optionals' ids can never collide.
  copy_id      text not null,
  subject      text not null,
  created_at   timestamptz not null default now(),
  constraint topper_unlocks_uid_check     check (firebase_uid <> ''),
  constraint topper_unlocks_subject_check check (subject in ('sociology','anthropology','polsci','geography','pub-admin')),
  constraint topper_unlocks_uid_copy_key  unique (firebase_uid, subject, copy_id)
);

alter table public.topper_unlocks enable row level security;

drop policy if exists "service role manages topper unlocks" on public.topper_unlocks;
create policy "service role manages topper unlocks" on public.topper_unlocks
  as permissive for all to service_role
  using (true) with check (true);

-- Grants are written out because Supabase stopped granting new tables to the
-- API roles on 30 October 2026.
revoke all on public.topper_unlocks from anon, authenticated;
grant select, insert, update, delete on public.topper_unlocks to service_role;
grant usage, select on sequence public.topper_unlocks_id_seq to service_role;

-- ── Spending the allowance ──────────────────────────────────────────────────
-- Whether this reader may open this copy, and how many they have now opened.
-- A copy already opened is granted for free; a new one is granted while fewer
-- than p_limit are open, and refused (not raised) after, so a reader at the
-- limit sees a paywall rather than an error.

create or replace function public.unlock_topper_copy(
  p_uid     text,
  p_subject text,
  p_copy_id text,
  p_limit   integer
) returns table (out_granted boolean, out_used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_have boolean;
begin
  if coalesce(p_uid, '') = '' or coalesce(p_copy_id, '') = '' then
    return query select false, 0;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('topperunlock:uid:' || p_uid));

  select exists (
    select 1 from topper_unlocks u
     where u.firebase_uid = p_uid and u.subject = p_subject and u.copy_id = p_copy_id
  ) into v_have;

  select count(*)::int into v_used from topper_unlocks u where u.firebase_uid = p_uid;

  if v_have then
    return query select true, v_used;
  elsif v_used < p_limit then
    insert into topper_unlocks (firebase_uid, subject, copy_id)
    values (p_uid, p_subject, p_copy_id)
    on conflict do nothing;
    return query select true, v_used + 1;
  else
    return query select false, v_used;
  end if;
end;
$$;

-- ── Reading the allowance without spending it ───────────────────────────────
-- The copies this reader has opened in one optional, so the lists can mark
-- them as free to open again, and how many they have opened in all.

create or replace function public.topper_unlock_status(
  p_uid     text,
  p_subject text
) returns table (out_ids text[], out_used integer)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select u.copy_id, u.subject from topper_unlocks u
     where coalesce(p_uid, '') <> '' and u.firebase_uid = p_uid
  )
  select
    coalesce((select array_agg(m.copy_id) from mine m where m.subject = p_subject), '{}'::text[]),
    (select count(*)::int from mine);
$$;

-- A reader who could call these directly could pass any limit they liked.
revoke all on function public.unlock_topper_copy(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.topper_unlock_status(text, text)               from public, anon, authenticated;
grant execute on function public.unlock_topper_copy(text, text, text, integer) to service_role;
grant execute on function public.topper_unlock_status(text, text)               to service_role;

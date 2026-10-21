-- Flashcards, and the free allowance for their answers.
--
-- Same design as the history site, which built it first (its
-- supabase/flashcards.sql and supabase/flashcard_unlocks.sql). Cards live in
-- Postgres rather than the JavaScript bundle: about 1,500 cards across five
-- optionals is roughly 1 MB of text that has no business in a phone's
-- download, and in the database the page fetches an index first and then only
-- the cards actually being studied.
--
-- Fronts are free to browse. Answers are metered: a reader may open any
-- hundred, whichever hundred they choose, and after that they need a
-- subscription to the optional the card belongs to. A subscription buys one
-- optional, so a sociology subscriber opening a geography card spends the
-- allowance like anyone else (lib/entitlements.ts).
--
-- Differences from the history site:
--   * Five decks in one table, told apart by `subject`, the notes subject slug
--     (sociology, anthropology, polsci, geography, pub-admin).
--   * A card can serve more than one notes topic (`topics`), and records the
--     past questions it helps answer (`questions`, ids in
--     public/data/<subject>-pyqs.json) and the years they were asked.
--   * The allowance is keyed on the Firebase uid alone. Every page here needs
--     an account, and this site deliberately stopped trusting a
--     client-supplied fingerprint for metering (lib/usageIdentity.ts).
--
-- Run once, inside a transaction. Safe to re-run.

create table if not exists public.flashcards (
  -- Text ids from the decks, e.g. 'soc-01-03'. The study page keys its
  -- spaced-repetition state on them in localStorage, so they must not change.
  id         text primary key,
  subject    text     not null,
  topic      text     not null,            -- the notes slug the card is filed under
  topics     text[]   not null default '{}',-- every notes topic it serves
  type       text     not null,
  front      text     not null,
  back       text     not null,
  questions  integer[]  not null default '{}',
  asked      smallint[] not null default '{}',
  status     text     not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint flashcards_subject_check check (subject in ('sociology','anthropology','polsci','geography','pub-admin')),
  constraint flashcards_type_check    check (type in ('thinker','concept','comparison','critique','study','fact')),
  constraint flashcards_status_check  check (status in ('draft','published','archived'))
);

create index if not exists flashcards_status_subject_idx on public.flashcards (status, subject);
create index if not exists flashcards_topics_idx         on public.flashcards using gin (topics);

-- Its own name: this database already has a set_updated_at() that other
-- tables may rely on, and create-or-replace would silently redefine it.
create or replace function public.flashcards_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists flashcards_touch_updated_at on public.flashcards;
create trigger flashcards_touch_updated_at
  before update on public.flashcards
  for each row execute function public.flashcards_touch_updated_at();

alter table public.flashcards enable row level security;

drop policy if exists "read published flashcards" on public.flashcards;
create policy "read published flashcards" on public.flashcards
  as permissive for select to anon, authenticated
  using (status = 'published');

drop policy if exists "service role manages flashcards" on public.flashcards;
create policy "service role manages flashcards" on public.flashcards
  as permissive for all to service_role
  using (true) with check (true);

-- ── The answers must not be readable with the public key ───────────────────
-- The anon key ships in every browser, and Supabase grants anon select on new
-- tables. Row level security works on rows, so it cannot hide a column, and
-- revoking select on the two answer columns alone does nothing while the
-- table-level grant covers every column. So the table-level grant goes and the
-- public columns are granted back. `status` stays because queries filter on
-- it. lib/flashcardStore.ts reads answers with the service key, after the
-- reveal route has decided the reader may have them.

revoke all on public.flashcards from anon, authenticated;
grant select (id, subject, topic, topics, type, front, questions, asked, status, created_at, updated_at)
  on public.flashcards to anon, authenticated;

-- Grants are written out because Supabase stopped granting new tables to the
-- API roles on 30 October 2026. The answers and the seed script
-- (scripts/seed-flashcards.mjs) go through the service key.
grant select, insert, update, delete on public.flashcards to service_role;

-- ── Unlocks ─────────────────────────────────────────────────────────────────
-- The allowance is a set of cards, not a count: spaced repetition shows the
-- same card again and again, and re-opening one already unlocked must cost
-- nothing, or a hundred unlocks would be gone in a week of revision.

create table if not exists public.flashcard_unlocks (
  id           bigserial primary key,
  firebase_uid text not null,
  card_id      text not null references public.flashcards(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint flashcard_unlocks_uid_check check (firebase_uid <> ''),
  constraint flashcard_unlocks_uid_card_key unique (firebase_uid, card_id)
);

alter table public.flashcard_unlocks enable row level security;

drop policy if exists "service role manages flashcard unlocks" on public.flashcard_unlocks;
create policy "service role manages flashcard unlocks" on public.flashcard_unlocks
  as permissive for all to service_role
  using (true) with check (true);

revoke all on public.flashcard_unlocks from anon, authenticated;
grant select, insert, update, delete on public.flashcard_unlocks to service_role;
grant usage, select on sequence public.flashcard_unlocks_id_seq to service_role;

-- ── Spending the allowance ──────────────────────────────────────────────────
-- One row per requested card: whether the reader may see its answer. Cards
-- already unlocked cost nothing, new ones cost one each until the limit, after
-- which they come back denied rather than raising, so a reader at the limit
-- sees a paywall and not an error. The check and the insert run under an
-- advisory lock on the reader, because a select-then-insert race would hand
-- an unbounded allowance to anyone firing requests in parallel.

create or replace function public.unlock_flashcards(
  p_uid   text,
  p_ids   text[],
  p_limit integer
) returns table (out_card_id text, out_granted boolean, out_used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_have  text[];
  v_used  integer;
  v_valid text[];
  v_id    text;
begin
  if coalesce(p_uid, '') = '' then
    return query select unnest(coalesce(p_ids, '{}'::text[])), false, 0;
    return;
  end if;

  select coalesce(array_agg(f.id), '{}'::text[])
    into v_valid
    from flashcards f
   where f.id = any(coalesce(p_ids, '{}'::text[])) and f.status = 'published';

  perform pg_advisory_xact_lock(hashtext('fcunlock:uid:' || p_uid));

  select coalesce(array_agg(u.card_id), '{}'::text[])
    into v_have
    from flashcard_unlocks u
   where u.firebase_uid = p_uid;

  v_used := coalesce(array_length(v_have, 1), 0);

  foreach v_id in array coalesce(p_ids, '{}'::text[]) loop
    if v_id = any(v_have) then
      out_card_id := v_id; out_granted := true;
    elsif not (v_id = any(v_valid)) then
      out_card_id := v_id; out_granted := false;
    elsif v_used < p_limit then
      insert into flashcard_unlocks (firebase_uid, card_id)
      values (p_uid, v_id)
      on conflict do nothing;
      v_have := v_have || v_id;
      v_used := v_used + 1;
      out_card_id := v_id; out_granted := true;
    else
      out_card_id := v_id; out_granted := false;
    end if;
    out_used := v_used;
    return next;
  end loop;
end;
$$;

-- ── Reading the allowance without spending it ───────────────────────────────
-- The study page prefetches cards ahead of the reader, and answers already
-- unlocked should arrive with them, but nothing ahead may be charged. Exactly
-- one row, so the count survives even when none of the asked ids is unlocked.

create or replace function public.flashcard_unlock_status(
  p_uid text,
  p_ids text[]
) returns table (out_ids text[], out_used integer)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select u.card_id from flashcard_unlocks u
     where coalesce(p_uid, '') <> '' and u.firebase_uid = p_uid
  )
  select
    coalesce((select array_agg(m.card_id) from mine m where p_ids is null or m.card_id = any(p_ids)), '{}'::text[]),
    (select count(*)::int from mine);
$$;

-- A reader who could call these directly could pass any limit they liked.
revoke all on function public.unlock_flashcards(text, text[], integer) from public, anon, authenticated;
revoke all on function public.flashcard_unlock_status(text, text[])    from public, anon, authenticated;
grant execute on function public.unlock_flashcards(text, text[], integer) to service_role;
grant execute on function public.flashcard_unlock_status(text, text[])    to service_role;

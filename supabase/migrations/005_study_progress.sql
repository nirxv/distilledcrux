-- Study progress that follows the reader instead of the browser.
--
-- Syllabus ticks and PYQ attempts live in localStorage, so a reader who opens
-- the site on a second device sees an empty dashboard, and one who clears the
-- browser loses it all. Both are small, append-mostly documents, which makes
-- them safe to sync whole rather than as event streams. The `store` column
-- leaves room for more stores later without a migration.
--
-- Merge, not replace: /api/progress unions the server's copy with the
-- browser's and keeps the earliest date for anything in both, so ticks on a
-- phone and different ticks on a laptop both survive (lib/progressMerge.ts).
-- The known cost of a union: un-ticking does not propagate. Untick on one
-- device and another holding the old document restores it on its next sync.
-- Ticking is by far the common action and losing a completion is the worse
-- failure; per-item tombstones would fix it properly.
--
-- Writes are deliberately rare: the client syncs on sign-in and when the tab
-- is hidden, not on every tick.
--
-- Same table and rules as the history site, which wrote it first.
--
-- Run once, via scripts/db-setup.sh.

create table if not exists public.study_progress (
  firebase_uid text        not null,
  store        text        not null,
  data         jsonb       not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),

  primary key (firebase_uid, store),

  -- Whitelisted so a client cannot invent stores and use the table as free
  -- key-value storage.
  constraint study_progress_store_check check (store in ('syllabus', 'pyq'))
);

create index if not exists study_progress_updated_idx on public.study_progress (updated_at desc);

-- Keep updated_at honest without every caller remembering to set it. Defined
-- here: the only similar function in this database belongs to Supabase's own
-- storage schema, which is not ours to depend on.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_progress_set_updated_at on public.study_progress;
create trigger study_progress_set_updated_at
  before update on public.study_progress
  for each row execute function public.set_updated_at();

-- Read and written only through /api/progress, which verifies the Firebase
-- token. The anon key ships in the browser, so leaving this readable would let
-- anyone enumerate every reader's study history by uid.
alter table public.study_progress enable row level security;

drop policy if exists "service role manages study progress" on public.study_progress;
create policy "service role manages study progress" on public.study_progress
  as permissive for all to service_role
  using (true) with check (true);

revoke all on public.study_progress from anon, authenticated;

-- Two tables the site's front end has always assumed existed.
--
-- app/contact posts to /api/contact and every PYQ detail page reads and writes
-- /api/pyq-answers. Neither route was ever written in this project, so both
-- features have been posting into a 404 since the pages were built. The routes
-- exist now; these are the tables behind them.
--
-- Run once in the Supabase SQL editor.

-- ── Contact form ────────────────────────────────────────────────────────────
create table if not exists public.contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  email      text        not null,
  -- One of the six options the form offers. The route checks it against that
  -- list, so anything else never reaches here.
  topic      text        not null,
  message    text        not null,
  created_at timestamptz not null default now()
);

-- Only the service role touches this. Messages carry email addresses, so no
-- anon policy is granted and none should be.
alter table public.contact_submissions enable row level security;

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);


-- ── Community answers on a PYQ ──────────────────────────────────────────────
create table if not exists public.pyq_answers (
  id            uuid primary key default gen_random_uuid(),
  -- Answer ids are only unique within a subject, so both columns are needed to
  -- identify a question. Reading /sociology/pyqs/12 must not return the answers
  -- posted on /geography/pyqs/12.
  subject       text        not null,
  pyq_id        integer     not null,
  display_name  text        not null,
  storage_path  text        not null unique,
  answer_number integer     not null,
  -- Posting is anonymous by design: answers are shared under a display name,
  -- not an account. A signed-in uploader is recorded anyway so an answer can be
  -- traced or removed later.
  firebase_uid  text,
  created_at    timestamptz not null default now()
);

alter table public.pyq_answers enable row level security;

create index if not exists pyq_answers_question_idx
  on public.pyq_answers (subject, pyq_id, created_at);

create index if not exists pyq_answers_uploader_idx
  on public.pyq_answers (firebase_uid)
  where firebase_uid is not null;

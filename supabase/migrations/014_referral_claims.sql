-- The invite code a reader arrived with, saved to their account the first
-- time they are signed in with it, so the friend's ₹100 off follows them to
-- any device. Before this the code lived only in the browser that opened the
-- link, and a friend who opened it on a phone but bought on a laptop paid
-- full price.
--
-- One row per reader: the first code saved wins, as in the browser. A row is
-- only a claim; the checkout still checks that the code is someone else's,
-- that the reader has never been referred, and that they have never bought a
-- yearly plan. Nothing is readable or writable with the public key.
--
-- Run once, inside a transaction. Safe to re-run.

create table if not exists public.referral_claims (
  firebase_uid text        primary key,
  code         text        not null references public.referral_codes (code),
  claimed_at   timestamptz not null default now()
);

alter table public.referral_claims enable row level security;
revoke all on public.referral_claims from anon, authenticated;
grant select, insert, update, delete on public.referral_claims to service_role;

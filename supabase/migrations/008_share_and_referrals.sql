-- Shared answer-check cards, and referrals.
--
-- Sharing. Answer checks are not stored here, so a card is stored only when a
-- reader shares one. /api/evaluate signs the card's contents (question, marks,
-- marks per part, a few lines of feedback, never the answer); /api/share
-- checks that signature, so nobody can publish a score the site did not give,
-- and saves the card under a random share_id. token_hash makes sharing the same
-- check twice return the same card. Deleting the row takes the page down.
--
-- Referrals. Each reader gets a short code on first asking for their invite
-- link. When a friend makes their first purchase of the 6-month or yearly plan
-- through it, the friend gets extra days on the optional they bought, and the
-- reader who invited them gets extra days too. apply_referral does both in one
-- transaction, and the unique keys on referrals make a repeat call a no-op.
-- /api/payment/verify decides eligibility (first purchase, plan) before
-- calling it.
--
-- Only the server reads or writes these, with the service key.

create table if not exists shared_checks (
  share_id     text        primary key,
  token_hash   text        not null unique,
  firebase_uid text        not null,
  card         jsonb       not null,
  created_at   timestamptz not null default now()
);

create index if not exists shared_checks_uid_idx on shared_checks (firebase_uid);

create table if not exists referral_codes (
  code         text        primary key,
  firebase_uid text        not null unique,
  created_at   timestamptz not null default now()
);

create table if not exists referrals (
  id             bigserial   primary key,
  code           text        not null references referral_codes (code),
  referrer_uid   text        not null,
  referred_uid   text        not null unique,
  order_id       text        not null unique,
  plan           text        not null,
  optional       text        not null,
  referrer_days  integer     not null,
  referred_days  integer     not null,
  created_at     timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on referrals (referrer_uid);

alter table shared_checks  enable row level security;
alter table referral_codes enable row level security;
alter table referrals      enable row level security;

revoke all on shared_checks, referral_codes, referrals from anon, authenticated;
grant select, insert, update, delete on shared_checks, referral_codes, referrals to service_role;
grant usage, select on sequence referrals_id_seq to service_role;

-- Returns {"result": "applied", "expires_at": <buyer's new expiry>} or
-- {"result": <why not>}. Called right after the buyer's grant, so their row
-- for the optional they bought already holds the new plan.
--
-- subscriptions is keyed on firebase_uid alone: one row per reader. The
-- inviter's live plan is extended on whatever optional it covers. If it has
-- run out, or there is none, the row moves to the optional on their profile
-- (the buyer's, if their profile has none) as a 'referral' plan.
create or replace function apply_referral(
  p_code           text,
  p_order_id       text,
  p_buyer_uid      text,
  p_buyer_optional text,
  p_plan           text,
  p_referrer_days  integer,
  p_referred_days  integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer     text;
  v_ref_optional text;
  v_expires      timestamptz;
begin
  select firebase_uid into v_referrer from referral_codes where code = upper(p_code);
  if v_referrer is null then return jsonb_build_object('result', 'unknown_code'); end if;
  if v_referrer = p_buyer_uid then return jsonb_build_object('result', 'own_code'); end if;

  insert into referrals (code, referrer_uid, referred_uid, order_id, plan, optional, referrer_days, referred_days)
  values (upper(p_code), v_referrer, p_buyer_uid, p_order_id, p_plan, p_buyer_optional, p_referrer_days, p_referred_days)
  on conflict do nothing;
  if not found then return jsonb_build_object('result', 'already_referred'); end if;

  update subscriptions
     set expires_at = greatest(expires_at, now()) + make_interval(days => p_referred_days),
         updated_at = now()
   where firebase_uid = p_buyer_uid and optional = p_buyer_optional
  returning expires_at into v_expires;

  select coalesce(optional, p_buyer_optional) into v_ref_optional from user_profiles where firebase_uid = v_referrer;
  v_ref_optional := coalesce(v_ref_optional, p_buyer_optional);

  insert into subscriptions (firebase_uid, optional, plan, status, expires_at, updated_at)
  values (v_referrer, v_ref_optional, 'referral', 'active', now() + make_interval(days => p_referrer_days), now())
  on conflict (firebase_uid) do update
     set expires_at = case when subscriptions.expires_at > now()
                           then subscriptions.expires_at + make_interval(days => p_referrer_days)
                           else now() + make_interval(days => p_referrer_days) end,
         optional   = case when subscriptions.expires_at > now() then subscriptions.optional else excluded.optional end,
         plan       = case when subscriptions.expires_at > now() then subscriptions.plan else 'referral' end,
         status     = 'active',
         updated_at = now();

  return jsonb_build_object('result', 'applied', 'expires_at', v_expires);
end;
$$;

revoke all on function apply_referral(text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function apply_referral(text, text, text, text, text, integer, integer) to service_role;

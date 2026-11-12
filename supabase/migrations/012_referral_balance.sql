-- Invite rewards in money instead of days.
--
-- A friend who comes through a reader's link and buys their first yearly plan
-- pays ₹100 less, and the reader gets ₹100 in a balance. The balance is spent
-- as money off a yearly plan, or, for a reader who has bought one, cashed out
-- to UPI. The days reward of migrations 008 and 009 stops: apply_referral is
-- left in place but nothing calls it any more.
--
-- The rules:
--
--   Before a reader has bought a yearly plan, the balance can grow up to the
--   yearly list price and is only money off their own yearly plan.
--
--   Each yearly purchase opens an earning window. Its cap is what that
--   payment brought in after Razorpay's fee and the GST on it, rounded down
--   to the rupee, and earnings in the window stop at the cap. A later yearly
--   purchase opens a new window from zero. Day and 6-month plans and topper
--   copy passes never open one. A yearly plan paid wholly from the balance
--   opens a window with a cap of zero.
--
--   Cash-out opens when a window's earnings reach ₹1,000, ₹2,000 and ₹3,000
--   (each only if below the cap) and the cap itself. Each time one opens, the
--   reader can ask for their whole balance. The request takes the money out of
--   the balance at once; the user pays it by hand from the admin and marks it
--   paid, or cancels it, which puts the money back.
--
-- Every movement is a row in referral_ledger, so a balance is a sum and its
-- history is the rows. Changes to one reader's balance take an advisory lock
-- on that reader, so two requests at once cannot both spend the same rupees.
--
-- New tables are granted to service_role by hand: Supabase stopped doing it
-- for new tables on 30 October 2026. Nothing is readable or callable with the
-- public key. Ids are random uuids, not sequences.
--
-- Run once, inside a transaction. Safe to re-run.

-- ── Plan purchases ──────────────────────────────────────────────────────────
-- Every plan payment, with what Razorpay kept. A yearly row sets its buyer's
-- earning window; the rest are kept so "first yearly purchase" can be read
-- even after a later plan overwrites the subscriptions row.

create table if not exists public.plan_purchases (
  payment_id            text        primary key,
  order_id              text        not null unique,
  firebase_uid          text        not null,
  plan                  text        not null,
  optional              text        not null,
  amount_paise          integer     not null,
  fee_paise             integer     not null default 0,
  tax_paise             integer     not null default 0,
  balance_paise         integer     not null default 0,
  friend_discount_paise integer     not null default 0,
  created_at            timestamptz not null default now(),
  constraint plan_purchases_plan_check   check (plan in ('daily', 'sixmonth', 'yearly')),
  constraint plan_purchases_amount_check check (amount_paise >= 0 and fee_paise >= 0 and tax_paise >= 0 and balance_paise >= 0 and friend_discount_paise >= 0)
);

create index if not exists plan_purchases_buyer_idx on public.plan_purchases (firebase_uid, plan, created_at desc);

-- ── The ledger ──────────────────────────────────────────────────────────────
-- amount_paise is signed: earn and payout_reversed add, spend and payout take.

create table if not exists public.referral_ledger (
  id                uuid        primary key default gen_random_uuid(),
  firebase_uid      text        not null,
  kind              text        not null,
  amount_paise      integer     not null,
  window_payment_id text,
  order_id          text,
  referred_uid      text,
  payout_id         uuid,
  created_at        timestamptz not null default now(),
  constraint referral_ledger_kind_check check (kind in ('earn', 'spend', 'payout', 'payout_reversed'))
);

create index if not exists referral_ledger_uid_idx on public.referral_ledger (firebase_uid, created_at desc);
-- One reward per friend's order, one spend per own order, one reversal per payout.
create unique index if not exists referral_ledger_order_once  on public.referral_ledger (kind, order_id)  where order_id  is not null;
create unique index if not exists referral_ledger_payout_once on public.referral_ledger (kind, payout_id) where payout_id is not null;

-- ── Cash-out requests ───────────────────────────────────────────────────────

create table if not exists public.referral_payouts (
  id                uuid        primary key default gen_random_uuid(),
  firebase_uid      text        not null,
  email             text        not null default '',
  amount_paise      integer     not null,
  upi_id            text        not null,
  window_payment_id text        not null,
  milestone_paise   integer     not null,
  status            text        not null default 'requested',
  requested_at      timestamptz not null default now(),
  settled_at        timestamptz,
  note              text,
  constraint referral_payouts_amount_check check (amount_paise > 0),
  constraint referral_payouts_status_check check (status in ('requested', 'paid', 'cancelled'))
);

create index if not exists referral_payouts_uid_idx    on public.referral_payouts (firebase_uid, requested_at desc);
create index if not exists referral_payouts_status_idx on public.referral_payouts (status, requested_at);

alter table public.plan_purchases   enable row level security;
alter table public.referral_ledger  enable row level security;
alter table public.referral_payouts enable row level security;

revoke all on public.plan_purchases, public.referral_ledger, public.referral_payouts from anon, authenticated;
grant select, insert, update, delete on public.plan_purchases, public.referral_ledger, public.referral_payouts to service_role;

-- ── The reader's current earning window ─────────────────────────────────────
-- Their latest yearly purchase and its cap: the payment less Razorpay's fee
-- and the GST on it, rounded down to the rupee. No row before the first.

create or replace function public.referral_window(p_uid text)
returns table (payment_id text, cap_paise integer, opened_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.payment_id,
         greatest(0, ((p.amount_paise - p.fee_paise - p.tax_paise) / 100) * 100),
         p.created_at
    from plan_purchases p
   where p.firebase_uid = p_uid and p.plan = 'yearly'
   order by p.created_at desc
   limit 1;
$$;

-- ── Crediting the referrer ──────────────────────────────────────────────────
-- Called once the friend's discounted yearly payment is verified. Records the
-- referral (a friend counts once, ever), then credits as much of the reward as
-- the referrer has room for: up to their window's cap, or, with no window yet,
-- up to p_free_cap_paise in balance.

create or replace function public.credit_referral(
  p_code             text,
  p_order_id         text,
  p_buyer_uid        text,
  p_buyer_optional   text,
  p_reward_paise     integer,
  p_free_cap_paise   integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer text;
  v_win_id   text;
  v_cap      integer;
  v_room     integer;
  v_credit   integer;
begin
  select firebase_uid into v_referrer from referral_codes where code = upper(p_code);
  if v_referrer is null then return jsonb_build_object('result', 'unknown_code'); end if;
  if v_referrer = p_buyer_uid then return jsonb_build_object('result', 'own_code'); end if;

  insert into referrals (code, referrer_uid, referred_uid, order_id, plan, optional, referrer_days, referred_days)
  values (upper(p_code), v_referrer, p_buyer_uid, p_order_id, 'yearly', p_buyer_optional, 0, 0)
  on conflict do nothing;
  if not found then return jsonb_build_object('result', 'already_referred'); end if;

  perform pg_advisory_xact_lock(hashtext('refbal:' || v_referrer));

  select w.payment_id, w.cap_paise into v_win_id, v_cap from referral_window(v_referrer) w;
  if v_win_id is not null then
    select v_cap - coalesce(sum(l.amount_paise), 0) into v_room
      from referral_ledger l
     where l.firebase_uid = v_referrer and l.kind = 'earn' and l.window_payment_id = v_win_id;
  else
    select p_free_cap_paise - coalesce(sum(l.amount_paise), 0) into v_room
      from referral_ledger l
     where l.firebase_uid = v_referrer;
  end if;

  v_credit := greatest(0, least(p_reward_paise, v_room));
  if v_credit > 0 then
    insert into referral_ledger (firebase_uid, kind, amount_paise, window_payment_id, order_id, referred_uid)
    values (v_referrer, 'earn', v_credit, v_win_id, p_order_id, p_buyer_uid)
    on conflict do nothing;
  end if;

  return jsonb_build_object('result', 'applied', 'credited_paise', v_credit);
end;
$$;

-- ── Spending the balance on a paid order ────────────────────────────────────
-- The order was priced with this much off when it was made; the money comes
-- out when the payment is verified. Once per order. A balance spent twice by
-- two orders paid at the same moment can dip below zero; later rewards refill it.

create or replace function public.spend_referral_balance(
  p_uid          text,
  p_order_id     text,
  p_amount_paise integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_amount_paise, 0) <= 0 then return jsonb_build_object('result', 'nothing'); end if;
  perform pg_advisory_xact_lock(hashtext('refbal:' || p_uid));
  insert into referral_ledger (firebase_uid, kind, amount_paise, order_id)
  values (p_uid, 'spend', -p_amount_paise, p_order_id)
  on conflict do nothing;
  if not found then return jsonb_build_object('result', 'already_spent'); end if;
  return jsonb_build_object('result', 'spent');
end;
$$;

-- ── A plan paid wholly from the balance ─────────────────────────────────────
-- No Razorpay order exists, so the money comes out and the plan is granted in
-- one transaction, after checking the balance still covers it. p_order_id is
-- our own id for the purchase. The purchase row has an amount of zero, so a
-- yearly plan bought this way opens a window with a cap of zero.

create or replace function public.grant_plan_from_balance(
  p_uid                   text,
  p_email                 text,
  p_optional              text,
  p_plan                  text,
  p_days                  integer,
  p_spend_paise           integer,
  p_friend_discount_paise integer,
  p_order_id              text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_current timestamptz;
  v_expires timestamptz;
begin
  if coalesce(p_spend_paise, 0) <= 0 or coalesce(p_days, 0) <= 0 then
    raise exception 'grant_plan_from_balance: nothing to spend or no length';
  end if;

  perform pg_advisory_xact_lock(hashtext('refbal:' || p_uid));

  select coalesce(sum(amount_paise), 0) into v_balance from referral_ledger where firebase_uid = p_uid;
  if v_balance < p_spend_paise then return jsonb_build_object('result', 'balance_changed'); end if;

  insert into referral_ledger (firebase_uid, kind, amount_paise, order_id)
  values (p_uid, 'spend', -p_spend_paise, p_order_id);

  select expires_at into v_current from subscriptions where firebase_uid = p_uid and optional = p_optional;
  v_expires := greatest(now(), coalesce(v_current, now())) + make_interval(days => p_days);

  insert into subscriptions (firebase_uid, email, plan, optional, status, expires_at, razorpay_order_id, razorpay_payment_id, updated_at)
  values (p_uid, coalesce(p_email, ''), p_plan, p_optional, 'active', v_expires, p_order_id, p_order_id, now())
  on conflict (firebase_uid, optional) do update
     set email               = excluded.email,
         plan                = excluded.plan,
         status              = 'active',
         expires_at          = excluded.expires_at,
         razorpay_order_id   = excluded.razorpay_order_id,
         razorpay_payment_id = excluded.razorpay_payment_id,
         updated_at          = now();

  insert into plan_purchases (payment_id, order_id, firebase_uid, plan, optional, amount_paise, balance_paise, friend_discount_paise)
  values (p_order_id, p_order_id, p_uid, p_plan, p_optional, 0, p_spend_paise, coalesce(p_friend_discount_paise, 0));

  return jsonb_build_object('result', 'granted', 'expires_at', v_expires);
end;
$$;

-- ── Asking for a cash-out ───────────────────────────────────────────────────
-- 'requested' with the amount (the whole balance), or why not: no window,
-- a request already waiting, no milestone open, or nothing to pay.

create or replace function public.request_referral_payout(
  p_uid   text,
  p_email text,
  p_upi   text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_win_id    text;
  v_cap       integer;
  v_earned    integer;
  v_reached   integer;
  v_used      integer;
  v_balance   integer;
  v_milestone integer;
  v_id        uuid;
begin
  if coalesce(p_upi, '') = '' then raise exception 'request_referral_payout: no UPI id'; end if;

  perform pg_advisory_xact_lock(hashtext('refbal:' || p_uid));

  select w.payment_id, w.cap_paise into v_win_id, v_cap from referral_window(p_uid) w;
  if v_win_id is null or v_cap <= 0 then return jsonb_build_object('result', 'no_window'); end if;

  if exists (select 1 from referral_payouts where firebase_uid = p_uid and status = 'requested') then
    return jsonb_build_object('result', 'pending');
  end if;

  select coalesce(sum(amount_paise), 0) into v_earned
    from referral_ledger
   where firebase_uid = p_uid and kind = 'earn' and window_payment_id = v_win_id;

  select count(*) into v_used
    from referral_payouts
   where firebase_uid = p_uid and window_payment_id = v_win_id and status <> 'cancelled';

  -- The milestones in order: ₹1,000, ₹2,000, ₹3,000 below the cap, then the cap.
  with m as (
    select x as at from unnest(array[100000, 200000, 300000]) as u(x) where x < v_cap
    union all
    select v_cap
  )
  select count(*) filter (where at <= v_earned),
         (select at from m order by at offset v_used limit 1)
    into v_reached, v_milestone
    from m;

  if v_reached <= v_used then return jsonb_build_object('result', 'not_yet'); end if;

  select coalesce(sum(amount_paise), 0) into v_balance from referral_ledger where firebase_uid = p_uid;
  if v_balance <= 0 then return jsonb_build_object('result', 'empty'); end if;

  insert into referral_payouts (firebase_uid, email, amount_paise, upi_id, window_payment_id, milestone_paise)
  values (p_uid, coalesce(p_email, ''), v_balance, p_upi, v_win_id, v_milestone)
  returning id into v_id;

  insert into referral_ledger (firebase_uid, kind, amount_paise, payout_id)
  values (p_uid, 'payout', -v_balance, v_id);

  return jsonb_build_object('result', 'requested', 'id', v_id, 'amount_paise', v_balance);
end;
$$;

-- ── Settling a cash-out ─────────────────────────────────────────────────────
-- From the admin: 'paid' once the money is sent, or 'cancelled', which puts
-- it back in the balance and frees the milestone. Only a waiting request moves.

create or replace function public.settle_referral_payout(
  p_id     uuid,
  p_status text,
  p_note   text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    text;
  v_amount integer;
begin
  if p_status not in ('paid', 'cancelled') then raise exception 'settle_referral_payout: bad status %', p_status; end if;

  update referral_payouts
     set status = p_status, settled_at = now(), note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_id and status = 'requested'
  returning firebase_uid, amount_paise into v_uid, v_amount;
  if not found then return jsonb_build_object('result', 'not_waiting'); end if;

  if p_status = 'cancelled' then
    perform pg_advisory_xact_lock(hashtext('refbal:' || v_uid));
    insert into referral_ledger (firebase_uid, kind, amount_paise, payout_id)
    values (v_uid, 'payout_reversed', v_amount, p_id);
  end if;

  return jsonb_build_object('result', p_status);
end;
$$;

revoke all on function public.referral_window(text)                                                          from public, anon, authenticated;
revoke all on function public.credit_referral(text, text, text, text, integer, integer)                      from public, anon, authenticated;
revoke all on function public.spend_referral_balance(text, text, integer)                                    from public, anon, authenticated;
revoke all on function public.grant_plan_from_balance(text, text, text, text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.request_referral_payout(text, text, text)                                      from public, anon, authenticated;
revoke all on function public.settle_referral_payout(uuid, text, text)                                       from public, anon, authenticated;

grant execute on function public.referral_window(text)                                                          to service_role;
grant execute on function public.credit_referral(text, text, text, text, integer, integer)                      to service_role;
grant execute on function public.spend_referral_balance(text, text, integer)                                    to service_role;
grant execute on function public.grant_plan_from_balance(text, text, text, text, integer, integer, integer, text) to service_role;
grant execute on function public.request_referral_payout(text, text, text)                                      to service_role;
grant execute on function public.settle_referral_payout(uuid, text, text)                                       to service_role;

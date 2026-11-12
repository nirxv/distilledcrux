-- Cash-outs are read and settled in the Supabase table editor, not an admin
-- view (the CMS is gone). The owner asked for a table they can check
-- themselves, with the reader's UPI id and mobile number.
--
-- referral_payouts is rebuilt so the columns a person needs come first:
-- status, name, phone, UPI id, the amount in rupees, a note for the UPI
-- reference. It was created empty by migration 012 and nothing has been
-- written to it, which the first statement checks before dropping anything.
--
-- Settling is done by changing status:
--   'paid'       once the money is sent; settled_at is stamped.
--   'cancelled'  puts the money back in the reader's balance.
-- A trigger does both, and refuses to move a settled row again or to change
-- the amount or the reader, so the table cannot drift from the ledger by a
-- slip in the editor. settle_referral_payout is dropped: nothing calls it.
--
-- request_referral_payout now takes the reader's name and mobile number.
--
-- Run once, inside a transaction.

do $$
begin
  if exists (select 1 from public.referral_payouts) then
    raise exception 'referral_payouts has rows; this migration expects it empty';
  end if;
end $$;

drop function if exists public.settle_referral_payout(uuid, text, text);
drop function if exists public.request_referral_payout(text, text, text);
drop table public.referral_payouts;

create table public.referral_payouts (
  id                uuid        primary key default gen_random_uuid(),
  status            text        not null default 'requested',
  name              text        not null default '',
  phone             text        not null,
  upi_id            text        not null,
  amount_rupees     integer     generated always as (amount_paise / 100) stored,
  note              text,
  email             text        not null default '',
  requested_at      timestamptz not null default now(),
  settled_at        timestamptz,
  firebase_uid      text        not null,
  amount_paise      integer     not null,
  window_payment_id text        not null,
  milestone_paise   integer     not null,
  constraint referral_payouts_amount_check check (amount_paise > 0),
  constraint referral_payouts_status_check check (status in ('requested', 'paid', 'cancelled'))
);

create index referral_payouts_uid_idx    on public.referral_payouts (firebase_uid, requested_at desc);
create index referral_payouts_status_idx on public.referral_payouts (status, requested_at);

alter table public.referral_payouts enable row level security;
revoke all on public.referral_payouts from anon, authenticated;
grant select, insert, update, delete on public.referral_payouts to service_role;

-- ── Asking for a cash-out ───────────────────────────────────────────────────
-- 'requested' with the amount (the whole balance), or why not: no window,
-- a request already waiting, no milestone open, or nothing to pay.

create or replace function public.request_referral_payout(
  p_uid   text,
  p_email text,
  p_name  text,
  p_phone text,
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
  if coalesce(p_upi, '') = '' or coalesce(p_phone, '') = '' then raise exception 'request_referral_payout: no UPI id or phone'; end if;

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

  insert into referral_payouts (firebase_uid, email, name, phone, amount_paise, upi_id, window_payment_id, milestone_paise)
  values (p_uid, coalesce(p_email, ''), coalesce(p_name, ''), p_phone, v_balance, p_upi, v_win_id, v_milestone)
  returning id into v_id;

  insert into referral_ledger (firebase_uid, kind, amount_paise, payout_id)
  values (p_uid, 'payout', -v_balance, v_id);

  return jsonb_build_object('result', 'requested', 'id', v_id, 'amount_paise', v_balance);
end;
$$;

-- ── Settling a cash-out, in the table editor ────────────────────────────────

create or replace function public.referral_payouts_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount_paise is distinct from old.amount_paise or new.firebase_uid is distinct from old.firebase_uid
     or new.window_payment_id is distinct from old.window_payment_id then
    raise exception 'The amount and the reader of a cash-out cannot be edited.';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'requested' then
      raise exception 'This cash-out is already %. It cannot change again.', old.status;
    end if;
    new.settled_at := coalesce(new.settled_at, now());
    if new.status = 'cancelled' then
      perform pg_advisory_xact_lock(hashtext('refbal:' || old.firebase_uid));
      insert into referral_ledger (firebase_uid, kind, amount_paise, payout_id)
      values (old.firebase_uid, 'payout_reversed', old.amount_paise, old.id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger referral_payouts_guard
  before update on public.referral_payouts
  for each row execute function public.referral_payouts_guard();

revoke all on function public.request_referral_payout(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.referral_payouts_guard()                              from public, anon, authenticated;
grant execute on function public.request_referral_payout(text, text, text, text, text) to service_role;

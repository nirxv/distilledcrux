-- Topper copy passes: every topper copy in one optional for a year, bought
-- once for ₹799 without a subscription. The same product as the history
-- site's topper copies purchase, sold per optional because everything here is
-- (a Sociology pass opens Sociology copies only).
--
-- One row per payment, keyed on the Razorpay payment id. That key is the
-- replay guard: a valid checkout signature stays valid forever, and the grant
-- function refuses a payment it has already applied, so posting the same
-- success back again cannot add another year. The history site needed a
-- separate payment_events ledger for this; here the passes are the ledger.
--
-- A pass bought while one is running starts where the old one ends, so buying
-- early never loses time. Access is "any pass for this reader and optional
-- that has not yet expired", read by topper_pass_until.
--
-- Nothing is readable or callable with the public key: the verify route
-- confirms the payment with Razorpay and calls grant_topper_pass with the
-- service key.
--
-- Run once, inside a transaction. Safe to re-run.

create table if not exists public.topper_passes (
  razorpay_payment_id text primary key,
  razorpay_order_id   text        not null,
  firebase_uid        text        not null,
  subject             text        not null,
  email               text        not null default '',
  amount_paise        integer     not null,
  starts_at           timestamptz not null,
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now(),
  constraint topper_passes_uid_check     check (firebase_uid <> ''),
  constraint topper_passes_subject_check check (subject in ('sociology','anthropology','polsci','geography','pub-admin')),
  constraint topper_passes_span_check    check (expires_at > starts_at)
);

create index if not exists topper_passes_reader_idx on public.topper_passes (firebase_uid, subject, expires_at desc);

alter table public.topper_passes enable row level security;

drop policy if exists "service role manages topper passes" on public.topper_passes;
create policy "service role manages topper passes" on public.topper_passes
  as permissive for all to service_role
  using (true) with check (true);

-- Grants are written out because Supabase stopped granting new tables to the
-- API roles on 30 October 2026.
revoke all on public.topper_passes from anon, authenticated;
grant select, insert, update, delete on public.topper_passes to service_role;

-- ── Granting a pass ─────────────────────────────────────────────────────────
-- 'granted' with the new expiry, or 'already_applied' with the expiry this
-- payment gave the first time. Under an advisory lock on the reader, so two
-- payments verified at once cannot both start from the same old expiry.

create or replace function public.grant_topper_pass(
  p_uid        text,
  p_subject    text,
  p_payment_id text,
  p_order_id   text,
  p_amount     integer,
  p_email      text,
  p_days       integer
) returns table (out_status text, out_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_had  timestamptz;
  v_from timestamptz;
  v_to   timestamptz;
begin
  if coalesce(p_uid, '') = '' or coalesce(p_payment_id, '') = '' or coalesce(p_days, 0) <= 0 then
    raise exception 'grant_topper_pass: missing reader, payment or length';
  end if;

  perform pg_advisory_xact_lock(hashtext('topperpass:uid:' || p_uid));

  select t.expires_at into v_had from topper_passes t where t.razorpay_payment_id = p_payment_id;
  if found then
    return query select 'already_applied'::text, v_had;
    return;
  end if;

  select greatest(now(), coalesce(max(t.expires_at), now())) into v_from
    from topper_passes t
   where t.firebase_uid = p_uid and t.subject = p_subject;
  v_to := v_from + make_interval(days => p_days);

  insert into topper_passes (razorpay_payment_id, razorpay_order_id, firebase_uid, subject, email, amount_paise, starts_at, expires_at)
  values (p_payment_id, p_order_id, p_uid, p_subject, coalesce(p_email, ''), p_amount, v_from, v_to);

  return query select 'granted'::text, v_to;
end;
$$;

-- ── Reading a pass ──────────────────────────────────────────────────────────
-- When this reader's pass for this optional runs out, or null if they have none running.

create or replace function public.topper_pass_until(
  p_uid     text,
  p_subject text
) returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(t.expires_at) from topper_passes t
   where coalesce(p_uid, '') <> '' and t.firebase_uid = p_uid and t.subject = p_subject and t.expires_at > now();
$$;

revoke all on function public.grant_topper_pass(text, text, text, text, integer, text, integer) from public, anon, authenticated;
revoke all on function public.topper_pass_until(text, text)                                     from public, anon, authenticated;
grant execute on function public.grant_topper_pass(text, text, text, text, integer, text, integer) to service_role;
grant execute on function public.topper_pass_until(text, text)                                     to service_role;

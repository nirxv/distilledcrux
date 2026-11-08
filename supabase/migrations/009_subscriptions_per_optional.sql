-- One subscription per reader per optional.
--
-- A plan covers one optional, and /api/payment/verify upserts on
-- (firebase_uid, optional). But the primary key was firebase_uid alone, so a
-- reader with a plan on one optional who bought a second got a primary-key
-- error after Razorpay had taken the money, and no plan. The key is now the
-- pair, which is what the code always assumed. Every read already filters by
-- optional or takes the latest row, so nothing else changes.
--
-- apply_referral is redefined for the same reason: it extended "the" row of
-- the inviter, which now can be several.

alter table subscriptions drop constraint subscriptions_pkey;
alter table subscriptions drop constraint subscriptions_firebase_uid_optional_key;
alter table subscriptions add constraint subscriptions_pkey primary key (firebase_uid, optional);

-- The inviter's days go on a live plan: the one for the optional on their
-- profile if that is live, otherwise their longest-running one. With no live
-- plan, they get a 'referral' plan on their profile's optional (the buyer's,
-- if their profile has none).
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
  v_target       text;
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

  select optional into v_ref_optional from user_profiles where firebase_uid = v_referrer;
  v_ref_optional := coalesce(v_ref_optional, p_buyer_optional);

  select optional into v_target from subscriptions
   where firebase_uid = v_referrer and status = 'active' and expires_at > now()
   order by (optional = v_ref_optional) desc, expires_at desc
   limit 1;

  if v_target is not null then
    update subscriptions
       set expires_at = expires_at + make_interval(days => p_referrer_days),
           updated_at = now()
     where firebase_uid = v_referrer and optional = v_target;
  else
    insert into subscriptions (firebase_uid, optional, plan, status, expires_at, updated_at)
    values (v_referrer, v_ref_optional, 'referral', 'active', now() + make_interval(days => p_referrer_days), now())
    on conflict (firebase_uid, optional) do update
       set expires_at = now() + make_interval(days => p_referrer_days),
           plan       = 'referral',
           status     = 'active',
           updated_at = now();
  end if;

  return jsonb_build_object('result', 'applied', 'expires_at', v_expires);
end;
$$;

revoke all on function apply_referral(text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function apply_referral(text, text, text, text, text, integer, integer) to service_role;

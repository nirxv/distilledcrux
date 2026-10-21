-- user_sessions_ist showed every row of user_sessions to the public key.
--
-- A view runs with its owner's rights unless told otherwise, and the owner
-- here is postgres, which row level security does not apply to. So the
-- service-role-only policy on user_sessions did nothing for reads through the
-- view, and anon and authenticated both had select on it: anyone holding the
-- anon key could list every session, with Firebase uid, visitor id, pages,
-- referrer, device and city. Nothing in the app reads the view. It is for the
-- Supabase dashboard, which connects as postgres and is unaffected.
--
-- security_invoker makes the view apply the reader's own rights and
-- policies, and the revoke takes the API roles off it entirely. The view was
-- made in the dashboard rather than in a migration, hence the existence check.

do $$
begin
  if to_regclass('public.user_sessions_ist') is not null then
    alter view public.user_sessions_ist set (security_invoker = on);
    revoke all on public.user_sessions_ist from anon, authenticated;
  end if;
end
$$;

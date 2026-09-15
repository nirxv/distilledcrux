-- Durable rate limiting.
--
-- The limiters were in-memory Maps. Every serverless invocation gets its own,
-- so the counter reset constantly and the limit never actually applied across
-- instances. This moves the state into Postgres, which every instance shares.
--
-- Run once in the Supabase SQL editor.

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);

-- Nothing outside the service role should read or write this.
alter table public.rate_limits enable row level security;

-- Sweeping old windows is cheap and keeps the table from growing without bound.
create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

-- One statement, so two instances arriving together cannot both read the same
-- count and both decide they are under the limit. The upsert does the compare,
-- the reset and the increment atomically, and returns the result.
create or replace function public.bump_rate_limit(
  p_key            text,
  p_window_seconds integer,
  p_limit          integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits%rowtype;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set
      -- Expired window starts over; a live one carries on counting.
      count = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds) then 1
        else rl.count + 1
      end,
      window_start = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds) then v_now
        else rl.window_start
      end
  returning rl.* into v_row;

  return query
    select
      v_row.count <= p_limit,
      greatest(p_limit - v_row.count, 0),
      v_row.window_start + make_interval(secs => p_window_seconds);
end;
$$;

-- Housekeeping for anything long abandoned. Safe to call from a cron job.
create or replace function public.prune_rate_limits(p_older_than_seconds integer default 86400)
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.rate_limits
    where window_start < now() - make_interval(secs => p_older_than_seconds)
    returning 1
  )
  select count(*)::integer from deleted;
$$;

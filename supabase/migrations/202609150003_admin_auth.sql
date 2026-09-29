-- Shared, revocable administrator sessions and fixed-window login limits.
-- Contains no passwords and does not change vehicles, contacts or media.
begin;

create table if not exists public.admin_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  credential_version text not null check (credential_version ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_sessions_expiry on public.admin_sessions(expires_at);

create table if not exists public.admin_login_attempts (
  bucket text primary key check (bucket = 'account:admin' or bucket ~ '^source:[a-f0-9]{64}$'),
  attempts integer not null check (attempts between 1 and 30),
  resets_at timestamptz not null
);
create index if not exists admin_login_attempts_expiry on public.admin_login_attempts(resets_at);

alter table public.admin_sessions enable row level security;
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_sessions, public.admin_login_attempts from public, anon, authenticated, service_role;
grant select, insert, delete on public.admin_sessions to service_role;

create or replace function public.reserve_admin_login_attempt(p_source text, p_admin boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_retry integer;
  v_buckets text[];
begin
  if p_source is null or p_source !~ '^[a-f0-9]{64}$' or p_admin is null then
    raise exception 'Invalid login attempt' using errcode = '22023';
  end if;

  -- One administrator: a short transaction lock makes both bucket reservations
  -- atomic across server instances, including simultaneous first attempts.
  perform pg_catalog.pg_advisory_xact_lock(2076582761, 1);
  v_now := pg_catalog.clock_timestamp();
  delete from public.admin_login_attempts where resets_at <= v_now;
  delete from public.admin_sessions where expires_at <= v_now;
  v_buckets := array['source:' || p_source];
  if p_admin then v_buckets := pg_catalog.array_append(v_buckets, 'account:admin'); end if;

  select coalesce(max(ceil(extract(epoch from (resets_at - v_now)))), 0)::integer
    into v_retry
    from public.admin_login_attempts
    where bucket = any(v_buckets)
      and attempts >= case when bucket = 'account:admin' then 30 else 5 end;
  if v_retry > 0 then return least(v_retry, 900); end if;

  insert into public.admin_login_attempts(bucket, attempts, resets_at)
    select b, 1, v_now + interval '15 minutes' from pg_catalog.unnest(v_buckets) as b
    on conflict (bucket) do update set attempts = public.admin_login_attempts.attempts + 1;
  -- A refused request never extends the window or consumes another bucket.
  return 0;
end;
$$;

revoke all on function public.reserve_admin_login_attempt(text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_admin_login_attempt(text, boolean) to service_role;

commit;

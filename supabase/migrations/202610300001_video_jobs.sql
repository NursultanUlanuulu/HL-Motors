begin;
create table public.video_jobs (
  id uuid primary key,
  input_key text not null unique,
  output_key text not null unique,
  filename text not null,
  input_size bigint not null check (input_size between 1 and 524288000),
  status text not null default 'uploading' check (status in ('uploading','queued','processing','ready','failed')),
  attempts integer not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  output_size bigint,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  input_deleted boolean not null default false
);
create index video_jobs_queue on public.video_jobs(status, created_at);
alter table public.video_jobs enable row level security;
revoke all on public.video_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.video_jobs to service_role;
create policy video_jobs_server_access on public.video_jobs to service_role using(true) with check(true);
commit;

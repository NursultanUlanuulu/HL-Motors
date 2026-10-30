begin;
-- Hide finished jobs from the admin picker without removing media or cleanup records.
alter table public.video_jobs add column dismissed_at timestamptz;
commit;

-- Run once in Supabase SQL Editor. No destructive changes to existing tables.
begin;

create table if not exists public.vehicles (
  id text primary key,
  data jsonb not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_id_matches check (data ->> 'id' = id),
  constraint vehicle_document check (jsonb_typeof(data) = 'object'),
  constraint vehicle_price check ((data ->> 'price')::numeric > 0),
  constraint vehicle_status check (data ->> 'status' in ('В наличии', 'В пути', 'Под заказ'))
);

create table if not exists public.site_settings (
  id text primary key check (id = 'main'),
  contacts jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.bump_vehicle_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists vehicles_version on public.vehicles;
create trigger vehicles_version before update on public.vehicles
for each row execute function public.bump_vehicle_version();

create index if not exists vehicles_created_order on public.vehicles(created_at desc, id);
create index if not exists vehicles_brand on public.vehicles((data ->> 'brand'));
create index if not exists vehicles_year on public.vehicles(((data ->> 'year')::integer));

alter table public.vehicles enable row level security;
alter table public.site_settings enable row level security;
-- The Next.js server checks the existing admin session. Browsers cannot write directly.
revoke all on public.vehicles, public.site_settings from anon, authenticated;
grant all on public.vehicles, public.site_settings to service_role;

insert into public.site_settings(id, contacts) values
('main', '{"whatsapp":"996502102270","telegram":"nur6ultan","email":"hello@hlmotors.com"}')
on conflict (id) do nothing;

-- Car media is publicly viewable; uploads require server-issued signed upload URLs.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-media', 'vehicle-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

commit;

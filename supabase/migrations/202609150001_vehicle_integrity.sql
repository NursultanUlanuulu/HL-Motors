-- Strengthen the document boundary without deleting or rewriting legacy data.
-- NOT VALID enforces all new inserts/updates while allowing inspection and manual
-- repair of old records. Validate the constraint after the query below is empty.
begin;

create or replace function public.is_valid_vehicle_document(document jsonb, vehicle_id text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  field text;
  fields jsonb;
  locale text;
  source jsonb;
  max_length integer;
  amount numeric;
  release_year numeric;
  allowed_fields text[] := array['id','brand','model','trim','mileage','city','power','drive','body','color','transmission','engine','price','year','status','condition','image','vin','customsType','translations','gallery','video'];
  text_fields text[] := array['brand','model','trim','mileage','city','power','drive','body','color','transmission','engine'];
begin
  if document is null or jsonb_typeof(document) is distinct from 'object' then return false; end if;
  if not (document ?& array['id','brand','model','trim','mileage','city','power','drive','image','price','year','status','condition']) then return false; end if;
  if document - allowed_fields <> '{}'::jsonb then return false; end if;

  foreach field in array array['id','brand','model','trim','mileage','city','power','drive','image','status','condition'] loop
    if jsonb_typeof(document -> field) is distinct from 'string' then return false; end if;
  end loop;
  if vehicle_id is null or (document ->> 'id') is distinct from vehicle_id
    or vehicle_id !~ '^[A-Za-z0-9_-]{1,100}$' then return false; end if;
  if btrim(document ->> 'brand') = '' or btrim(document ->> 'model') = '' then return false; end if;
  if document ->> 'status' not in ('В наличии','В пути','Под заказ')
    or document ->> 'condition' not in ('Новый','С пробегом') then return false; end if;

  if jsonb_typeof(document -> 'price') is distinct from 'number'
    or jsonb_typeof(document -> 'year') is distinct from 'number' then return false; end if;
  amount := (document ->> 'price')::numeric;
  release_year := (document ->> 'year')::numeric;
  if amount < 1 or amount > 100000000 or amount <> trunc(amount)
    or release_year < 2000 or release_year > 2035 or release_year <> trunc(release_year) then return false; end if;

  foreach field in array text_fields loop
    if document ? field then
      max_length := case field when 'trim' then 160 when 'city' then 120 else 80 end;
      if jsonb_typeof(document -> field) is distinct from 'string'
        or char_length(document ->> field) > max_length then return false; end if;
    end if;
  end loop;
  if document ? 'vin' and (jsonb_typeof(document -> 'vin') is distinct from 'string' or char_length(document ->> 'vin') > 64) then return false; end if;
  if document ? 'customsType' and (jsonb_typeof(document -> 'customsType') is distinct from 'string' or document ->> 'customsType' not in ('ТПО','ГТД')) then return false; end if;

  foreach field in array array['image','video'] loop
    if document ? field then
      if jsonb_typeof(document -> field) is distinct from 'string' or char_length(document ->> field) > 4096 then return false; end if;
      if document ->> field <> '' and document ->> field !~* '^https?://[^[:space:]]+$' then return false; end if;
    end if;
  end loop;
  if document ? 'gallery' then
    if jsonb_typeof(document -> 'gallery') is distinct from 'array' then return false; end if;
    if jsonb_array_length(document -> 'gallery') > 100 then return false; end if;
    for source in select value from jsonb_array_elements(document -> 'gallery') loop
      if jsonb_typeof(source) is distinct from 'string' or char_length(source #>> '{}') > 4096 then return false; end if;
      if source #>> '{}' <> '' and source #>> '{}' !~* '^https?://[^[:space:]]+$' then return false; end if;
    end loop;
  end if;
  if document ? 'translations' then
    if jsonb_typeof(document -> 'translations') is distinct from 'object' then return false; end if;
    if (document -> 'translations') - array['ru','zh'] <> '{}'::jsonb then return false; end if;
    for locale, fields in select key, value from jsonb_each(document -> 'translations') loop
      if jsonb_typeof(fields) is distinct from 'object' then return false; end if;
      if fields - text_fields <> '{}'::jsonb then return false; end if;
      foreach field in array text_fields loop
        if fields ? field then
          max_length := case field when 'trim' then 160 when 'city' then 120 else 80 end;
          if jsonb_typeof(fields -> field) is distinct from 'string'
            or char_length(fields ->> field) > max_length then return false; end if;
        end if;
      end loop;
    end loop;
  end if;
  return true;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.vehicles'::regclass and conname = 'vehicle_data_valid') then
    alter table public.vehicles add constraint vehicle_data_valid
      check (public.is_valid_vehicle_document(data, id) is true) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.vehicles'::regclass and conname = 'vehicle_version_safe_integer') then
    alter table public.vehicles add constraint vehicle_version_safe_integer
      check (version between 1 and 9007199254740991) not valid;
  end if;
end $$;

commit;

-- Read-only inspection: these records are kept in storage for review. Malformed
-- known fields are excluded from the catalogue; extra fields are stripped from
-- public responses. No automatic truncation or deletion occurs.
select id from public.vehicles
where public.is_valid_vehicle_document(data, id) is not true
  or version not between 1 and 9007199254740991
order by id;

-- After reviewing and fixing every returned ID, run:
-- alter table public.vehicles validate constraint vehicle_data_valid;
-- alter table public.vehicles validate constraint vehicle_version_safe_integer;

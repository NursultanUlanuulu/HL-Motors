-- Extend the existing JSON document validator. Existing records are not rewritten.
-- Apply after 202609150001_vehicle_integrity.sql, before deploying the new editor.
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
  minimum numeric;
  maximum numeric;
  date_value date;
  spec_options jsonb := '{"fuelType":["9888e9ae7324","1d9e0ccb169e","9bdbc2f60b49","eba69e23d059","df05d43c30ab","6d5a0f69e535","ae529d5626b2","085d8bf1e62c","6289d9d52d0e"],"transmission":["f61dc1844545","8224206ff912","d3860bd757f5","4607020c9dd8","72e8dd533fe5","739541ab6638","3e9c684d31e1","1f0ce222e08c","20c32dd8c068","5acce56d12ce","636fa8857c38","47a416b829ec","9e0394fea781","903bcd36058a","e1764d747265","fabcc3c92ff9","7d75d6dab2d5","a0b42b3a31bb","6cde6021405c","ac2bd9db45aa","ffff3f1b1341","7f789d78e410","adc57708069b","bc93560b6318","17366cca1422","5a05b537976b","fe7639da210e","218113146a14","ea31cdd11f2a","6d05e6d698a5","f57b21bd208c","9501686e0f28","974379f06b59","b6da5f6fc54f","5313e0da02da","57d2c830f9e3","95e4e06f7c71","848536883918","82cda5913f7b"],"driveType":["ca84b1ac67ae","64304325e95d","c184c92aa561","72591e4bba79","298db4b41bdb","b64fb9aad8ea","7574619d7f7c"],"bodyType":["8db0701a3a60","878c7f508b0d","8228daf46ec4","4df59c06face","42f328ba792a","8d79379de8d0","14a2491ee7e7","e4277aaab3bf","b9114899deef","292a95152f2f","0ac4e80db243","71fbb3478783","a8de86b2a137","55513bae9efb","f3247a4ded39","df7a9ce45eac","0cbd08f2c690","90e26bda560a","6b3697c9a532","a6cd560fd31a","0820df8660f6","d775acc3154c","1b6ddf25aeca","781a40168c0e"],"color":["70012b3222e5","2f5b612a359a","56b6876bdf90","0cd230f482af","343ff8318ff0","f79b39876ad9","e7372e36a4b0","da15a7d54eb1","3196d84e61ec","853b60b16a33","8b4914a3ad02","f0d1332573cb","d87d07e08747","5293d76ebd73","9ff2104f255f","54505b555f48","0a43e56ae281","ae43afb7adcc","41fc57db13c3","d52684fb3470","791721ac8a70","603f6d146aca","749c8efe65bd","7af801c81909","908ae818a183","dc63a5df2dbc","1472f6f0107c","3c5b8fcb46b8","9fbdfd478657","904eac4e27b2"],"seats":["93f35b3d7657","8657096e6243","97c7b1aee347","8cf20c2ebf6a","d96a8800f0e4","bb5d0f232a3c"],"batteryType":["af4b156140eb","8ac6bed2a0da","77da4be95ddc","42aa69997f4e","a08a10300bd6","e1314b3169a8","e73088da3ac1","7d9d5a8bdd42","63807eb196ce","970ee1f2e64b"],"flowMode":["cfe47a1e9eac","22e48b3f9acd","52d48b0e90b9","e3e108b682c5","da2b0c060cc9","c90b6ae8b76c","9b8ec6803ac4","7c2b37e3404d","9fd50073ba8f"],"featureTags":["c1fc2064f0ff","964991652142","da0553be6f96","2b446dd43cf3","77c1c470de86","0b0510122857","53503915cf6c","e9d6fd0a13b4","abe95c8a899d","247f36cfeff3","56c3057c5e2e","e7e149ec529a","f03f6467cead","5c424d5068df","d0bba89d5ee6","212a0bd973b6","cd345428f901","901200fdc7a9","dfe34a50dd0d","2a39371ce51b","f5249615bb0f","3164ff0e9bd0","ecc49c46ebaa"]}'::jsonb;
  allowed_fields text[] := array['id','brand','model','trim','mileage','city','power','drive','body','color','transmission','engine','price','year','status','condition','image','vin','customsType','translations','gallery','video','title','remark','metaTitle','metaDescription','highlights','specs','featureTags','carCode','listedAt','fobPrice'];
  text_fields text[] := array['brand','model','trim','mileage','city','power','drive','body','color','transmission','engine','title','remark','metaTitle','metaDescription','highlights'];
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
      max_length := case field when 'trim' then 160 when 'city' then 120 when 'title' then 240 when 'remark' then 5000 when 'metaTitle' then 240 when 'metaDescription' then 500 when 'highlights' then 1000 else 80 end;
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
    if (document -> 'translations') - array['ru','en','zh'] <> '{}'::jsonb then return false; end if;
    for locale, fields in select key, value from jsonb_each(document -> 'translations') loop
      if jsonb_typeof(fields) is distinct from 'object' then return false; end if;
      if fields - text_fields <> '{}'::jsonb then return false; end if;
      foreach field in array text_fields loop
        if fields ? field then
          max_length := case field when 'trim' then 160 when 'city' then 120 when 'title' then 240 when 'remark' then 5000 when 'metaTitle' then 240 when 'metaDescription' then 500 when 'highlights' then 1000 else 80 end;
          if jsonb_typeof(fields -> field) is distinct from 'string'
            or char_length(fields ->> field) > max_length then return false; end if;
        end if;
      end loop;
    end loop;
  end if;
  if document ? 'carCode' and (jsonb_typeof(document -> 'carCode') is distinct from 'string' or char_length(document ->> 'carCode') > 160) then return false; end if;
  if document ? 'fobPrice' then
    if jsonb_typeof(document -> 'fobPrice') is distinct from 'number' then return false; end if;
    amount := (document ->> 'fobPrice')::numeric;
    if amount < 1 or amount > 100000000 or amount <> trunc(amount) then return false; end if;
  end if;
  if document ? 'specs' then
    if jsonb_typeof(document -> 'specs') is distinct from 'object' then return false; end if;
    for field, source in select key, value from jsonb_each(document -> 'specs') loop
      if spec_options ? field and field <> 'featureTags' then
        if jsonb_typeof(source) is distinct from 'string' or not ((spec_options -> field) ? (source #>> '{}')) then return false; end if;
      elsif field in ('displacement','mileageKm','powerHp','acceleration','fuelConsumption','batteryCapacity','range','officialPrice') then
        if jsonb_typeof(source) is distinct from 'number' then return false; end if;
        amount := (source #>> '{}')::numeric;
        maximum := case field when 'displacement' then 20 when 'mileageKm' then 10000000 when 'powerHp' then 10000 when 'acceleration' then 300 when 'fuelConsumption' then 200 when 'batteryCapacity' then 2000 when 'range' then 10000 when 'officialPrice' then 100000000 end;
        if amount < 0 or amount > maximum then return false; end if;
        if field in ('mileageKm','range','officialPrice') and amount <> trunc(amount) then return false; end if;
      elsif field <> 'registrationDate' then return false;
      end if;
    end loop;
  end if;
  foreach field in array array['listedAt','registrationDate'] loop
    fields := case field when 'listedAt' then document else document -> 'specs' end;
    if fields ? field then
      if jsonb_typeof(fields -> field) is distinct from 'string' or (fields ->> field) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
      begin
        date_value := (fields ->> field)::date;
        if to_char(date_value, 'YYYY-MM-DD') <> fields ->> field then return false; end if;
      exception when others then return false;
      end;
    end if;
  end loop;
  if document ? 'featureTags' then
    if jsonb_typeof(document -> 'featureTags') is distinct from 'array' then return false; end if;
    if jsonb_array_length(document -> 'featureTags') > jsonb_array_length(spec_options -> 'featureTags') then return false; end if;
    if (select count(distinct value) from jsonb_array_elements(document -> 'featureTags')) <> jsonb_array_length(document -> 'featureTags') then return false; end if;
    for source in select value from jsonb_array_elements(document -> 'featureTags') loop
      if jsonb_typeof(source) is distinct from 'string' or not ((spec_options -> 'featureTags') ? (source #>> '{}')) then return false; end if;
    end loop;
  end if;
  return true;
end;
$$;

commit;

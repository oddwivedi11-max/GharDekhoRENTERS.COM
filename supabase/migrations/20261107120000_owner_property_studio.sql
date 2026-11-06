-- GharDekho Property Studio: additive listing metadata and idempotent publish RPC.
-- Existing properties, owners, rental records and occupancy history are preserved.

alter table public.properties
  add column if not exists property_type text,
  add column if not exists configuration text,
  add column if not exists security_deposit numeric,
  add column if not exists pincode text,
  add column if not exists photo_urls text[] not null default array[]::text[],
  add column if not exists nearby_places jsonb not null default '[]'::jsonb,
  add column if not exists studio_submission_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_property_type_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_property_type_check
      check (property_type is null or property_type in ('apartment','independent_house','villa','pg','hostel','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_configuration_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_configuration_check
      check (configuration is null or configuration in ('1 RK','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK','Other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_security_deposit_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_security_deposit_check
      check (security_deposit is null or (security_deposit >= 0 and security_deposit <= 10000000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_pincode_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_pincode_check
      check (pincode is null or pincode ~ '^[0-9]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_photo_urls_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_photo_urls_check
      check (cardinality(photo_urls) <= 8);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_nearby_places_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_nearby_places_check
      check (jsonb_typeof(nearby_places) = 'array' and jsonb_array_length(nearby_places) <= 50);
  end if;
end $$;

create unique index if not exists properties_studio_submission_id_uidx
  on public.properties (studio_submission_id)
  where studio_submission_id is not null;

create or replace function public.owner_publish_property_studio(
  p_submission_id uuid,
  p_property_type text,
  p_configuration text,
  p_security_deposit numeric,
  p_pincode text,
  p_photo_urls text[],
  p_nearby_places jsonb,
  p_listing_type text,
  p_room_type text,
  p_gender_preference text,
  p_food_included boolean,
  p_total_beds integer,
  p_available_beds integer,
  p_name text,
  p_title text,
  p_location text,
  p_area text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_bhk integer,
  p_rent numeric,
  p_furnishing text,
  p_description text,
  p_image_url text
)
returns public.properties
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_property public.properties;
  v_photo_urls text[] := coalesce(p_photo_urls, array[]::text[]);
  v_nearby jsonb := coalesce(p_nearby_places, '[]'::jsonb);
  v_image_prefix text;
  v_effective_bhk integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_submission_id is null then
    raise exception 'A listing submission identifier is required';
  end if;
  if not exists (select 1 from public.owners o where o.user_id = v_user_id) then
    raise exception 'Owner profile not found';
  end if;

  -- Serialize retries for the same authenticated owner and submission ID.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_submission_id::text, 0));

  select p.* into v_property
  from public.properties p
  join public.owners o on o.id = p.owner_id
  where o.user_id = v_user_id
    and p.studio_submission_id = p_submission_id
  limit 1;

  if found then
    return v_property;
  end if;

  if p_property_type not in ('apartment','independent_house','villa','pg','hostel','other') then
    raise exception 'Select a valid property type';
  end if;
  if p_listing_type not in ('home','pg','hostel') then
    raise exception 'Invalid listing type';
  end if;
  if p_security_deposit is not null and (p_security_deposit < 0 or p_security_deposit > 10000000) then
    raise exception 'Security deposit must be between 0 and 10000000';
  end if;
  if p_pincode is not null and p_pincode !~ '^[0-9]{6}$' then
    raise exception 'PIN code must contain exactly 6 digits';
  end if;
  if cardinality(v_photo_urls) > 8 then
    raise exception 'You can upload a maximum of 8 property photos';
  end if;
  if jsonb_typeof(v_nearby) <> 'array' or jsonb_array_length(v_nearby) > 50 then
    raise exception 'Nearby places data is invalid';
  end if;
  if p_property_type in ('apartment','independent_house','villa') and
     p_configuration not in ('1 RK','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK') then
    raise exception 'Select a valid property configuration';
  end if;
  if p_property_type = 'other' and p_configuration is distinct from 'Other' then
    raise exception 'Invalid configuration for Other property';
  end if;
  if (p_property_type = 'pg' and p_listing_type <> 'pg') or
     (p_property_type = 'hostel' and p_listing_type <> 'hostel') or
     (p_property_type not in ('pg','hostel') and p_listing_type <> 'home') then
    raise exception 'Property type and listing type do not match';
  end if;

  v_image_prefix := 'https://gktmaiwqvtusnegevdle.supabase.co/storage/v1/object/public/property-images/' || v_user_id::text || '/';
  if exists (
    select 1 from unnest(v_photo_urls) as photo_url
    where left(photo_url, length(v_image_prefix)) <> v_image_prefix
  ) then
    raise exception 'Every property photo must be uploaded to your own property-images folder';
  end if;
  if p_image_url is not null and
     (left(p_image_url, length(v_image_prefix)) <> v_image_prefix or not (p_image_url = any(v_photo_urls))) then
    raise exception 'The cover photo must be one of your uploaded property photos';
  end if;

  v_effective_bhk := case
    when p_property_type = 'other' then 1
    when p_configuration = '1 RK' then 1
    when p_configuration = '1 BHK' then 1
    when p_configuration = '2 BHK' then 2
    when p_configuration = '3 BHK' then 3
    when p_configuration = '4 BHK' then 4
    when p_configuration = '5+ BHK' then 5
    else p_bhk
  end;

  v_property := public.owner_add_property(
    p_listing_type,
    p_room_type,
    p_gender_preference,
    p_food_included,
    p_total_beds,
    p_available_beds,
    p_name,
    p_title,
    p_location,
    p_area,
    p_address,
    p_latitude,
    p_longitude,
    case when p_listing_type = 'home' then v_effective_bhk else null end,
    p_rent,
    p_furnishing,
    p_description,
    p_image_url
  );

  update public.properties
  set property_type = p_property_type,
      configuration = p_configuration,
      bhk = case when p_property_type = 'other' then null else v_effective_bhk end,
      security_deposit = p_security_deposit,
      pincode = p_pincode,
      photo_urls = v_photo_urls,
      nearby_places = v_nearby,
      studio_submission_id = p_submission_id
  where id = v_property.id
    and owner_id = v_property.owner_id
  returning * into v_property;

  return v_property;
end
$function$;

revoke all on function public.owner_publish_property_studio(
  uuid,text,text,numeric,text,text[],jsonb,text,text,text,boolean,integer,integer,
  text,text,text,text,text,double precision,double precision,integer,numeric,text,text,text
) from public, anon;
grant execute on function public.owner_publish_property_studio(
  uuid,text,text,numeric,text,text[],jsonb,text,text,text,boolean,integer,integer,
  text,text,text,text,text,double precision,double precision,integer,numeric,text,text,text
) to authenticated;

drop function public.get_public_properties();

create function public.get_public_properties()
returns table(
  id uuid,
  owner_id uuid,
  title text,
  location text,
  latitude double precision,
  longitude double precision,
  bhk integer,
  rent numeric,
  furnishing text,
  description text,
  status text,
  verification_status text,
  image_url text,
  created_at timestamptz,
  listing_type text,
  room_type text,
  gender_preference text,
  food_included boolean,
  total_beds integer,
  available_beds integer,
  owner_verified boolean,
  property_type text,
  configuration text,
  security_deposit numeric,
  pincode text,
  photo_urls text[],
  nearby_places jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p.id,
    p.owner_id,
    p.title,
    p.location,
    p.latitude,
    p.longitude,
    p.bhk,
    p.rent,
    p.furnishing,
    p.description,
    p.status,
    p.verification_status,
    p.image_url,
    p.created_at,
    p.listing_type,
    p.room_type,
    p.gender_preference,
    p.food_included,
    p.total_beds,
    p.available_beds,
    (o.verification_status = 'verified'),
    p.property_type,
    p.configuration,
    p.security_deposit,
    p.pincode,
    p.photo_urls,
    p.nearby_places
  from public.properties p
  join public.owners o on o.id = p.owner_id
  where
    (
      p.verification_status = 'verified'
      and o.verification_status = 'verified'
      and p.status in ('verified','occupied','soon_available')
    )
    or
    (p.verification_status = 'pending' and p.status = 'pending')
    or
    (
      p.verification_status = 'pending'
      and p.status = 'occupied'
      and exists (
        select 1
        from public.property_occupancies po
        where po.property_id = p.id
          and po.released_at is null
      )
    )
  order by p.created_at desc
  limit 100;
$function$;

revoke all on function public.get_public_properties() from public;
grant execute on function public.get_public_properties() to anon, authenticated;

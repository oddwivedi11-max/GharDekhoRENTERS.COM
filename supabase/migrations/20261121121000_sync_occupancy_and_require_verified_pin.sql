-- Require complete Indian property identity for new Property Studio listings,
-- and keep property availability in sync with confirmed occupancy lifecycle events.
-- Existing rows are not assigned guessed PINs or coordinates by this migration.

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
  v_property_name text;
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

  -- Normalize the owner-entered identity at the database boundary. Older
  -- clients may still send a generated title; it remains a fallback only.
  v_property_name := left(
    trim(regexp_replace(
      regexp_replace(coalesce(nullif(p_name, ''), nullif(p_title, ''), ''), '[[:cntrl:]<>]', ' ', 'g'),
      '[[:space:]]+', ' ', 'g'
    )),
    50
  );
  if char_length(v_property_name) < 3 then
    raise exception 'Property name must contain between 3 and 50 characters';
  end if;

  if p_pincode is null or p_pincode !~ '^[0-9]{6} or p_property_type not in ('apartment','independent_house','villa','pg','hostel','other','room') then
    raise exception 'Select a valid property type';
  end if;
  if p_listing_type is null or p_listing_type not in ('home','pg','hostel') then
    raise exception 'Invalid listing type';
  end if;
  if p_security_deposit is not null and (p_security_deposit < 0 or p_security_deposit > 10000000) then
    raise exception 'Security deposit must be between 0 and 10000000';
  end if;
  if cardinality(v_photo_urls) > 8 then
    raise exception 'You can upload a maximum of 8 property photos';
  end if;
  if jsonb_typeof(v_nearby) <> 'array' or jsonb_array_length(v_nearby) > 50 then
    raise exception 'Nearby places data is invalid';
  end if;
  if p_property_type in ('apartment','independent_house','villa') and
     (p_configuration is null or p_configuration not in ('1 RK','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK')) then
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
    when p_property_type in ('other','room') then 1
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
    v_property_name,
    v_property_name,
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
      bhk = case when p_property_type in ('other','room') then null else v_effective_bhk end,
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


create or replace function public.sync_property_status_from_occupancy_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_verification_status text;
  v_listing_type text;
  v_available_beds integer;
  v_has_future_notice boolean;
  v_has_active_occupancy boolean;
  v_next_status text;
begin
  select p.verification_status, p.listing_type, p.available_beds
    into v_verification_status, v_listing_type, v_available_beds
  from public.properties p
  where p.id = new.property_id
  for update;

  if not found or v_verification_status <> 'verified' then
    return new;
  end if;

  select exists (
    select 1 from public.property_occupancies po
    where po.property_id = new.property_id
      and po.released_at is null
      and po.expected_move_out_at is not null
      and po.expected_move_out_at >= current_date
  ) into v_has_future_notice;

  select exists (
    select 1 from public.property_occupancies po
    where po.property_id = new.property_id
      and po.released_at is null
  ) into v_has_active_occupancy;

  if v_has_future_notice then
    v_next_status := 'soon_available';
  elsif v_has_active_occupancy and
        (v_listing_type = 'home' or coalesce(v_available_beds, 0) <= 0) then
    v_next_status := 'occupied';
  else
    v_next_status := 'verified';
  end if;

  update public.properties
  set status = v_next_status
  where id = new.property_id
    and verification_status = 'verified';

  return new;
end
$function$;

revoke all on function public.sync_property_status_from_occupancy_lifecycle() from public, anon, authenticated;

drop trigger if exists property_occupancies_sync_listing_status on public.property_occupancies;
create trigger property_occupancies_sync_listing_status
after insert or update of released_at on public.property_occupancies
for each row
execute function public.sync_property_status_from_occupancy_lifecycle();

-- Correct stale whole-home / fully-booked statuses already present at migration
-- time. Multi-bed PG/hostel listings with remaining beds stay discoverable.
update public.properties p
set status = case
  when exists (
    select 1 from public.property_occupancies po
    where po.property_id = p.id
      and po.released_at is null
      and po.expected_move_out_at is not null
      and po.expected_move_out_at >= current_date
  ) then 'soon_available'
  else 'occupied'
end
where p.deleted_at is null
  and p.verification_status = 'verified'
  and p.status = 'verified'
  and (p.listing_type = 'home' or coalesce(p.available_beds, 0) <= 0)
  and exists (
    select 1 from public.property_occupancies po
    where po.property_id = p.id and po.released_at is null
  );
 then
    raise exception 'A verified six-digit PIN code is required';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude < 5 or p_latitude > 38.8
     or p_longitude < 67 or p_longitude > 98.2 then
    raise exception 'Confirm the exact property location on the India map before publishing';
  end if;

  if p_property_type is null or p_property_type not in ('apartment','independent_house','villa','pg','hostel','other','room') then
    raise exception 'Select a valid property type';
  end if;
  if p_listing_type is null or p_listing_type not in ('home','pg','hostel') then
    raise exception 'Invalid listing type';
  end if;
  if p_security_deposit is not null and (p_security_deposit < 0 or p_security_deposit > 10000000) then
    raise exception 'Security deposit must be between 0 and 10000000';
  end if;
  if cardinality(v_photo_urls) > 8 then
    raise exception 'You can upload a maximum of 8 property photos';
  end if;
  if jsonb_typeof(v_nearby) <> 'array' or jsonb_array_length(v_nearby) > 50 then
    raise exception 'Nearby places data is invalid';
  end if;
  if p_property_type in ('apartment','independent_house','villa') and
     (p_configuration is null or p_configuration not in ('1 RK','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK')) then
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
    when p_property_type in ('other','room') then 1
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
      bhk = case when p_property_type in ('other','room') then null else v_effective_bhk end,
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


create or replace function public.sync_property_status_from_occupancy_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_verification_status text;
  v_listing_type text;
  v_available_beds integer;
  v_has_future_notice boolean;
  v_has_active_occupancy boolean;
  v_next_status text;
begin
  select p.verification_status, p.listing_type, p.available_beds
    into v_verification_status, v_listing_type, v_available_beds
  from public.properties p
  where p.id = new.property_id
  for update;

  if not found or v_verification_status <> 'verified' then
    return new;
  end if;

  select exists (
    select 1 from public.property_occupancies po
    where po.property_id = new.property_id
      and po.released_at is null
      and po.expected_move_out_at is not null
      and po.expected_move_out_at >= current_date
  ) into v_has_future_notice;

  select exists (
    select 1 from public.property_occupancies po
    where po.property_id = new.property_id
      and po.released_at is null
  ) into v_has_active_occupancy;

  if v_has_future_notice then
    v_next_status := 'soon_available';
  elsif v_has_active_occupancy and
        (v_listing_type = 'home' or coalesce(v_available_beds, 0) <= 0) then
    v_next_status := 'occupied';
  else
    v_next_status := 'verified';
  end if;

  update public.properties
  set status = v_next_status
  where id = new.property_id
    and verification_status = 'verified';

  return new;
end
$function$;

revoke all on function public.sync_property_status_from_occupancy_lifecycle() from public, anon, authenticated;

drop trigger if exists property_occupancies_sync_listing_status on public.property_occupancies;
create trigger property_occupancies_sync_listing_status
after insert or update of released_at on public.property_occupancies
for each row
execute function public.sync_property_status_from_occupancy_lifecycle();

-- Correct stale whole-home / fully-booked statuses already present at migration
-- time. Multi-bed PG/hostel listings with remaining beds stay discoverable.
update public.properties p
set status = case
  when exists (
    select 1 from public.property_occupancies po
    where po.property_id = p.id
      and po.released_at is null
      and po.expected_move_out_at is not null
      and po.expected_move_out_at >= current_date
  ) then 'soon_available'
  else 'occupied'
end
where p.deleted_at is null
  and p.verification_status = 'verified'
  and p.status = 'verified'
  and (p.listing_type = 'home' or coalesce(p.available_beds, 0) <= 0)
  and exists (
    select 1 from public.property_occupancies po
    where po.property_id = p.id and po.released_at is null
  );

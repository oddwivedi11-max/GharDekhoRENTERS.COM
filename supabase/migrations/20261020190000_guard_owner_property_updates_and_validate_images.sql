-- Guard owner edits through a SECURITY DEFINER RPC with explicit ownership checks.
-- Prepared on the QA branch only. Do not apply to production without approval.

-- Both existing verification triggers must allow only the safe owner downgrade
-- to pending when an owned listing's address or type changes. They must still block
-- owners from marking a listing verified/rejected or changing a verified address/type
-- without re-verification. Keep both functions in sync because both triggers exist.
create or replace function public.prevent_non_admin_property_verification_change()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_is_owner boolean;
  v_location_or_type_changed boolean;
begin
  if public.is_ghardekho_admin() then
    return new;
  end if;

  v_location_or_type_changed :=
    new.location is distinct from old.location
    or new.listing_type is distinct from old.listing_type;

  select exists (
    select 1 from public.owners o
    where o.id = old.owner_id and o.user_id = auth.uid()
  ) into v_is_owner;

  if v_location_or_type_changed then
    if not v_is_owner then
      raise exception 'Only the property owner or an admin can change the address or listing type';
    end if;
    if old.status = 'occupied' then
      raise exception 'Release current occupancy before changing the address or listing type';
    end if;
    if new.verification_status is distinct from 'pending' then
      raise exception 'Address or listing type changes require admin re-verification';
    end if;
  end if;

  if new.verification_status is distinct from old.verification_status then
    if new.verification_status <> 'pending' or not v_is_owner or not v_location_or_type_changed then
      raise exception 'Only an admin can change property verification status except when an owner resubmits an address or listing-type change';
    end if;
  end if;

  return new;
end
$function$;

create or replace function public.protect_property_verification_status()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_is_owner boolean;
  v_location_or_type_changed boolean;
begin
  if public.is_ghardekho_admin() then
    return new;
  end if;

  v_location_or_type_changed :=
    new.location is distinct from old.location
    or new.listing_type is distinct from old.listing_type;

  select exists (
    select 1 from public.owners o
    where o.id = old.owner_id and o.user_id = auth.uid()
  ) into v_is_owner;

  if v_location_or_type_changed then
    if not v_is_owner then
      raise exception 'Only the property owner or an admin can change the address or listing type';
    end if;
    if old.status = 'occupied' then
      raise exception 'Release current occupancy before changing the address or listing type';
    end if;
    if new.verification_status is distinct from 'pending' then
      raise exception 'Address or listing type changes require admin re-verification';
    end if;
  end if;

  if new.verification_status is distinct from old.verification_status then
    if new.verification_status <> 'pending' or not v_is_owner or not v_location_or_type_changed then
      raise exception 'Only GharDekho administration can change property verification status except when an owner resubmits an address or listing-type change';
    end if;
  end if;

  return new;
end
$function$;

create or replace function public.owner_update_property(
  p_property_id uuid,
  p_listing_type text,
  p_room_type text,
  p_gender_preference text,
  p_food_included boolean,
  p_total_beds integer,
  p_available_beds integer,
  p_title text,
  p_location text,
  p_rent numeric,
  p_bhk integer,
  p_furnishing text,
  p_description text,
  p_image_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_property public.properties;
  v_image_prefix text;
  v_image_value text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_requires_reverification boolean := false;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select o.id into v_owner_id
  from public.owners o
  where o.user_id = v_user_id
  limit 1;
  if v_owner_id is null then raise exception 'Owner profile not found'; end if;

  select p.* into v_property
  from public.properties p
  where p.id = p_property_id and p.owner_id = v_owner_id
  for update;
  if not found then raise exception 'Property not found or access denied'; end if;

  v_requires_reverification :=
    p_listing_type is distinct from v_property.listing_type
    or btrim(p_location) is distinct from btrim(coalesce(v_property.location, ''));

  if v_property.status = 'occupied' and v_requires_reverification then
    raise exception 'Release current occupancy before changing the address or listing type';
  end if;

  if p_listing_type not in ('home', 'pg', 'hostel') then raise exception 'Invalid property type'; end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null or length(btrim(p_title)) > 120 then
    raise exception 'Property title is required and must be 120 characters or fewer';
  end if;
  if nullif(btrim(coalesce(p_location, '')), '') is null or length(btrim(p_location)) > 300 then
    raise exception 'Property location is required and must be 300 characters or fewer';
  end if;
  if p_rent is null or p_rent < 1 or p_rent > 10000000 then raise exception 'Monthly rent must be between 1 and 10000000'; end if;
  if p_description is not null and length(p_description) > 2000 then raise exception 'Description must be 2000 characters or fewer'; end if;
  if p_furnishing is not null and p_furnishing not in ('Furnished', 'Semi-Furnished', 'Unfurnished') then raise exception 'Invalid furnishing option'; end if;

  if p_listing_type = 'home' then
    if p_bhk is null or p_bhk < 1 or p_bhk > 20 then raise exception 'Valid BHK is required for a home'; end if;
  else
    if nullif(btrim(coalesce(p_room_type, '')), '') is null
       or nullif(btrim(coalesce(p_gender_preference, '')), '') is null
       or p_total_beds is null or p_total_beds < 1
       or p_available_beds is null or p_available_beds < 0
       or p_available_beds > p_total_beds then
      raise exception 'Valid PG/hostel room and bed details are required';
    end if;
  end if;

  -- Existing legacy URLs may remain unchanged while other fields are edited.
  -- A new/replaced photo must be in this owner's own public storage folder.
  v_image_prefix := 'https://gktmaiwqvtusnegevdle.supabase.co/storage/v1/object/public/property-images/' || v_user_id::text || '/';
  if v_image_value is not null
     and v_image_value is distinct from v_property.image_url
     and left(v_image_value, length(v_image_prefix)) <> v_image_prefix then
    raise exception 'Property image must be uploaded to this account''s property-images folder';
  end if;

  update public.properties
  set title = btrim(p_title),
      name = btrim(p_title),
      location = btrim(p_location),
      address = case
        when btrim(p_location) is distinct from btrim(coalesce(v_property.location, ''))
          then btrim(p_location)
        else v_property.address
      end,
      verification_status = case
        when v_requires_reverification then 'pending'
        else v_property.verification_status
      end,
      status = case
        when v_requires_reverification then 'pending'
        else v_property.status
      end,
      rent = p_rent,
      bhk = case when p_listing_type = 'home' then p_bhk else null end,
      furnishing = p_furnishing,
      listing_type = p_listing_type,
      room_type = case when p_listing_type = 'home' then null else nullif(btrim(p_room_type), '') end,
      gender_preference = case when p_listing_type = 'home' then null else nullif(btrim(p_gender_preference), '') end,
      total_beds = case when p_listing_type = 'home' then null else p_total_beds end,
      available_beds = case when p_listing_type = 'home' then null else p_available_beds end,
      food_included = case when p_listing_type = 'home' then null else p_food_included end,
      description = nullif(btrim(coalesce(p_description, '')), ''),
      image_url = v_image_value
  where id = p_property_id and owner_id = v_owner_id;

  return jsonb_build_object(
    'success', true,
    'id', p_property_id,
    'requires_reverification', v_requires_reverification
  );
end
$function$;

revoke all on function public.owner_update_property(uuid, text, text, text, boolean, integer, integer, text, text, numeric, integer, text, text, text) from public, anon;
grant execute on function public.owner_update_property(uuid, text, text, text, boolean, integer, integer, text, text, numeric, integer, text, text, text) to authenticated;

-- Apply matching validation to new owner submissions.
create or replace function public.owner_add_property(
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
  v_owner public.owners;
  v_property public.properties;
  v_image_prefix text;
  v_image_value text := nullif(btrim(coalesce(p_image_url, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_owner from public.owners where user_id = auth.uid() limit 1;
  if not found then raise exception 'Owner profile not found'; end if;

  if p_listing_type not in ('home','pg','hostel') then raise exception 'Invalid property type'; end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null or length(btrim(p_name)) > 120 then raise exception 'Property name is required and must be 120 characters or fewer'; end if;
  if p_title is not null and length(btrim(p_title)) > 120 then raise exception 'Property title must be 120 characters or fewer'; end if;
  if nullif(btrim(coalesce(p_address,p_location,'')),'') is null then raise exception 'Property address is required'; end if;
  if p_location is not null and length(btrim(p_location)) > 300 then raise exception 'Location must be 300 characters or fewer'; end if;
  if p_area is not null and length(btrim(p_area)) > 300 then raise exception 'Area must be 300 characters or fewer'; end if;
  if p_address is not null and length(btrim(p_address)) > 300 then raise exception 'Address must be 300 characters or fewer'; end if;
  if p_description is not null and length(p_description) > 2000 then raise exception 'Description must be 2000 characters or fewer'; end if;
  if p_rent is null or p_rent < 1 or p_rent > 10000000 then raise exception 'Monthly rent must be between 1 and 10000000'; end if;
  if p_furnishing is not null and p_furnishing not in ('Furnished','Semi-Furnished','Unfurnished') then raise exception 'Invalid furnishing option'; end if;

  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Property coordinates must be supplied together'; end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180) then
    raise exception 'Invalid property coordinates';
  end if;

  if p_listing_type='home' then
    if p_bhk is null or p_bhk < 1 or p_bhk > 20 then raise exception 'Valid BHK is required for a home'; end if;
  else
    if p_room_type is null or p_gender_preference is null
       or p_total_beds is null or p_total_beds < 1
       or p_available_beds is null or p_available_beds < 0
       or p_available_beds > p_total_beds then
      raise exception 'Valid PG/Hostel room and bed details are required';
    end if;
  end if;

  v_image_prefix := 'https://gktmaiwqvtusnegevdle.supabase.co/storage/v1/object/public/property-images/' || auth.uid()::text || '/';
  if v_image_value is not null and left(v_image_value, length(v_image_prefix)) <> v_image_prefix then
    raise exception 'Property image must be uploaded to this account''s property-images folder';
  end if;

  insert into public.properties(
    owner_id, listing_type, room_type, gender_preference, food_included,
    total_beds, available_beds, name, title, location, area, address,
    latitude, longitude, bhk, rent, furnishing, description, image_url,
    status, verification_status
  ) values (
    v_owner.id, p_listing_type,
    case when p_listing_type='home' then null else p_room_type end,
    case when p_listing_type='home' then null else p_gender_preference end,
    case when p_listing_type='home' then null else p_food_included end,
    case when p_listing_type='home' then null else p_total_beds end,
    case when p_listing_type='home' then null else p_available_beds end,
    btrim(p_name), nullif(btrim(coalesce(p_title,p_name)),''),
    nullif(btrim(coalesce(p_location,'')),''), nullif(btrim(coalesce(p_area,p_location)), ''),
    btrim(coalesce(p_address,p_location)), p_latitude, p_longitude,
    case when p_listing_type='home' then p_bhk else null end,
    p_rent, nullif(btrim(coalesce(p_furnishing,'')),''),
    nullif(btrim(coalesce(p_description,'')),''),
    v_image_value,
    'pending', 'pending'
  ) returning * into v_property;

  return v_property;
end
$function$;

revoke all on function public.owner_add_property(text, text, text, boolean, integer, integer, text, text, text, text, text, double precision, double precision, integer, numeric, text, text, text) from public, anon;
grant execute on function public.owner_add_property(text, text, text, boolean, integer, integer, text, text, text, text, text, double precision, double precision, integer, numeric, text, text, text) to authenticated;

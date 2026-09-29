-- Allow owners to submit a listing when geocoding cannot produce exact coordinates.
-- The listing remains pending and can be verified by admin later.
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
set search_path to 'public'
as $function$
declare
  v_owner public.owners;
  v_property public.properties;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_owner from public.owners where user_id = auth.uid() limit 1;
  if not found then raise exception 'Owner profile not found'; end if;

  if p_listing_type not in ('home','pg','hostel') then raise exception 'Invalid property type'; end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'Property name is required'; end if;
  if nullif(btrim(coalesce(p_address,p_location,'')),'') is null then raise exception 'Property address is required'; end if;

  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Property coordinates must be supplied together';
  end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180) then
    raise exception 'Invalid property coordinates';
  end if;

  if p_rent is null or p_rent <= 0 then raise exception 'Valid monthly rent is required'; end if;

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
    btrim(p_location), btrim(coalesce(p_area,p_location)),
    btrim(coalesce(p_address,p_location)), p_latitude, p_longitude,
    case when p_listing_type='home' then p_bhk else null end,
    p_rent, nullif(btrim(coalesce(p_furnishing,'')),''),
    nullif(btrim(coalesce(p_description,'')),''),
    nullif(btrim(coalesce(p_image_url,'')),''),
    'pending', 'pending'
  ) returning * into v_property;

  return v_property;
end
$function$;

grant execute on function public.owner_add_property(text,text,text,boolean,integer,integer,text,text,text,text,text,double precision,double precision,integer,numeric,text,text,text) to authenticated;

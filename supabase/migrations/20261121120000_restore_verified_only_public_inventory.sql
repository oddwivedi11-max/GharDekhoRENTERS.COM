-- Restore the agreed public-inventory rule: only verified properties
-- belonging to verified owners are publicly discoverable. Pending/rejected rows
-- remain available to the owner/admin but never appear in renter-facing RPCs.
-- Occupancy is also reflected in the returned status so a stale "verified"
-- property row cannot be presented as vacant when a whole-home tenancy is active.

create or replace function public.get_public_properties()
returns table (
  id uuid, owner_id uuid, title text, location text,
  latitude double precision, longitude double precision,
  bhk integer, rent numeric, furnishing text, description text,
  status text, verification_status text, image_url text,
  created_at timestamp with time zone, listing_type text, room_type text,
  gender_preference text, food_included boolean, total_beds integer,
  available_beds integer, owner_verified boolean, property_type text,
  configuration text, security_deposit numeric, pincode text,
  photo_urls text[], nearby_places jsonb
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p.id, p.owner_id, p.title, p.location, p.latitude, p.longitude,
    p.bhk, p.rent, p.furnishing, p.description,
    case
      when p.status = 'soon_available' then 'soon_available'
      when (p.listing_type = 'home' or coalesce(p.available_beds, 0) <= 0)
        and exists (
          select 1 from public.property_occupancies po
          where po.property_id = p.id and po.released_at is null
        ) then 'occupied'
      else p.status
    end as status,
    p.verification_status, p.image_url, p.created_at, p.listing_type,
    p.room_type, p.gender_preference, p.food_included, p.total_beds,
    p.available_beds, (o.verification_status = 'verified') as owner_verified,
    p.property_type, p.configuration, p.security_deposit, p.pincode,
    p.photo_urls, p.nearby_places
  from public.properties p
  join public.owners o on o.id = p.owner_id
  where p.deleted_at is null
    and p.verification_status = 'verified'
    and o.verification_status = 'verified'
    and p.status in ('verified', 'occupied', 'soon_available')
  order by p.created_at desc
  limit 100;
$function$;

revoke all on function public.get_public_properties() from public;
grant execute on function public.get_public_properties() to anon, authenticated;


create or replace function public.get_nearby_properties(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 3,
  p_limit integer default 100
)
returns table (
  id uuid,
  title text,
  name text,
  location text,
  address text,
  area text,
  bhk integer,
  rent numeric,
  furnishing text,
  description text,
  image_url text,
  latitude double precision,
  longitude double precision,
  status text,
  owner_id uuid,
  created_at timestamptz,
  listing_type text,
  room_type text,
  gender_preference text,
  food_included boolean,
  total_beds integer,
  available_beds integer,
  distance_km double precision
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p.id, p.title, p.name, p.location, p.address, p.area,
    p.bhk, p.rent, p.furnishing, p.description, p.image_url,
    p.latitude, p.longitude,
    case
      when p.status = 'soon_available' then 'soon_available'
      when (p.listing_type = 'home' or coalesce(p.available_beds, 0) <= 0)
        and exists (
          select 1 from public.property_occupancies po
          where po.property_id = p.id and po.released_at is null
        ) then 'occupied'
      else p.status
    end as status,
    p.owner_id, p.created_at, p.listing_type, p.room_type,
    p.gender_preference, p.food_included, p.total_beds, p.available_beds,
    6371.0 * 2.0 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(p.latitude - p_lat) / 2.0), 2) +
      cos(radians(p_lat)) * cos(radians(p.latitude)) *
      power(sin(radians(p.longitude - p_lng) / 2.0), 2)
    )))) as distance_km
  from public.properties p
  join public.owners o on o.id = p.owner_id
  where p.deleted_at is null
    and p.latitude is not null
    and p.longitude is not null
    and p.verification_status = 'verified'
    and o.verification_status = 'verified'
    and p.status in ('verified', 'occupied', 'soon_available')
    and p_lat between -90 and 90
    and p_lng between -180 and 180
    and 6371.0 * 2.0 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(p.latitude - p_lat) / 2.0), 2) +
      cos(radians(p_lat)) * cos(radians(p.latitude)) *
      power(sin(radians(p.longitude - p_lng) / 2.0), 2)
    )))) <= greatest(0.5, least(10, coalesce(p_radius_km, 3)))
  order by distance_km asc
  limit greatest(1, least(100, coalesce(p_limit, 100)));
$function$;

revoke all on function public.get_nearby_properties(double precision,double precision,double precision,integer) from public;
grant execute on function public.get_nearby_properties(double precision,double precision,double precision,integer) to anon, authenticated;


create or replace function public.get_map_properties_in_bounds(
  p_south double precision,
  p_west double precision,
  p_north double precision,
  p_east double precision,
  p_limit integer default 200
)
returns table (
  id uuid,
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
  available_beds integer,
  owner_verified boolean
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_south is null or p_west is null or p_north is null or p_east is null
     or p_south < -90 or p_north > 90 or p_south > p_north
     or p_west < -180 or p_east > 180 or p_west > p_east then
    raise exception 'Invalid map bounds';
  end if;

  return query
  select
    p.id, coalesce(p.title, p.name, 'Rental property'), p.location,
    p.latitude, p.longitude, p.bhk, p.rent, p.furnishing, p.description,
    case
      when p.status = 'soon_available' then 'soon_available'
      when (p.listing_type = 'home' or coalesce(p.available_beds, 0) <= 0)
        and exists (
          select 1 from public.property_occupancies po
          where po.property_id = p.id and po.released_at is null
        ) then 'occupied'
      else p.status
    end,
    p.verification_status, p.image_url, p.created_at, p.listing_type,
    p.room_type, p.available_beds, (o.verification_status = 'verified')
  from public.properties p
  join public.owners o on o.id = p.owner_id
  where p.deleted_at is null
    and p.latitude is not null
    and p.longitude is not null
    and p.latitude between p_south and p_north
    and p.longitude between p_west and p_east
    and p.verification_status = 'verified'
    and o.verification_status = 'verified'
    and p.status in ('verified', 'occupied', 'soon_available')
  order by p.created_at desc
  limit greatest(1, least(200, coalesce(p_limit, 200)));
end;
$function$;

revoke all on function public.get_map_properties_in_bounds(double precision,double precision,double precision,double precision,integer) from public;
grant execute on function public.get_map_properties_in_bounds(double precision,double precision,double precision,double precision,integer) to anon, authenticated;


create or replace function public.get_available_map_properties_in_bounds(
  p_south double precision,
  p_west double precision,
  p_north double precision,
  p_east double precision,
  p_center_lat double precision,
  p_center_lng double precision,
  p_radius_km double precision default 5,
  p_min_rent numeric default null,
  p_max_rent numeric default null,
  p_bhk integer default null,
  p_listing_type text default null,
  p_property_type text default null,
  p_furnishing text default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  title text,
  location text,
  address text,
  latitude double precision,
  longitude double precision,
  bhk integer,
  rent numeric,
  furnishing text,
  description text,
  status text,
  verification_status text,
  image_url text,
  photo_urls text[],
  created_at timestamptz,
  listing_type text,
  property_type text,
  configuration text,
  room_type text,
  available_beds integer,
  owner_verified boolean,
  distance_km double precision
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_south is null or p_west is null or p_north is null or p_east is null
     or p_center_lat is null or p_center_lng is null
     or p_south < -90 or p_north > 90 or p_south > p_north
     or p_west < -180 or p_east > 180 or p_west > p_east
     or p_center_lat < -90 or p_center_lat > 90
     or p_center_lng < -180 or p_center_lng > 180
     or p_radius_km is null or p_radius_km < 0.5 or p_radius_km > 10
     or (p_min_rent is not null and p_min_rent < 0)
     or (p_max_rent is not null and p_max_rent < 0)
     or (p_min_rent is not null and p_max_rent is not null and p_min_rent > p_max_rent)
     or (p_bhk is not null and (p_bhk < 1 or p_bhk > 20))
     or (p_listing_type is not null and p_listing_type not in ('home','pg','hostel'))
     or (p_furnishing is not null and p_furnishing not in ('Furnished','Semi-Furnished','Unfurnished')) then
    raise exception 'Invalid map search filters';
  end if;

  return query
  with candidates as (
    select
      p.id,
      coalesce(p.title,p.name,'Rental property') as title,
      p.location, p.address, p.latitude, p.longitude, p.bhk, p.rent,
      p.furnishing, p.description, p.status, p.verification_status,
      coalesce(nullif(p.image_url,''),p.photo_urls[1]) as image_url,
      p.photo_urls, p.created_at, p.listing_type, p.property_type,
      p.configuration, p.room_type, p.available_beds,
      (o.verification_status = 'verified') as owner_verified,
      6371.0 * 2.0 * asin(sqrt(least(1.0,greatest(0.0,
        power(sin(radians(p.latitude-p_center_lat)/2.0),2)
        + cos(radians(p_center_lat))*cos(radians(p.latitude))
        * power(sin(radians(p.longitude-p_center_lng)/2.0),2)
      )))) as distance_km
    from public.properties p
    join public.owners o on o.id = p.owner_id
    where p.deleted_at is null
      and p.latitude is not null
      and p.longitude is not null
      and p.latitude between p_south and p_north
      and p.longitude between p_west and p_east
      and p.status = 'verified'
      and p.verification_status = 'verified'
      and o.verification_status = 'verified'
      and not exists (
        select 1 from public.property_occupancies po
        where po.property_id = p.id and po.released_at is null
      )
      and (p.listing_type = 'home' or coalesce(p.available_beds,0) > 0)
      and (p_min_rent is null or p.rent >= p_min_rent)
      and (p_max_rent is null or p.rent <= p_max_rent)
      and (p_bhk is null or p.bhk = p_bhk)
      and (p_listing_type is null or p.listing_type = p_listing_type)
      and (p_property_type is null or lower(coalesce(p.property_type,'')) = lower(p_property_type))
      and (p_furnishing is null or p.furnishing = p_furnishing)
  )
  select c.id,c.title,c.location,c.address,c.latitude,c.longitude,c.bhk,c.rent,
         c.furnishing,c.description,c.status,c.verification_status,c.image_url,
         c.photo_urls,c.created_at,c.listing_type,c.property_type,c.configuration,
         c.room_type,c.available_beds,c.owner_verified,c.distance_km
  from candidates c
  where c.distance_km <= p_radius_km
  order by c.distance_km asc, c.created_at desc
  limit greatest(1, least(200, coalesce(p_limit, 200)));
end;
$function$;

revoke all on function public.get_available_map_properties_in_bounds(
  double precision,double precision,double precision,double precision,
  double precision,double precision,double precision,numeric,numeric,integer,
  text,text,text,integer
) from public;
grant execute on function public.get_available_map_properties_in_bounds(
  double precision,double precision,double precision,double precision,
  double precision,double precision,double precision,numeric,numeric,integer,
  text,text,text,integer
) to anon, authenticated;


create or replace function public.search_public_properties_for_assistant(
  p_search_text text default null,
  p_min_rent numeric default null,
  p_max_rent numeric default null,
  p_bhk integer default null,
  p_listing_type text default null,
  p_property_type text default null,
  p_furnishing text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_search_query tsquery;
  v_region_key text;
  v_limit integer := greatest(1, least(100, coalesce(p_limit,100)));
  v_offset integer := greatest(0, least(1000000, coalesce(p_offset,0)));
  v_total bigint := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if length(coalesce(p_search_text,'')) > 200
    or (p_min_rent is not null and p_min_rent < 0)
    or (p_max_rent is not null and p_max_rent < 0)
    or (p_min_rent is not null and p_max_rent is not null and p_min_rent > p_max_rent)
    or (p_bhk is not null and (p_bhk < 1 or p_bhk > 20))
    or (p_listing_type is not null and p_listing_type not in ('home','pg','hostel'))
    or (p_furnishing is not null and p_furnishing not in ('Furnished','Semi-Furnished','Unfurnished'))
    or p_limit is null or p_limit < 1 or p_limit > 100
    or p_offset is null or p_offset < 0 then
    raise exception 'Invalid assistant property search filters';
  end if;

  if nullif(btrim(coalesce(p_search_text,'')),'') is not null then
    v_search_query := websearch_to_tsquery('simple'::regconfig,p_search_text);
    v_region_key := lower(regexp_replace(btrim(p_search_text),'[^a-zA-Z0-9]+',' ','g'));
  end if;

  with eligible as (
    select p.id
    from public.properties p
    join public.owners o on o.id = p.owner_id
    where p.deleted_at is null
      and p.status = 'verified'
      and p.verification_status = 'verified'
      and o.verification_status = 'verified'
      and not exists (
        select 1 from public.property_occupancies po
        where po.property_id = p.id and po.released_at is null
      )
      and (p.listing_type = 'home' or coalesce(p.available_beds,0) > 0)
      and (p_min_rent is null or p.rent >= p_min_rent)
      and (p_max_rent is null or p.rent <= p_max_rent)
      and (p_bhk is null or p.bhk = p_bhk)
      and (p_listing_type is null or p.listing_type = p_listing_type)
      and (p_property_type is null or lower(coalesce(p.property_type,'')) = lower(p_property_type))
      and (p_furnishing is null or lower(coalesce(p.furnishing,'')) = lower(p_furnishing))
      and (
        v_search_query is null
        or to_tsvector('simple'::regconfig,coalesce(p.area,'') || ' ' || coalesce(p.location,'') || ' ' || coalesce(p.address,'') || ' ' || coalesce(p.pincode,'')) @@ v_search_query
        or (v_region_key in ('singrauli','singrauli madhya pradesh','singrauli mp','singruali','singruali madhya pradesh')
          and lower(concat_ws(' ',p.area,p.location,p.address,p.pincode)) ~ '(singrauli|singruali|waidhan|vindhyanagar|vindhya[[:space:]]+nagar|jayant|morwa|rajmata[[:space:]]+chun[[:space:]]+kumari[[:space:]]+stadium|dav[[:space:]]+road|486[[:space:]]*[0-9]{3})')
        or (v_region_key in ('bhopal','bhopal madhya pradesh','bhopal mp')
          and lower(concat_ws(' ',p.area,p.location,p.address,p.pincode)) ~ '(bhopal|patel[[:space:]]+nagar|indrapuri|indripuri|chhatrasal[[:space:]]+nagar|minal[[:space:]]+residency|huzur[[:space:]]+tahsil|462[[:space:]]*[0-9]{3})')
      )
  )
  select count(*) into v_total from eligible;

  with page as (
    select
      p.id,p.owner_id,coalesce(p.title,p.name,'Rental property') as title,
      p.location,p.area,p.address,p.latitude,p.longitude,p.bhk,p.rent,
      p.furnishing,p.description,p.status,p.verification_status,
      coalesce(nullif(p.image_url,''),p.photo_urls[1]) as image_url,p.created_at,
      p.listing_type,p.room_type,p.gender_preference,p.food_included,
      p.total_beds,p.available_beds,(o.verification_status='verified') as owner_verified,
      p.property_type,p.configuration,p.security_deposit,p.pincode,p.photo_urls,p.nearby_places
    from public.properties p
    join public.owners o on o.id = p.owner_id
    where p.deleted_at is null
      and p.status = 'verified'
      and p.verification_status = 'verified'
      and o.verification_status = 'verified'
      and not exists (
        select 1 from public.property_occupancies po
        where po.property_id = p.id and po.released_at is null
      )
      and (p.listing_type = 'home' or coalesce(p.available_beds,0) > 0)
      and (p_min_rent is null or p.rent >= p_min_rent)
      and (p_max_rent is null or p.rent <= p_max_rent)
      and (p_bhk is null or p.bhk = p_bhk)
      and (p_listing_type is null or p.listing_type = p_listing_type)
      and (p_property_type is null or lower(coalesce(p.property_type,'')) = lower(p_property_type))
      and (p_furnishing is null or lower(coalesce(p.furnishing,'')) = lower(p_furnishing))
      and (
        v_search_query is null
        or to_tsvector('simple'::regconfig,coalesce(p.area,'') || ' ' || coalesce(p.location,'') || ' ' || coalesce(p.address,'') || ' ' || coalesce(p.pincode,'')) @@ v_search_query
        or (v_region_key in ('singrauli','singrauli madhya pradesh','singrauli mp','singruali','singruali madhya pradesh')
          and lower(concat_ws(' ',p.area,p.location,p.address,p.pincode)) ~ '(singrauli|singruali|waidhan|vindhyanagar|vindhya[[:space:]]+nagar|jayant|morwa|rajmata[[:space:]]+chun[[:space:]]+kumari[[:space:]]+stadium|dav[[:space:]]+road|486[[:space:]]*[0-9]{3})')
        or (v_region_key in ('bhopal','bhopal madhya pradesh','bhopal mp')
          and lower(concat_ws(' ',p.area,p.location,p.address,p.pincode)) ~ '(bhopal|patel[[:space:]]+nagar|indrapuri|indripuri|chhatrasal[[:space:]]+nagar|minal[[:space:]]+residency|huzur[[:space:]]+tahsil|462[[:space:]]*[0-9]{3})')
      )
    order by p.created_at desc nulls last, p.id
    limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc nulls last,page.id),'[]'::jsonb)
    into v_results from page;

  return jsonb_build_object(
    'total_count',v_total,'offset',v_offset,'page_size',v_limit,
    'has_more',(v_offset + jsonb_array_length(v_results)) < v_total,
    'results',v_results
  );
end;
$function$;

revoke all on function public.search_public_properties_for_assistant(text,numeric,numeric,integer,text,text,text,integer,integer) from public;
grant execute on function public.search_public_properties_for_assistant(text,numeric,numeric,integer,text,text,text,integer,integer) to anon, authenticated;

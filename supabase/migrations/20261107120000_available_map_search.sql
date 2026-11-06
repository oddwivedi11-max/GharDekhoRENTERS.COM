-- GharDekho: accurate renter map search over the existing public properties table.
-- This additive RPC returns only genuinely unoccupied inventory with usable coordinates.
-- Pending submissions are explicitly labelled by the UI; occupied/soon-available rows are excluded.

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
      p.location,
      p.address,
      p.latitude,
      p.longitude,
      p.bhk,
      p.rent,
      p.furnishing,
      p.description,
      p.status,
      p.verification_status,
      coalesce(nullif(p.image_url,''),p.photo_urls[1]) as image_url,
      p.photo_urls,
      p.created_at,
      p.listing_type,
      p.property_type,
      p.configuration,
      p.room_type,
      p.available_beds,
      (o.verification_status = 'verified') as owner_verified,
      6371.0 * 2.0 * asin(sqrt(least(1.0,greatest(0.0,
        power(sin(radians(p.latitude-p_center_lat)/2.0),2)
        + cos(radians(p_center_lat))*cos(radians(p.latitude))
        * power(sin(radians(p.longitude-p_center_lng)/2.0),2)
      )))) as distance_km
    from public.properties p
    join public.owners o on o.id=p.owner_id
    where p.latitude is not null
      and p.longitude is not null
      and p.latitude between p_south and p_north
      and p.longitude between p_west and p_east
      and (
        (p.status='verified' and p.verification_status='verified' and o.verification_status='verified')
        or
        (p.status='pending' and p.verification_status='pending')
      )
      and not exists (
        select 1 from public.property_occupancies po
        where po.property_id=p.id and po.released_at is null
      )
      and (p.listing_type='home' or coalesce(p.available_beds,0)>0)
      and (p_min_rent is null or p.rent>=p_min_rent)
      and (p_max_rent is null or p.rent<=p_max_rent)
      and (p_bhk is null or p.bhk=p_bhk)
      and (p_listing_type is null or p.listing_type=p_listing_type)
      and (p_property_type is null or lower(coalesce(p.property_type,''))=lower(p_property_type))
      and (p_furnishing is null or p.furnishing=p_furnishing)
  )
  select c.id,c.title,c.location,c.address,c.latitude,c.longitude,c.bhk,c.rent,
         c.furnishing,c.description,c.status,c.verification_status,c.image_url,
         c.photo_urls,c.created_at,c.listing_type,c.property_type,c.configuration,
         c.room_type,c.available_beds,c.owner_verified,c.distance_km
  from candidates c
  where c.distance_km<=p_radius_km
  order by c.distance_km asc,c.created_at desc
  limit greatest(1,least(200,coalesce(p_limit,200)));
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
) to anon,authenticated;

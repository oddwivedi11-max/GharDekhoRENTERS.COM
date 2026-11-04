-- Keep Live Nearby consistent with the public property inventory.
-- Pending listings are already intentionally shown in public search with a
-- visible pending-verification label. The previous nearby RPC excluded them,
-- so the same property could appear in Find Home but disappear from Live Nearby.
-- Reuse the exact visibility rules from get_public_properties; rejected listings
-- remain excluded and all results still require saved GPS coordinates + radius.

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
    p.latitude, p.longitude, p.status, p.owner_id, p.created_at,
    p.listing_type, p.room_type, p.gender_preference,
    p.food_included, p.total_beds, p.available_beds,
    (
      6371.0 * 2.0 * asin(sqrt(
        power(sin(radians(p.latitude - p_lat) / 2.0), 2) +
        cos(radians(p_lat)) * cos(radians(p.latitude)) *
        power(sin(radians(p.longitude - p_lng) / 2.0), 2)
      ))
    ) as distance_km
  from public.properties p
  join public.owners o on o.id = p.owner_id
  where
    p.latitude is not null
    and p.longitude is not null
    and (
      (
        p.verification_status = 'verified'
        and o.verification_status = 'verified'
        and p.status in ('verified', 'occupied', 'soon_available')
      )
      or
      (
        p.verification_status = 'pending'
        and p.status = 'pending'
      )
    )
    and (
      6371.0 * 2.0 * asin(sqrt(
        power(sin(radians(p.latitude - p_lat) / 2.0), 2) +
        cos(radians(p_lat)) * cos(radians(p.latitude)) *
        power(sin(radians(p.longitude - p_lng) / 2.0), 2)
      ))
    ) <= greatest(0.5, least(10, coalesce(p_radius_km, 3)))
  order by distance_km asc
  limit greatest(1, least(100, coalesce(p_limit, 100)));
$function$;

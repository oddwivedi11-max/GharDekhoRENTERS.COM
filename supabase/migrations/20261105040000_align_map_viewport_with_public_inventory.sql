-- GDR additive map viewport RPC and narrow RPC privilege hardening.
-- Apply only after this migration has been tested on an isolated Supabase branch.
-- Existing public visibility rules intentionally match get_public_properties().

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
    p.id,
    coalesce(p.title, p.name, 'Rental property'),
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
    p.available_beds,
    (o.verification_status = 'verified')
  from public.properties p
  join public.owners o on o.id = p.owner_id
  where p.latitude is not null
    and p.longitude is not null
    and p.latitude between p_south and p_north
    and p.longitude between p_west and p_east
    and (
      (
        p.verification_status = 'verified'
        and o.verification_status = 'verified'
        and p.status in ('verified', 'occupied', 'soon_available')
      )
      or (p.verification_status = 'pending' and p.status = 'pending')
      or (
        p.verification_status = 'pending'
        and p.status = 'occupied'
        and exists (
          select 1
          from public.property_occupancies po
          where po.property_id = p.id
            and po.released_at is null
        )
      )
    )
  order by p.created_at desc
  limit greatest(1, least(200, coalesce(p_limit, 200)));
end;
$function$;

revoke all on function public.get_map_properties_in_bounds(double precision,double precision,double precision,double precision,integer) from public;
grant execute on function public.get_map_properties_in_bounds(double precision,double precision,double precision,double precision,integer) to anon, authenticated;

-- This owner-scoped function is only used after authentication in the owner dashboard.
revoke all on function public.get_my_owner_properties() from public, anon;
grant execute on function public.get_my_owner_properties() to authenticated;

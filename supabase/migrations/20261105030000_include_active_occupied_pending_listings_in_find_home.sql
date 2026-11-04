-- Include genuine occupied pending-verification listings in Find Home's
-- "All properties" inventory. Never present them as vacant: status remains occupied.
create or replace function public.get_public_properties()
returns table(
  id uuid, owner_id uuid, title text, location text,
  latitude double precision, longitude double precision,
  bhk integer, rent numeric, furnishing text, description text,
  status text, verification_status text, image_url text,
  created_at timestamptz, listing_type text, room_type text,
  gender_preference text, food_included boolean,
  total_beds integer, available_beds integer, owner_verified boolean
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
    (o.verification_status = 'verified')
  from public.properties p
  join public.owners o on o.id = p.owner_id
  where
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

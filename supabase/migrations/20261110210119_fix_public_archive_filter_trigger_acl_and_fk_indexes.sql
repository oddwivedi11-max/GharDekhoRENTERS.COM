-- Matches hosted Supabase migration 20261110210119.
-- Fix soft-archived pending/occupied visibility, close a trigger-only RPC grant,
-- and index the four foreign-key columns reported by Database Advisor.

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
language sql stable security definer set search_path to ''
as $function$
  select p.id,p.owner_id,p.title,p.location,p.latitude,p.longitude,p.bhk,p.rent,
    p.furnishing,p.description,p.status,p.verification_status,p.image_url,p.created_at,
    p.listing_type,p.room_type,p.gender_preference,p.food_included,p.total_beds,
    p.available_beds,(o.verification_status='verified'),p.property_type,p.configuration,
    p.security_deposit,p.pincode,p.photo_urls,p.nearby_places
  from public.properties p
  join public.owners o on o.id=p.owner_id
  where p.deleted_at is null
    and (
      (p.verification_status='verified' and o.verification_status='verified'
       and p.status in ('verified','occupied','soon_available'))
      or (p.verification_status='pending' and p.status='pending')
      or (p.verification_status='pending' and p.status='occupied'
          and exists (select 1 from public.property_occupancies po
                     where po.property_id=p.id and po.released_at is null))
    )
  order by p.created_at desc
  limit 100;
$function$;

-- Existing triggers invoke this handler; clients do not need an RPC grant.
revoke execute on function public.gdr_write_admin_audit_log() from public,anon,authenticated;

create index if not exists owner_rent_ledger_entries_created_by_idx
  on public.owner_rent_ledger_entries(created_by);
create index if not exists owner_rent_ledger_entries_property_id_idx
  on public.owner_rent_ledger_entries(property_id);
create index if not exists rent_payment_records_property_id_idx
  on public.rent_payment_records(property_id);
create index if not exists rent_payment_records_verified_by_idx
  on public.rent_payment_records(verified_by);

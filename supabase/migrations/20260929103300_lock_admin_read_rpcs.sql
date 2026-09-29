-- Lock down admin read RPCs.
-- These RPCs remain callable by authenticated clients so the existing admin UI
-- continues to work, but the RPC itself now enforces admin membership.
-- The legacy SECURITY DEFINER implementations are no longer directly callable.

begin;

alter function public.admin_get_all_owners() rename to admin_get_all_owners_legacy;
alter function public.admin_get_all_properties() rename to admin_get_all_properties_legacy;
alter function public.admin_get_all_renters() rename to admin_get_all_renters_legacy;
alter function public.admin_get_pending_owners() rename to admin_get_pending_owners_legacy;
alter function public.admin_get_pending_properties() rename to admin_get_pending_properties_legacy;
alter function public.admin_get_property_statuses() rename to admin_get_property_statuses_legacy;

revoke execute on function public.admin_get_all_owners_legacy() from public, anon, authenticated;
revoke execute on function public.admin_get_all_properties_legacy() from public, anon, authenticated;
revoke execute on function public.admin_get_all_renters_legacy() from public, anon, authenticated;
revoke execute on function public.admin_get_pending_owners_legacy() from public, anon, authenticated;
revoke execute on function public.admin_get_pending_properties_legacy() from public, anon, authenticated;
revoke execute on function public.admin_get_property_statuses_legacy() from public, anon, authenticated;

create or replace function public.admin_get_all_owners()
returns table(
  id uuid, user_id uuid, name text, phone text, email text, user_name text,
  user_phone text, verification_status text, created_at timestamptz, property_count bigint
)
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_ghardekho_admin() then raise exception 'Admin access required'; end if;
  return query select * from public.admin_get_all_owners_legacy();
end;
$$;

create or replace function public.admin_get_all_properties()
returns table(
  id uuid, owner_id uuid, owner_name text, owner_phone text, owner_email text,
  owner_verification_status text, title text, name text, location text, address text,
  rent numeric, status text, verification_status text, bhk integer, furnishing text,
  description text, image_url text, created_at timestamptz, listing_type text,
  room_type text, gender_preference text, food_included boolean, total_beds integer,
  available_beds integer
)
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_ghardekho_admin() then raise exception 'Admin access required'; end if;
  return query select * from public.admin_get_all_properties_legacy();
end;
$$;

create or replace function public.admin_get_all_renters()
returns table(
  id uuid, name text, email text, phone text, role text, created_at timestamptz
)
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_ghardekho_admin() then raise exception 'Admin access required'; end if;
  return query select * from public.admin_get_all_renters_legacy();
end;
$$;

create or replace function public.admin_get_pending_owners()
returns table(
  id uuid, user_id uuid, name text, phone text, email text,
  verification_status text, created_at timestamptz
)
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_ghardekho_admin() then raise exception 'Admin access required'; end if;
  return query select * from public.admin_get_pending_owners_legacy();
end;
$$;

create or replace function public.admin_get_pending_properties()
returns table(
  id uuid, owner_id uuid, owner_name text, owner_email text, title text,
  location text, bhk integer, rent numeric, furnishing text, description text,
  image_url text, latitude double precision, longitude double precision,
  status text, created_at timestamptz
)
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_ghardekho_admin() then raise exception 'Admin access required'; end if;
  return query select * from public.admin_get_pending_properties_legacy();
end;
$$;

create or replace function public.admin_get_property_statuses()
returns table(
  property_id uuid, effective_status text, active_occupancy_count bigint,
  renter_names text, occupied_at timestamptz
)
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_ghardekho_admin() then raise exception 'Admin access required'; end if;
  return query select * from public.admin_get_property_statuses_legacy();
end;
$$;

revoke execute on function public.admin_get_all_owners() from anon;
revoke execute on function public.admin_get_all_properties() from anon;
revoke execute on function public.admin_get_all_renters() from anon;
revoke execute on function public.admin_get_pending_owners() from anon;
revoke execute on function public.admin_get_pending_properties() from anon;
revoke execute on function public.admin_get_property_statuses() from anon;

grant execute on function public.admin_get_all_owners() to authenticated;
grant execute on function public.admin_get_all_properties() to authenticated;
grant execute on function public.admin_get_all_renters() to authenticated;
grant execute on function public.admin_get_pending_owners() to authenticated;
grant execute on function public.admin_get_pending_properties() to authenticated;
grant execute on function public.admin_get_property_statuses() to authenticated;

commit;

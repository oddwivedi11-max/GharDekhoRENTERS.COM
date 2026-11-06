-- Synchronize property availability with recorded renter move-out notices.
-- A notice never releases a tenancy; the owner must still confirm the move-out.

create or replace function public.sync_property_status_from_moveout_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_verification_status text;
  v_listing_type text;
  v_available_beds integer;
  v_has_notice boolean;
  v_has_active_occupancy boolean;
  v_next_status text;
begin
  if new.expected_move_out_at is not null and new.expected_move_out_at < current_date then
    raise exception 'Expected move-out date must be today or in the future';
  end if;

  if new.released_at is not null then
    return new;
  end if;

  select p.verification_status, p.listing_type, p.available_beds
    into v_verification_status, v_listing_type, v_available_beds
  from public.properties p
  where p.id = new.property_id
  for update;

  if not found or v_verification_status <> 'verified' then
    return new;
  end if;

  select exists (
    select 1
    from public.property_occupancies po
    where po.property_id = new.property_id
      and po.released_at is null
      and po.expected_move_out_at is not null
      and po.expected_move_out_at >= current_date
  ) into v_has_notice;

  if v_has_notice then
    update public.properties
    set status = 'soon_available'
    where id = new.property_id
      and verification_status = 'verified';
    return new;
  end if;

  select exists (
    select 1
    from public.property_occupancies po
    where po.property_id = new.property_id
      and po.released_at is null
  ) into v_has_active_occupancy;

  if not v_has_active_occupancy then
    v_next_status := 'verified';
  elsif v_listing_type = 'home' or coalesce(v_available_beds, 0) <= 0 then
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

revoke all on function public.sync_property_status_from_moveout_notice() from public, anon, authenticated;

drop trigger if exists property_occupancies_sync_moveout_status on public.property_occupancies;
create trigger property_occupancies_sync_moveout_status
after update of expected_move_out_at on public.property_occupancies
for each row
execute function public.sync_property_status_from_moveout_notice();

create or replace function public.renter_submit_move_out_notice(
  p_occupancy_id uuid,
  p_expected_move_out_at date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_renter_id uuid;
  v_property_id uuid;
  v_released_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_expected_move_out_at is not null and p_expected_move_out_at < current_date then
    raise exception 'Move-out date must be today or in the future';
  end if;

  select po.renter_id, po.property_id, po.released_at
    into v_renter_id, v_property_id, v_released_at
  from public.property_occupancies po
  where po.id = p_occupancy_id
  for update;

  if v_renter_id is null or v_renter_id <> auth.uid() then
    raise exception 'Active rental not found for this renter';
  end if;
  if v_released_at is not null then
    raise exception 'This tenancy has already ended';
  end if;

  update public.property_occupancies
  set expected_move_out_at = p_expected_move_out_at
  where id = p_occupancy_id
    and renter_id = auth.uid()
    and released_at is null;

  return jsonb_build_object(
    'success', true,
    'property_id', v_property_id,
    'expected_move_out_at', p_expected_move_out_at
  );
end
$function$;

revoke all on function public.renter_submit_move_out_notice(uuid,date) from public, anon;
grant execute on function public.renter_submit_move_out_notice(uuid,date) to authenticated;

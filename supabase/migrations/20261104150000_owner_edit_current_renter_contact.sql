-- Owner-scoped edit for the contact snapshot on an active occupancy.
-- Does not modify the renter's account profile or any other owner's records.
create or replace function public.update_my_current_renter_contact(
  p_occupancy_id uuid,
  p_renter_name text,
  p_renter_phone text default null
)
returns table(occupancy_id uuid, renter_name text, renter_phone text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_name text := nullif(btrim(p_renter_name), '');
  v_phone text := nullif(regexp_replace(coalesce(p_renter_phone, ''), '^\\+91[[:space:]]*', ''), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if v_name is null or length(v_name) > 120 then
    raise exception 'Enter a renter name up to 120 characters';
  end if;
  if v_phone is not null and v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number';
  end if;

  select o.id into v_owner_id
  from public.owners o
  where o.user_id = auth.uid()
  limit 1;

  if v_owner_id is null then
    raise exception 'Owner profile not found';
  end if;

  return query
  update public.property_occupancies po
     set renter_name = v_name,
         renter_phone = v_phone
   where po.id = p_occupancy_id
     and po.owner_id = v_owner_id
     and po.released_at is null
  returning po.id, po.renter_name, po.renter_phone;

  if not found then
    raise exception 'Active renter record not found for this owner';
  end if;
end;
$$;

revoke all on function public.update_my_current_renter_contact(uuid,text,text) from public, anon;
grant execute on function public.update_my_current_renter_contact(uuid,text,text) to authenticated;
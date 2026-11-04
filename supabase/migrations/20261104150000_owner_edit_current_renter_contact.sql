-- Owner-scoped edit for the contact snapshot on an active occupancy.
-- Uses SECURITY INVOKER + owner-only RLS; never bypasses row security.
-- Does not modify the renter's auth/profile record or another owner's data.

drop policy if exists property_occupancies_owner_update_contact
  on public.property_occupancies;

create policy property_occupancies_owner_update_contact
on public.property_occupancies
for update
to authenticated
using (
  released_at is null
  and owner_id in (
    select o.id
    from public.owners o
    where o.user_id = (select auth.uid())
  )
)
with check (
  released_at is null
  and owner_id in (
    select o.id
    from public.owners o
    where o.user_id = (select auth.uid())
  )
);

-- Limit the authenticated role to the two contact-snapshot columns.
grant update (renter_name, renter_phone)
on public.property_occupancies to authenticated;

create or replace function public.update_my_current_renter_contact(
  p_occupancy_id uuid,
  p_renter_name text,
  p_renter_phone text default null
)
returns table(occupancy_id uuid, renter_name text, renter_phone text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_renter_name), '');
  v_phone text := nullif(regexp_replace(coalesce(p_renter_phone, ''), '[^0-9]', '', 'g'), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_name is null or length(v_name) > 120 then
    raise exception 'Enter a renter name up to 120 characters';
  end if;

  if length(coalesce(v_phone, '')) = 12 and left(v_phone, 2) = '91' then
    v_phone := right(v_phone, 10);
  end if;

  if v_phone is not null and v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number';
  end if;

  return query
  update public.property_occupancies po
     set renter_name = v_name,
         renter_phone = v_phone
   where po.id = p_occupancy_id
     and po.released_at is null
     and po.owner_id in (
       select o.id
       from public.owners o
       where o.user_id = (select auth.uid())
     )
  returning po.id, po.renter_name, po.renter_phone;

  if not found then
    raise exception 'Active renter record not found for this owner';
  end if;
end;
$$;

revoke all on function public.update_my_current_renter_contact(uuid,text,text)
  from public, anon;
grant execute on function public.update_my_current_renter_contact(uuid,text,text)
  to authenticated;

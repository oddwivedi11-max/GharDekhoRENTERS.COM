-- Correct the phone regex in request_property_visit and reject only explicitly rejected owners/listings.
-- Pending owner/property verification remains allowed; owner approval of the visit request is still required.
create or replace function public.request_property_visit(
  p_property_id uuid,
  p_name text,
  p_phone text,
  p_visit_date date,
  p_visit_time time
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_property public.properties%rowtype;
  v_owner_verification_status text;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Please login before requesting a visit'
      using errcode = '28000';
  end if;
  if p_property_id is null then
    raise exception 'Please select a property first'
      using errcode = '22023';
  end if;
  if p_name is null or length(btrim(p_name)) < 1 or length(btrim(p_name)) > 80 then
    raise exception 'Enter a valid name'
      using errcode = '22023';
  end if;
  if p_phone is null or p_phone !~ ('^' || chr(92) || '+91[0-9]{10}$') then
    raise exception 'Enter a valid Indian mobile number'
      using errcode = '22023';
  end if;
  if p_visit_date is null or p_visit_time is null
     or (p_visit_date + p_visit_time) <= (now() at time zone 'Asia/Kolkata') then
    raise exception 'Choose a future visit date and time'
      using errcode = '22023';
  end if;

  select p.* into v_property
    from public.properties p
   where p.id = p_property_id
   for share;
  if not found then
    raise exception 'This property is no longer available'
      using errcode = 'P0002';
  end if;

  select o.verification_status into v_owner_verification_status
    from public.owners o
   where o.id = v_property.owner_id;

  if v_property.verification_status = 'rejected'
     or v_owner_verification_status = 'rejected'
     or v_property.status not in ('pending', 'verified', 'soon_available') then
    raise exception 'This property is not currently accepting visit requests'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.owners o
     where o.id = v_property.owner_id and o.user_id = v_user_id
  ) then
    raise exception 'You cannot request a visit for your own property'
      using errcode = '42501';
  end if;

  insert into public.visit_requests (
    property_id, tenant_id, name, phone, owner_id, visit_date, visit_time, status
  ) values (
    v_property.id, v_user_id, btrim(p_name), p_phone,
    v_property.owner_id, p_visit_date, p_visit_time, 'pending'
  )
  returning id into v_request_id;
  return v_request_id;
end;
$function$;

revoke all on function public.request_property_visit(uuid, text, text, date, time) from public;
revoke all on function public.request_property_visit(uuid, text, text, date, time) from anon;
grant execute on function public.request_property_visit(uuid, text, text, date, time) to authenticated;

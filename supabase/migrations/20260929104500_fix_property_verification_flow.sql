-- Make admin property verification actually publish the property.
-- A verified property must have both verification_status=verified and status=verified.
-- Rejected/pending properties remain hidden from the public listing.
create or replace function public.admin_set_property_verification(p_property_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.properties;
begin
  if not public.is_ghardekho_admin() then
    raise exception 'Admin access required';
  end if;

  if p_status not in ('pending','verified','rejected') then
    raise exception 'Invalid verification status';
  end if;

  if p_status = 'verified' then
    update public.properties
      set verification_status='verified', status='verified'
      where id=p_property_id
      returning * into v_row;
  elsif p_status = 'rejected' then
    update public.properties
      set verification_status='rejected', status='pending'
      where id=p_property_id
      returning * into v_row;
  else
    update public.properties
      set verification_status='pending', status='pending'
      where id=p_property_id
      returning * into v_row;
  end if;

  if not found then raise exception 'Property not found'; end if;

  return jsonb_build_object(
    'success',true,
    'id',v_row.id,
    'verification_status',v_row.verification_status,
    'status',v_row.status
  );
end
$function$;

-- Owner can submit/edit a property, but cannot self-verify it.
create or replace function public.protect_property_verification_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op='UPDATE'
     and new.verification_status is distinct from old.verification_status
     and not public.is_ghardekho_admin() then
    raise exception 'Only GharDekho administration can change property verification status';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_property_verification_status on public.properties;
create trigger trg_protect_property_verification_status
before update on public.properties
for each row
execute function public.protect_property_verification_status();

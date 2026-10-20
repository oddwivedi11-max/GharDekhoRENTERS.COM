-- Limit owner phone disclosure to renters with an approved visit request.
-- Prepared on fix/full-qa-20261020 only. Do not apply to production without approval.
-- "approved" is the existing visit-request status used by the owner dashboard.

create or replace function public.get_verified_owner_contact(p_owner_id uuid)
returns table(id uuid, name text, phone text, verification_status text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select o.id, o.name, o.phone, o.verification_status
  from public.owners o
  where o.id = p_owner_id
    and o.verification_status = 'verified'
    and exists (
      select 1
      from public.visit_requests vr
      where vr.owner_id = o.id
        and vr.tenant_id = auth.uid()
        and lower(coalesce(vr.status, '')) = 'approved'
    );
end
$function$;

revoke all on function public.get_verified_owner_contact(uuid) from public, anon;
grant execute on function public.get_verified_owner_contact(uuid) to authenticated;

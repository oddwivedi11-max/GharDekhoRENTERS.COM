-- Harden the unused legacy owner visit-status RPC.
-- Current frontend uses update_visit_status; this legacy alias must not reopen
-- or rewrite a visit after it has left the pending state.
-- Prepared on fix/full-qa-20261020 only; do not apply to production without approval.

create or replace function public.owner_update_visit_status(p_visit_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid visit status';
  end if;

  update public.visit_requests vr
  set status = p_status
  where vr.id = p_visit_id
    and vr.status = 'pending'
    and vr.owner_id in (
      select o.id
      from public.owners o
      where o.user_id = auth.uid()
    );

  if not found then
    raise exception 'Pending visit request not found or access denied';
  end if;
end
$function$;

revoke all on function public.owner_update_visit_status(uuid, text) from public, anon;
grant execute on function public.owner_update_visit_status(uuid, text) to authenticated;

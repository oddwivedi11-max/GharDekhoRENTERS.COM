-- Preserve all related rental/payment records when an owner removes a listing.
alter table public.properties
  add column if not exists deleted_at timestamptz;

create index if not exists properties_active_inventory_idx
  on public.properties (created_at desc)
  where deleted_at is null;

create or replace function public.owner_archive_property(p_property_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.properties p
  set deleted_at = coalesce(p.deleted_at, now())
  from public.owners o
  where p.id = p_property_id
    and p.owner_id = o.id
    and o.user_id = auth.uid()
    and p.deleted_at is null;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    if exists (
      select 1 from public.properties p
      join public.owners o on o.id = p.owner_id
      where p.id = p_property_id and o.user_id = auth.uid() and p.deleted_at is not null
    ) then return true; end if;
    raise exception 'Property not found or you do not have permission to remove it';
  end if;
  return true;
end;
$$;

revoke all on function public.owner_archive_property(uuid) from public;
revoke all on function public.owner_archive_property(uuid) from anon;
grant execute on function public.owner_archive_property(uuid) to authenticated;

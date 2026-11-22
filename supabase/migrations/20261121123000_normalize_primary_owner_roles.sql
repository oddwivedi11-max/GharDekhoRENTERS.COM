-- Repair deterministic primary-role/role-array mismatches and prevent
-- new owner profiles from being saved without the owner portal capability.
-- This preserves all existing role entries and only adds "owner" where the
-- primary role already says "owner".

update public.users
set roles = array_append(coalesce(roles, array[]::text[]), 'owner')
where lower(coalesce(role::text, '')) = 'owner'
  and not (coalesce(roles, array[]::text[]) @> array['owner']::text[]);

create or replace function public.ensure_primary_owner_role_membership()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if lower(coalesce(new.role::text, '')) = 'owner'
     and not (coalesce(new.roles, array[]::text[]) @> array['owner']::text[]) then
    new.roles := array_append(coalesce(new.roles, array[]::text[]), 'owner');
  end if;
  return new;
end
$function$;

revoke all on function public.ensure_primary_owner_role_membership() from public, anon, authenticated;

drop trigger if exists users_sync_primary_owner_role_membership on public.users;
create trigger users_sync_primary_owner_role_membership
before insert or update of role, roles on public.users
for each row
execute function public.ensure_primary_owner_role_membership();

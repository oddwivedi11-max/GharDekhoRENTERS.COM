do $$
declare r record; v_definition text;
begin
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and p.proname in ('get_public_properties','get_available_map_properties_in_bounds','get_map_properties_in_bounds','get_nearby_properties','search_public_properties_for_assistant','toggle_saved_property')
  loop
    v_definition := pg_get_functiondef(r.oid);
    v_definition := regexp_replace(
      v_definition,
      '(from public[.]properties p[[:space:][:print:]]*?where[[:space:]]*)',
      E'\\1 p.deleted_at is null and ',
      'g'
    );
    execute v_definition;
  end loop;
end;
$$;

create or replace function public.get_my_owner_properties()
returns setof public.properties
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.properties as p
  join public.owners as o on o.id = p.owner_id
  where o.user_id = auth.uid()
    and p.deleted_at is null
  order by p.created_at desc;
$$;

create or replace function public.get_my_saved_properties()
returns table(
  saved_id uuid, property_id uuid, saved_at timestamptz, title text,
  location text, address text, bhk integer, rent numeric, furnishing text,
  image_url text, status text, listing_type text, room_type text,
  verification_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,p.id,s.created_at,p.title,p.location,p.address,p.bhk,p.rent,
    p.furnishing,p.image_url,p.status,p.listing_type,p.room_type,p.verification_status
  from public.saved_properties s
  join public.properties p on p.id=s.property_id
  where s.user_id=auth.uid() and p.deleted_at is null
  order by s.created_at desc;
$$;

revoke all on function public.get_my_saved_properties() from public;
grant execute on function public.get_my_saved_properties() to authenticated;

-- Correct scoping: only return renters whose role matches AND whose record matches p_query.
create or replace function public.admin_global_search(p_query text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_query text:=nullif(btrim(coalesce(p_query,'')),'');v_result jsonb;
begin
 if not public.is_ghardekho_admin() then raise exception 'Admin access required';end if;
 if v_query is null or char_length(v_query)<2 then return '[]'::jsonb;end if;
 with hits as (
  select 'owner'::text entity_type,o.id::text entity_id,coalesce(o.name,u.name,'Owner')::text title,concat_ws(' · ',u.email,coalesce(o.phone,u.phone)) detail,o.verification_status status,o.created_at
  from public.owners o left join public.users u on u.id=o.user_id where concat_ws(' ',o.id::text,o.name,u.name,u.email,o.phone,u.phone) ilike '%'||v_query||'%'
  union all
  select 'renter',u.id::text,coalesce(u.name,'Renter'),concat_ws(' · ',u.email,u.phone),u.role,u.created_at from public.users u
  where (lower(coalesce(u.role,'')) in ('tenant','renter') or coalesce(u.roles,array[]::text[]) && array['tenant','renter']::text[])
   and concat_ws(' ',u.id::text,u.name,u.email,u.phone,u.role,array_to_string(u.roles,' ')) ilike '%'||v_query||'%'
  union all
  select 'property',p.id::text,coalesce(p.title,p.name,'Property'),concat_ws(' · ',p.location,p.address,'PIN '||p.pincode,'₹'||p.rent::text),p.status,p.created_at
  from public.properties p where p.deleted_at is null and concat_ws(' ',p.id::text,p.title,p.name,p.location,p.address,p.pincode,p.rent::text) ilike '%'||v_query||'%'
  union all
  select 'visit',v.id::text,coalesce(v.name,'Visit request'),concat_ws(' · ',v.phone,v.status,p.title,p.location),v.status,v.created_at from public.visit_requests v left join public.properties p on p.id=v.property_id
  where concat_ws(' ',v.id::text,v.name,v.phone,v.status,p.title,p.location) ilike '%'||v_query||'%'
  union all
  select 'support_ticket',t.id::text,t.ticket_code,concat_ws(' · ',t.user_role,t.category,t.status),t.status,t.created_at from public.support_tickets t
  where concat_ws(' ',t.id::text,t.ticket_code,t.user_role,t.category,t.status,t.description) ilike '%'||v_query||'%'
 )
 select coalesce(jsonb_agg(jsonb_build_object('entity_type',entity_type,'entity_id',entity_id,'title',title,'detail',detail,'status',status,'created_at',created_at) order by created_at desc nulls last),'[]'::jsonb)
 into v_result from(select * from hits order by created_at desc nulls last limit 40) h;
 return v_result;
end;$function$;

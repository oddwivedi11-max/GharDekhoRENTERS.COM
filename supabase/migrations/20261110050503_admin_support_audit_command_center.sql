-- GharDekho Admin Command Center: support, diagnostics and append-only audit.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('support-attachments','support-attachments',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 ticket_code text not null unique default ('GDR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 user_id uuid not null references auth.users(id) on delete cascade,
 user_role text not null check(user_role in ('owner','renter')),
 category text not null check(category in ('login_registration','profile','property_listing','property_editing','image_upload','map_location','search_filter','booking_visit','payment','dashboard_loading','broken_button','missing_record','incorrect_information','other')),
 description text not null check(char_length(btrim(description)) between 10 and 5000),
 page_url text,screenshot_path text,
 status text not null default 'open' check(status in ('open','in_progress','waiting_on_user','resolved','closed')),
 admin_notes text,last_user_message text,assigned_to uuid,resolved_at timestamptz,resolved_by uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_created_idx on public.support_tickets(user_id,created_at desc);
create index if not exists support_tickets_status_updated_idx on public.support_tickets(status,updated_at desc);

create table if not exists public.support_ticket_events (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 actor_id uuid,actor_scope text not null check(actor_scope in ('admin','user','system')),
 event_type text not null check(event_type in ('created','status_changed','user_update','admin_note','attachment_added')),
 old_status text,new_status text,message text,is_internal boolean not null default false,created_at timestamptz not null default now()
);
create index if not exists support_ticket_events_ticket_created_idx on public.support_ticket_events(ticket_id,created_at desc);

create table if not exists public.admin_audit_logs (
 id bigint generated always as identity primary key,actor_id uuid,
 actor_scope text not null check(actor_scope in ('admin','user','system')),
 action text not null,entity_type text not null,entity_id text,before_data jsonb,after_data jsonb,request_id text,created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type,entity_id,created_at desc);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs(actor_id,created_at desc);

create table if not exists public.client_error_events (
 id bigint generated always as identity primary key,user_id uuid,error_type text not null,message text not null,page_url text,user_agent text,created_at timestamptz not null default now()
);
create index if not exists client_error_events_created_idx on public.client_error_events(created_at desc);
create index if not exists client_error_events_user_created_idx on public.client_error_events(user_id,created_at desc);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_events enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.client_error_events enable row level security;

drop policy if exists support_tickets_select_own_or_admin on public.support_tickets;
create policy support_tickets_select_own_or_admin on public.support_tickets for select to authenticated
using(user_id=(select auth.uid()) or public.is_ghardekho_admin());

drop policy if exists support_ticket_events_select_visible on public.support_ticket_events;
create policy support_ticket_events_select_visible on public.support_ticket_events for select to authenticated
using((not is_internal and exists(select 1 from public.support_tickets t where t.id=support_ticket_events.ticket_id and t.user_id=(select auth.uid()))) or public.is_ghardekho_admin());

drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin on public.admin_audit_logs for select to authenticated using(public.is_ghardekho_admin());
drop policy if exists client_error_events_select_admin on public.client_error_events;
create policy client_error_events_select_admin on public.client_error_events for select to authenticated using(public.is_ghardekho_admin());

revoke all on public.support_tickets,public.support_ticket_events,public.admin_audit_logs,public.client_error_events from public,anon,authenticated;
grant select on public.support_tickets,public.support_ticket_events,public.admin_audit_logs,public.client_error_events to authenticated;
revoke all on sequence public.admin_audit_logs_id_seq from public,anon,authenticated;

drop policy if exists support_attachments_insert_own on storage.objects;
create policy support_attachments_insert_own on storage.objects for insert to authenticated
with check(bucket_id='support-attachments' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists support_attachments_select_own_or_admin on storage.objects;
create policy support_attachments_select_own_or_admin on storage.objects for select to authenticated
using(bucket_id='support-attachments' and (split_part(name,'/',1)=(select auth.uid())::text or public.is_ghardekho_admin()));
drop policy if exists support_attachments_delete_own on storage.objects;
create policy support_attachments_delete_own on storage.objects for delete to authenticated
using(bucket_id='support-attachments' and split_part(name,'/',1)=(select auth.uid())::text);

create or replace function public.create_support_ticket(p_ticket_id uuid,p_user_role text,p_category text,p_description text,p_page_url text default null,p_screenshot_path text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_user_role text;v_roles text[];v_is_owner boolean;v_is_renter boolean;v_ticket public.support_tickets;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_ticket_id is null then raise exception 'Ticket ID is required';end if;
 if p_user_role not in ('owner','renter') then raise exception 'Invalid user role';end if;
 if p_category not in ('login_registration','profile','property_listing','property_editing','image_upload','map_location','search_filter','booking_visit','payment','dashboard_loading','broken_button','missing_record','incorrect_information','other') then raise exception 'Invalid issue category';end if;
 if char_length(btrim(coalesce(p_description,'')))<10 or char_length(btrim(p_description))>5000 then raise exception 'Please provide an issue description between 10 and 5000 characters';end if;
 select u.role,coalesce(u.roles,array[]::text[]) into v_user_role,v_roles from public.users u where u.id=auth.uid();
 select exists(select 1 from public.owners o where o.user_id=auth.uid()) into v_is_owner;
 v_is_renter:=lower(coalesce(v_user_role,'')) in ('tenant','renter') or coalesce(v_roles,array[]::text[]) && array['tenant','renter']::text[];
 if p_user_role='owner' and not coalesce(v_is_owner,false) then raise exception 'This account does not have an owner profile';end if;
 if p_user_role='renter' and not coalesce(v_is_renter,false) then raise exception 'This account does not have a renter profile';end if;
 if p_page_url is not null and left(p_page_url,1)<>'/' and left(p_page_url,29)<>'https://ghardekhorenters.com/' then raise exception 'Invalid page reference';end if;
 if p_screenshot_path is not null and (left(p_screenshot_path,length(auth.uid()::text)+1)<>auth.uid()::text||'/' or not exists(select 1 from storage.objects so where so.bucket_id='support-attachments' and so.name=p_screenshot_path)) then raise exception 'Screenshot attachment is not available for this account';end if;
 insert into public.support_tickets(id,user_id,user_role,category,description,page_url,screenshot_path)
 values(p_ticket_id,auth.uid(),p_user_role,p_category,btrim(p_description),left(coalesce(p_page_url,''),500),p_screenshot_path) returning * into v_ticket;
 insert into public.support_ticket_events(ticket_id,actor_id,actor_scope,event_type,new_status,message,is_internal)
 values(v_ticket.id,auth.uid(),'user','created','open','Support request submitted.',false);
 return jsonb_build_object('success',true,'id',v_ticket.id,'ticket_code',v_ticket.ticket_code,'status',v_ticket.status);
end;$function$;

create or replace function public.my_support_tickets()
returns table(id uuid,ticket_code text,category text,description text,status text,page_url text,screenshot_path text,last_user_message text,created_at timestamptz,updated_at timestamptz,resolved_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return query select t.id,t.ticket_code,t.category,t.description,t.status,t.page_url,t.screenshot_path,t.last_user_message,t.created_at,t.updated_at,t.resolved_at from public.support_tickets t where t.user_id=auth.uid() order by t.updated_at desc limit 100;
end;$function$;

create or replace function public.my_support_ticket_events(p_ticket_id uuid)
returns table(event_type text,old_status text,new_status text,message text,created_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.support_tickets t where t.id=p_ticket_id and t.user_id=auth.uid()) then raise exception 'Ticket not found';end if;
 return query select e.event_type,e.old_status,e.new_status,e.message,e.created_at from public.support_ticket_events e where e.ticket_id=p_ticket_id and not e.is_internal order by e.created_at asc;
end;$function$;

create or replace function public.admin_list_support_tickets(p_status text default null)
returns table(id uuid,ticket_code text,user_id uuid,user_role text,category text,description text,page_url text,screenshot_path text,status text,admin_notes text,last_user_message text,created_at timestamptz,updated_at timestamptz,user_name text,user_email text,user_phone text)
language plpgsql security definer set search_path to '' as $function$
begin
 if not public.is_ghardekho_admin() then raise exception 'Admin access required';end if;
 if p_status is not null and p_status not in ('open','in_progress','waiting_on_user','resolved','closed') then raise exception 'Invalid ticket status filter';end if;
 return query select t.id,t.ticket_code,t.user_id,t.user_role,t.category,t.description,t.page_url,t.screenshot_path,t.status,t.admin_notes,t.last_user_message,t.created_at,t.updated_at,coalesce(u.name,o.name,'User'),u.email,coalesce(u.phone,o.phone)
 from public.support_tickets t left join public.users u on u.id=t.user_id left join public.owners o on o.user_id=t.user_id where p_status is null or t.status=p_status order by t.updated_at desc limit 250;
end;$function$;

create or replace function public.admin_update_support_ticket(p_ticket_id uuid,p_status text,p_admin_notes text default null,p_user_message text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_old public.support_tickets;v_new public.support_tickets;
begin
 if not public.is_ghardekho_admin() then raise exception 'Admin access required';end if;
 if p_status not in ('open','in_progress','waiting_on_user','resolved','closed') then raise exception 'Invalid ticket status';end if;
 if p_admin_notes is not null and char_length(p_admin_notes)>5000 then raise exception 'Admin note is too long';end if;
 if p_user_message is not null and char_length(p_user_message)>1500 then raise exception 'User update is too long';end if;
 select * into v_old from public.support_tickets where id=p_ticket_id for update;
 if not found then raise exception 'Support ticket not found';end if;
 update public.support_tickets set status=p_status,admin_notes=coalesce(p_admin_notes,admin_notes),last_user_message=coalesce(p_user_message,last_user_message),updated_at=now(),
 resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end,
 resolved_by=case when p_status in ('resolved','closed') then auth.uid() else null end
 where id=p_ticket_id returning * into v_new;
 if v_old.status is distinct from v_new.status then
  insert into public.support_ticket_events(ticket_id,actor_id,actor_scope,event_type,old_status,new_status,message,is_internal)
  values(p_ticket_id,auth.uid(),'admin','status_changed',v_old.status,v_new.status,coalesce(nullif(btrim(p_user_message),''),'Ticket status updated to '||replace(v_new.status,'_',' ')||'.'),false);
 elsif nullif(btrim(p_user_message),'') is not null then
  insert into public.support_ticket_events(ticket_id,actor_id,actor_scope,event_type,old_status,new_status,message,is_internal)
  values(p_ticket_id,auth.uid(),'admin','user_update',v_old.status,v_new.status,btrim(p_user_message),false);
 end if;
 if v_old.admin_notes is distinct from v_new.admin_notes and nullif(btrim(v_new.admin_notes),'') is not null then
  insert into public.support_ticket_events(ticket_id,actor_id,actor_scope,event_type,old_status,new_status,message,is_internal)
  values(p_ticket_id,auth.uid(),'admin','admin_note',v_old.status,v_new.status,btrim(v_new.admin_notes),true);
 end if;
 return jsonb_build_object('success',true,'id',v_new.id,'ticket_code',v_new.ticket_code,'status',v_new.status);
end;$function$;

create or replace function public.admin_get_support_ticket_events(p_ticket_id uuid)
returns table(actor_scope text,event_type text,old_status text,new_status text,message text,is_internal boolean,created_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
begin
 if not public.is_ghardekho_admin() then raise exception 'Admin access required';end if;
 return query select e.actor_scope,e.event_type,e.old_status,e.new_status,e.message,e.is_internal,e.created_at from public.support_ticket_events e where e.ticket_id=p_ticket_id order by e.created_at asc;
end;$function$;

create or replace function public.admin_get_audit_logs(p_limit integer default 50,p_offset integer default 0,p_query text default null)
returns table(id bigint,actor_id uuid,actor_scope text,action text,entity_type text,entity_id text,before_data jsonb,after_data jsonb,request_id text,created_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));v_offset integer:=greatest(0,coalesce(p_offset,0));v_query text:=nullif(btrim(coalesce(p_query,'')),'');
begin
 if not public.is_ghardekho_admin() then raise exception 'Admin access required';end if;
 return query select l.id,l.actor_id,l.actor_scope,l.action,l.entity_type,l.entity_id,l.before_data,l.after_data,l.request_id,l.created_at from public.admin_audit_logs l
 where v_query is null or concat_ws(' ',l.actor_scope,l.action,l.entity_type,l.entity_id,l.actor_id::text,l.request_id,coalesce(l.before_data::text,''),coalesce(l.after_data::text,'')) ilike '%'||v_query||'%' order by l.created_at desc limit v_limit offset v_offset;
end;$function$;

create or replace function public.admin_get_client_errors(p_limit integer default 50)
returns table(id bigint,user_id uuid,error_type text,message text,page_url text,user_agent text,created_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
begin
 if not public.is_ghardekho_admin() then raise exception 'Admin access required';end if;
 return query select e.id,e.user_id,e.error_type,e.message,e.page_url,e.user_agent,e.created_at from public.client_error_events e order by e.created_at desc limit greatest(1,least(coalesce(p_limit,50),100));
end;$function$;

create or replace function public.report_client_error(p_error_type text,p_message text,p_page_url text default null,p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_recent integer;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_error_type not in ('javascript_error','unhandled_rejection','client_failure') then raise exception 'Invalid error type';end if;
 if char_length(btrim(coalesce(p_message,'')))<2 then raise exception 'Error message is required';end if;
 select count(*) into v_recent from public.client_error_events e where e.user_id=auth.uid() and e.created_at>now()-interval '1 minute';
 if v_recent>=5 then return jsonb_build_object('accepted',false,'reason','rate_limited');end if;
 insert into public.client_error_events(user_id,error_type,message,page_url,user_agent) values(auth.uid(),p_error_type,left(regexp_replace(btrim(p_message),'[[:cntrl:]]','','g'),500),left(coalesce(p_page_url,''),500),left(coalesce(p_user_agent,''),300));
 return jsonb_build_object('accepted',true);
end;$function$;

create or replace function public.admin_get_command_center_stats()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_result jsonb;
begin
 if not public.is_ghardekho_admin() then raise exception 'Admin access required';end if;
 select jsonb_build_object(
 'owners_total',(select count(*) from public.owners),
 'renters_total',(select count(*) from public.users u where lower(coalesce(u.role,'')) in ('renter','tenant') or coalesce(u.roles,array[]::text[]) && array['renter','tenant']::text[]),
 'registered_users',(select count(*) from public.users),
 'properties_total',(select count(*) from public.properties p where p.deleted_at is null),
 'active_properties',(select count(*) from public.properties p where p.deleted_at is null and p.verification_status='verified' and p.status in ('verified','occupied','soon_available')),
 'vacant_properties',(select count(*) from public.properties p where p.deleted_at is null and p.verification_status='verified' and p.status in ('verified','soon_available') and not exists(select 1 from public.property_occupancies po where po.property_id=p.id and po.released_at is null)),
 'rented_properties',(select count(distinct po.property_id) from public.property_occupancies po join public.properties p on p.id=po.property_id where po.released_at is null and p.deleted_at is null),
 'visits_total',(select count(*) from public.visit_requests),
 'open_tickets',(select count(*) from public.support_tickets where status in ('open','in_progress','waiting_on_user')),
 'resolved_tickets',(select count(*) from public.support_tickets where status in ('resolved','closed')),
 'total_tickets',(select count(*) from public.support_tickets),
 'audit_events_24h',(select count(*) from public.admin_audit_logs where created_at>now()-interval '24 hours'),
 'client_errors_24h',(select count(*) from public.client_error_events where created_at>now()-interval '24 hours'),
 'new_owners_7d',(select count(*) from public.owners where created_at>now()-interval '7 days'),
 'new_renters_7d',(select count(*) from public.users u where u.created_at>now()-interval '7 days' and (lower(coalesce(u.role,'')) in ('renter','tenant') or coalesce(u.roles,array[]::text[]) && array['renter','tenant']::text[])),
 'new_properties_7d',(select count(*) from public.properties where created_at>now()-interval '7 days' and deleted_at is null),
 'last_audit_at',(select max(created_at) from public.admin_audit_logs)
 ) into v_result;
 return v_result;
end;$function$;

create or replace function public.admin_health_check()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_start timestamptz:=clock_timestamp();v_count bigint;
begin
 if not public.is_ghardekho_admin() then raise exception 'Admin access required';end if;
 select count(*) into v_count from public.properties where deleted_at is null;
 return jsonb_build_object('database','healthy','authenticated_admin',true,'properties_visible',v_count,'server_time',clock_timestamp(),'query_latency_ms',round((extract(epoch from(clock_timestamp()-v_start))*1000)::numeric,2));
end;$function$;

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

create or replace function public.gdr_write_admin_audit_log()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_before jsonb;v_after jsonb;v_row jsonb;v_entity_id text;v_actor uuid:=auth.uid();v_scope text;v_request_id text;
begin
 if tg_op='INSERT' then v_after:=to_jsonb(new)-array['name','email','phone','renter_name','renter_phone','proof_path']::text[];v_row:=to_jsonb(new);
 elsif tg_op='UPDATE' then v_before:=to_jsonb(old)-array['name','email','phone','renter_name','renter_phone','proof_path']::text[];v_after:=to_jsonb(new)-array['name','email','phone','renter_name','renter_phone','proof_path']::text[];v_row:=to_jsonb(new);
 else v_before:=to_jsonb(old)-array['name','email','phone','renter_name','renter_phone','proof_path']::text[];v_row:=to_jsonb(old);end if;
 v_entity_id:=coalesce(v_row->>'id',v_row->>'user_id',v_row->>'property_id');
 v_scope:=case when v_actor is null then 'system' when public.is_ghardekho_admin() then 'admin' else 'user' end;
 v_request_id:=nullif(current_setting('request.jwt.claim.request_id',true),'');
 insert into public.admin_audit_logs(actor_id,actor_scope,action,entity_type,entity_id,before_data,after_data,request_id)
 values(v_actor,v_scope,lower(tg_op),tg_table_name,v_entity_id,v_before,v_after,v_request_id);
 if tg_op='DELETE' then return old;end if;
 return new;
end;$function$;

drop trigger if exists gdr_audit_owners on public.owners;
create trigger gdr_audit_owners after insert or update or delete on public.owners for each row execute function public.gdr_write_admin_audit_log();
drop trigger if exists gdr_audit_users on public.users;
create trigger gdr_audit_users after insert or update or delete on public.users for each row execute function public.gdr_write_admin_audit_log();
drop trigger if exists gdr_audit_properties on public.properties;
create trigger gdr_audit_properties after insert or update or delete on public.properties for each row execute function public.gdr_write_admin_audit_log();
drop trigger if exists gdr_audit_visit_requests on public.visit_requests;
create trigger gdr_audit_visit_requests after insert or update or delete on public.visit_requests for each row execute function public.gdr_write_admin_audit_log();
drop trigger if exists gdr_audit_property_occupancies on public.property_occupancies;
create trigger gdr_audit_property_occupancies after insert or update or delete on public.property_occupancies for each row execute function public.gdr_write_admin_audit_log();
drop trigger if exists gdr_audit_rent_payment_records on public.rent_payment_records;
create trigger gdr_audit_rent_payment_records after insert or update or delete on public.rent_payment_records for each row execute function public.gdr_write_admin_audit_log();
drop trigger if exists gdr_audit_support_tickets on public.support_tickets;
create trigger gdr_audit_support_tickets after insert or update or delete on public.support_tickets for each row execute function public.gdr_write_admin_audit_log();

revoke all on function public.create_support_ticket(uuid,text,text,text,text,text) from public,anon;
revoke all on function public.my_support_tickets() from public,anon;
revoke all on function public.my_support_ticket_events(uuid) from public,anon;
revoke all on function public.admin_list_support_tickets(text) from public,anon;
revoke all on function public.admin_update_support_ticket(uuid,text,text,text) from public,anon;
revoke all on function public.admin_get_support_ticket_events(uuid) from public,anon;
revoke all on function public.admin_get_audit_logs(integer,integer,text) from public,anon;
revoke all on function public.admin_get_client_errors(integer) from public,anon;
revoke all on function public.report_client_error(text,text,text,text) from public,anon;
revoke all on function public.admin_get_command_center_stats() from public,anon;
revoke all on function public.admin_health_check() from public,anon;
revoke all on function public.admin_global_search(text) from public,anon;
grant execute on function public.create_support_ticket(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.my_support_tickets() to authenticated;
grant execute on function public.my_support_ticket_events(uuid) to authenticated;
grant execute on function public.admin_list_support_tickets(text) to authenticated;
grant execute on function public.admin_update_support_ticket(uuid,text,text,text) to authenticated;
grant execute on function public.admin_get_support_ticket_events(uuid) to authenticated;
grant execute on function public.admin_get_audit_logs(integer,integer,text) to authenticated;
grant execute on function public.admin_get_client_errors(integer) to authenticated;
grant execute on function public.report_client_error(text,text,text,text) to authenticated;
grant execute on function public.admin_get_command_center_stats() to authenticated;
grant execute on function public.admin_health_check() to authenticated;
grant execute on function public.admin_global_search(text) to authenticated;
commit;

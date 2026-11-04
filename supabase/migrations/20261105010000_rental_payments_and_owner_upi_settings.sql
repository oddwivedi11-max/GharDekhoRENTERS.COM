-- Additive GharDekho owner UPI settings and renter payment verification schema.
create table if not exists public.owner_payment_settings (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.owners(id) on delete cascade,
 property_id uuid not null unique references public.properties(id) on delete cascade,
 upi_qr_path text, upi_id text, payee_name text, instructions text,
 due_day smallint not null default 5 check(due_day between 1 and 28),
 late_fee_amount numeric(12,2) not null default 0 check(late_fee_amount between 0 and 100000),
 late_fee_grace_days smallint not null default 0 check(late_fee_grace_days between 0 and 30),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
);
create table if not exists public.rent_payment_records (
 id uuid primary key default gen_random_uuid(),
 occupancy_id uuid not null references public.property_occupancies(id) on delete restrict,
 property_id uuid not null references public.properties(id) on delete restrict,
 owner_id uuid not null references public.owners(id) on delete restrict,
 renter_id uuid not null references auth.users(id) on delete restrict,
 billing_period date not null, base_rent numeric(12,2) not null check(base_rent>=0),
 charge_breakdown jsonb not null default '[]'::jsonb, late_fee numeric(12,2) not null default 0 check(late_fee>=0),
 total_amount numeric(12,2) not null check(total_amount>0),
 status text not null default 'pending_verification' check(status in ('pending_verification','paid','rejected')),
 payment_method text not null default 'upi_qr', utr text not null check(length(btrim(utr)) between 6 and 30),
 proof_path text, owner_note text, created_at timestamptz not null default now(),
 verified_at timestamptz, verified_by uuid references auth.users(id)
);
create unique index if not exists rent_payment_records_utr_unique_idx on public.rent_payment_records(upper(utr));
create index if not exists rent_payment_records_owner_recent_idx on public.rent_payment_records(owner_id,created_at desc);
create index if not exists rent_payment_records_renter_recent_idx on public.rent_payment_records(renter_id,created_at desc);
create index if not exists rent_payment_records_occupancy_period_idx on public.rent_payment_records(occupancy_id,billing_period desc);
alter table public.owner_payment_settings enable row level security;
alter table public.rent_payment_records enable row level security;
drop policy if exists owner_payment_settings_owner_all on public.owner_payment_settings;
create policy owner_payment_settings_owner_all on public.owner_payment_settings for all to authenticated
using(owner_id in(select o.id from public.owners o where o.user_id=(select auth.uid())))
with check(owner_id in(select o.id from public.owners o where o.user_id=(select auth.uid())) and exists(select 1 from public.properties p where p.id=property_id and p.owner_id=owner_id));
drop policy if exists owner_payment_settings_renter_read on public.owner_payment_settings;
create policy owner_payment_settings_renter_read on public.owner_payment_settings for select to authenticated
using(exists(select 1 from public.property_occupancies po where po.property_id=owner_payment_settings.property_id and po.renter_id=(select auth.uid()) and po.released_at is null));
drop policy if exists occupancy_charges_renter_read on public.occupancy_charges;
create policy occupancy_charges_renter_read on public.occupancy_charges for select to authenticated using(exists(select 1 from public.property_occupancies po where po.id=occupancy_charges.occupancy_id and po.renter_id=(select auth.uid()) and po.released_at is null));
drop policy if exists rent_payment_records_owner_read on public.rent_payment_records;
create policy rent_payment_records_owner_read on public.rent_payment_records for select to authenticated
using(owner_id in(select o.id from public.owners o where o.user_id=(select auth.uid())));
drop policy if exists rent_payment_records_renter_read on public.rent_payment_records;
create policy rent_payment_records_renter_read on public.rent_payment_records for select to authenticated
using(renter_id=(select auth.uid()));
revoke all on public.owner_payment_settings from anon;
grant select,insert,update,delete on public.owner_payment_settings to authenticated;
revoke all on public.rent_payment_records from anon,authenticated;
grant select on public.rent_payment_records to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('owner-payment-qr','owner-payment-qr',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rent-payment-proofs','rent-payment-proofs',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
drop policy if exists owner_payment_qr_owner_insert on storage.objects;
create policy owner_payment_qr_owner_insert on storage.objects for insert to authenticated with check(bucket_id='owner-payment-qr' and exists(select 1 from public.owners o where o.user_id=(select auth.uid()) and o.id::text=(storage.foldername(name))[1]));
drop policy if exists owner_payment_qr_owner_read on storage.objects;
create policy owner_payment_qr_owner_read on storage.objects for select to authenticated using(bucket_id='owner-payment-qr' and exists(select 1 from public.owners o where o.user_id=(select auth.uid()) and o.id::text=(storage.foldername(name))[1]));
drop policy if exists owner_payment_qr_owner_update on storage.objects;
create policy owner_payment_qr_owner_update on storage.objects for update to authenticated using(bucket_id='owner-payment-qr' and exists(select 1 from public.owners o where o.user_id=(select auth.uid()) and o.id::text=(storage.foldername(name))[1])) with check(bucket_id='owner-payment-qr' and exists(select 1 from public.owners o where o.user_id=(select auth.uid()) and o.id::text=(storage.foldername(name))[1]));
drop policy if exists owner_payment_qr_owner_delete on storage.objects;
create policy owner_payment_qr_owner_delete on storage.objects for delete to authenticated using(bucket_id='owner-payment-qr' and exists(select 1 from public.owners o where o.user_id=(select auth.uid()) and o.id::text=(storage.foldername(name))[1]));
drop policy if exists rent_payment_proof_renter_insert on storage.objects;
create policy rent_payment_proof_renter_insert on storage.objects for insert to authenticated with check(bucket_id='rent-payment-proofs' and exists(select 1 from public.property_occupancies po where po.id::text=(storage.foldername(name))[1] and po.renter_id=(select auth.uid()) and po.released_at is null));
drop policy if exists rent_payment_proof_renter_or_owner_read on storage.objects;
create policy rent_payment_proof_renter_or_owner_read on storage.objects for select to authenticated using(bucket_id='rent-payment-proofs' and exists(select 1 from public.property_occupancies po where po.id::text=(storage.foldername(name))[1] and (po.renter_id=(select auth.uid()) or exists(select 1 from public.owners o where o.id=po.owner_id and o.user_id=(select auth.uid())))));
create or replace function public.get_my_current_rental_details()
returns table(occupancy_id uuid,property_id uuid,owner_id uuid,title text,name text,location text,address text,rent numeric,listing_type text,room_type text,bhk integer,furnishing text,image_url text,occupied_at timestamptz,expected_move_out_at date,owner_name text,owner_phone text)
language sql stable security definer set search_path=''
as $$ select po.id,p.id,p.owner_id,p.title,p.name,p.location,p.address,p.rent,p.listing_type,p.room_type,p.bhk,p.furnishing,p.image_url,po.occupied_at,po.expected_move_out_at,o.name,o.phone
from public.property_occupancies po join public.properties p on p.id=po.property_id join public.owners o on o.id=po.owner_id
where po.renter_id=(select auth.uid()) and po.released_at is null order by po.occupied_at desc limit 1 $$;
revoke all on function public.get_my_current_rental_details() from public,anon;
grant execute on function public.get_my_current_rental_details() to authenticated;
create or replace function public.create_rent_payment_submission(p_occupancy_id uuid,p_billing_period date,p_utr text,p_proof_path text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_po public.property_occupancies%rowtype; v_rent numeric(12,2); v_due integer:=5; v_late numeric(12,2):=0; v_grace integer:=0; v_due_date date; v_charges jsonb:='[]'::jsonb; v_extra numeric(12,2):=0; v_total numeric(12,2); v_period date:=date_trunc('month',p_billing_period)::date; v_id uuid;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if p_utr is null or p_utr !~ '^[A-Za-z0-9-]{6,30}$' then raise exception 'Enter a valid UTR/reference number'; end if;
 select * into v_po from public.property_occupancies where id=p_occupancy_id and renter_id=v_uid and released_at is null for update;
 if not found then raise exception 'Active rental not found'; end if;
 if p_proof_path is not null and split_part(p_proof_path,'/',1)<>p_occupancy_id::text then raise exception 'Invalid payment proof path'; end if;
 select coalesce(p.rent,0) into v_rent from public.properties p where p.id=v_po.property_id;
 select coalesce(s.due_day,5),coalesce(s.late_fee_amount,0),coalesce(s.late_fee_grace_days,0) into v_due,v_late,v_grace from public.owner_payment_settings s where s.property_id=v_po.property_id;
 v_due_date:=v_period+(v_due-1); if current_date<=v_due_date+v_grace then v_late:=0; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',ch.id,'title',ch.title,'amount',ch.amount,'frequency',ch.frequency,'due_day',ch.due_day)),'[]'::jsonb),coalesce(sum(ch.amount),0)
 into v_charges,v_extra from public.occupancy_charges ch where ch.occupancy_id=v_po.id and ch.owner_id=v_po.owner_id and ch.is_active and ch.frequency='monthly';
 v_total:=v_rent+v_extra+v_late; if v_total<=0 then raise exception 'No payable amount is configured'; end if;
 if exists(select 1 from public.rent_payment_records r where r.occupancy_id=v_po.id and r.billing_period=v_period and r.status in('pending_verification','paid')) then raise exception 'A payment submission already exists for this billing period'; end if;
 insert into public.rent_payment_records(occupancy_id,property_id,owner_id,renter_id,billing_period,base_rent,charge_breakdown,late_fee,total_amount,utr,proof_path,status)
 values(v_po.id,v_po.property_id,v_po.owner_id,v_uid,v_period,v_rent,v_charges,v_late,v_total,upper(p_utr),p_proof_path,'pending_verification') returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_rent_payment_submission(uuid,date,text,text) from public,anon;
grant execute on function public.create_rent_payment_submission(uuid,date,text,text) to authenticated;
create or replace function public.owner_verify_rent_payment(p_payment_id uuid,p_decision text,p_note text default null)
returns boolean language plpgsql security definer set search_path=''
as $$ declare v_uid uuid:=auth.uid(); v_count integer; begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if p_decision not in('paid','rejected') then raise exception 'Invalid payment decision'; end if;
 update public.rent_payment_records r set status=p_decision,owner_note=nullif(left(btrim(coalesce(p_note,'')),500),''),verified_at=now(),verified_by=v_uid
 where r.id=p_payment_id and r.status='pending_verification' and exists(select 1 from public.owners o where o.id=r.owner_id and o.user_id=v_uid);
 get diagnostics v_count=row_count; if v_count=0 then raise exception 'Payment not found or already reviewed'; end if; return true;
end $$;
revoke all on function public.owner_verify_rent_payment(uuid,text,text) from public,anon;
grant execute on function public.owner_verify_rent_payment(uuid,text,text) to authenticated;

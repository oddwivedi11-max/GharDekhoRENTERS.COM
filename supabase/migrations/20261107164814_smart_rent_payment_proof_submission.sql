-- Smart rent payment screenshot submission. Applied to production on 2026-11-07.
alter table public.rent_payment_records alter column utr drop not null;
alter table public.rent_payment_records drop constraint if exists rent_payment_records_utr_check;
alter table public.rent_payment_records add constraint rent_payment_records_utr_check
  check (utr is null or length(btrim(utr)) between 6 and 30);
alter table public.rent_payment_records
  add column if not exists payment_date date not null default current_date;

create or replace function public.create_rent_payment_submission(
  p_occupancy_id uuid,p_billing_period date,p_utr text,p_proof_path text,
  p_payment_date date,p_payment_method text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_po public.property_occupancies%rowtype;
  v_rent numeric(12,2);
  v_due integer:=5;
  v_late numeric(12,2):=0;
  v_grace integer:=0;
  v_due_date date;
  v_charges jsonb:='[]'::jsonb;
  v_extra numeric(12,2):=0;
  v_total numeric(12,2);
  v_period date:=date_trunc('month',p_billing_period)::date;
  v_id uuid;
  v_utr text:=nullif(upper(btrim(coalesce(p_utr,''))),'');
  v_method text:=lower(btrim(coalesce(p_payment_method,'')));
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_utr is not null and v_utr !~ '^[A-Z0-9-]{6,30}$' then raise exception 'Enter a valid UTR/reference number'; end if;
  if p_payment_date is null or p_payment_date>current_date then raise exception 'Payment date cannot be in the future'; end if;
  if v_method not in ('upi_gpay','upi_phonepe','upi_paytm','upi_other') then raise exception 'Choose a valid UPI payment app'; end if;
  select * into v_po from public.property_occupancies
    where id=p_occupancy_id and renter_id=v_uid and released_at is null for update;
  if not found then raise exception 'Active rental not found'; end if;
  if p_proof_path is not null and split_part(p_proof_path,'/',1)<>p_occupancy_id::text then raise exception 'Invalid payment proof path'; end if;
  select coalesce(p.rent,0) into v_rent from public.properties p where p.id=v_po.property_id;
  select coalesce(s.due_day,5),coalesce(s.late_fee_amount,0),coalesce(s.late_fee_grace_days,0)
    into v_due,v_late,v_grace from public.owner_payment_settings s where s.property_id=v_po.property_id;
  v_due_date:=v_period+(v_due-1);
  if current_date<=v_due_date+v_grace then v_late:=0; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',ch.id,'title',ch.title,'amount',ch.amount,'frequency',ch.frequency,'due_day',ch.due_day)),'[]'::jsonb),coalesce(sum(ch.amount),0)
    into v_charges,v_extra from public.occupancy_charges ch
    where ch.occupancy_id=v_po.id and ch.owner_id=v_po.owner_id and ch.is_active and ch.frequency='monthly';
  v_total:=v_rent+v_extra+v_late;
  if v_total<=0 then raise exception 'No payable amount is configured'; end if;
  if exists(select 1 from public.rent_payment_records r where r.occupancy_id=v_po.id and r.billing_period=v_period and r.status in('pending_verification','paid')) then
    raise exception 'A payment submission already exists for this billing period';
  end if;
  insert into public.rent_payment_records(
    occupancy_id,property_id,owner_id,renter_id,billing_period,base_rent,charge_breakdown,
    late_fee,total_amount,utr,proof_path,payment_date,payment_method,status
  ) values (
    v_po.id,v_po.property_id,v_po.owner_id,v_uid,v_period,v_rent,v_charges,
    v_late,v_total,v_utr,p_proof_path,p_payment_date,v_method,'pending_verification'
  ) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_rent_payment_submission(uuid,date,text,text,date,text) from public,anon;
grant execute on function public.create_rent_payment_submission(uuid,date,text,text,date,text) to authenticated;

create table if not exists public.owner_rent_ledger_entries (
 id uuid primary key default gen_random_uuid(),
 occupancy_id uuid not null references public.property_occupancies(id) on delete restrict,
 property_id uuid not null references public.properties(id) on delete restrict,
 owner_id uuid not null references public.owners(id) on delete restrict,
 billing_period date not null,
 amount numeric(12,2) not null check(amount>0 and amount<=10000000),
 payment_method text not null check(payment_method in('upi','cash','bank_transfer','other')),
 reference text,
 note text,
 received_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id),
 idempotency_key uuid not null unique
);
create index if not exists owner_rent_ledger_entries_occupancy_period_idx on public.owner_rent_ledger_entries(occupancy_id,billing_period desc,received_at desc);
create index if not exists owner_rent_ledger_entries_owner_recent_idx on public.owner_rent_ledger_entries(owner_id,created_at desc);
alter table public.owner_rent_ledger_entries enable row level security;
revoke all on public.owner_rent_ledger_entries from anon,authenticated;
grant select on public.owner_rent_ledger_entries to authenticated;
drop policy if exists owner_rent_ledger_entries_owner_read on public.owner_rent_ledger_entries;
create policy owner_rent_ledger_entries_owner_read on public.owner_rent_ledger_entries for select to authenticated using(exists(select 1 from public.owners o where o.id=owner_rent_ledger_entries.owner_id and o.user_id=(select auth.uid())));
create or replace function public.owner_add_rent_ledger_payment(p_occupancy_id uuid,p_billing_period date,p_amount numeric,p_payment_method text,p_reference text default null,p_note text default null,p_idempotency_key uuid default gen_random_uuid())
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_po public.property_occupancies%rowtype; v_id uuid;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if p_amount is null or p_amount<=0 or p_amount>10000000 then raise exception 'Enter a valid payment amount'; end if;
 if p_billing_period is null or p_billing_period<>date_trunc('month',p_billing_period)::date then raise exception 'Billing period must be the first day of a month'; end if;
 if p_payment_method not in('upi','cash','bank_transfer','other') then raise exception 'Invalid payment method'; end if;
 if p_idempotency_key is null then raise exception 'Payment request key is required'; end if;
 select * into v_po from public.property_occupancies po where po.id=p_occupancy_id and po.released_at is null and exists(select 1 from public.owners o where o.id=po.owner_id and o.user_id=v_uid) for update;
 if not found then raise exception 'Active renter not found or you do not own this property'; end if;
 insert into public.owner_rent_ledger_entries(occupancy_id,property_id,owner_id,billing_period,amount,payment_method,reference,note,created_by,idempotency_key)
 values(v_po.id,v_po.property_id,v_po.owner_id,p_billing_period,round(p_amount,2),p_payment_method,nullif(left(btrim(coalesce(p_reference,'')),100),''),nullif(left(btrim(coalesce(p_note,'')),300),''),v_uid,p_idempotency_key)
 on conflict(idempotency_key) do nothing returning id into v_id;
 if v_id is null then select id into v_id from public.owner_rent_ledger_entries where idempotency_key=p_idempotency_key; end if;
 return v_id;
end;
$$;
revoke all on function public.owner_add_rent_ledger_payment(uuid,date,numeric,text,text,text,uuid) from public,anon;
grant execute on function public.owner_add_rent_ledger_payment(uuid,date,numeric,text,text,text,uuid) to authenticated;

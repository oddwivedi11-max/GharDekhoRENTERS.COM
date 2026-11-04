-- Additive owner renter-management fields. Apply only after review and backup.
-- No existing occupancy, renter, or property rows are deleted or rewritten.

alter table public.property_occupancies
  add column if not exists expected_move_out_at date;

grant update (expected_move_out_at)
  on public.property_occupancies to authenticated;

create table if not exists public.occupancy_charges (
  id uuid primary key default gen_random_uuid(),
  occupancy_id uuid not null references public.property_occupancies(id),
  owner_id uuid not null references public.owners(id),
  title text not null check (length(btrim(title)) between 2 and 100),
  amount numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  frequency text not null default 'monthly' check (frequency in ('monthly','one_time')),
  due_day smallint check (due_day between 1 and 28),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists occupancy_charges_occupancy_active_idx
  on public.occupancy_charges(occupancy_id, is_active, created_at desc);

alter table public.occupancy_charges enable row level security;

drop policy if exists occupancy_charges_owner_select on public.occupancy_charges;
create policy occupancy_charges_owner_select
on public.occupancy_charges for select to authenticated
using (
  owner_id in (select o.id from public.owners o where o.user_id = (select auth.uid()))
  and exists (
    select 1 from public.property_occupancies po
    where po.id = occupancy_charges.occupancy_id
      and po.owner_id = occupancy_charges.owner_id
  )
);

drop policy if exists occupancy_charges_owner_insert on public.occupancy_charges;
create policy occupancy_charges_owner_insert
on public.occupancy_charges for insert to authenticated
with check (
  owner_id in (select o.id from public.owners o where o.user_id = (select auth.uid()))
  and exists (
    select 1 from public.property_occupancies po
    where po.id = occupancy_charges.occupancy_id
      and po.owner_id = occupancy_charges.owner_id
      and po.released_at is null
  )
);

drop policy if exists occupancy_charges_owner_update on public.occupancy_charges;
create policy occupancy_charges_owner_update
on public.occupancy_charges for update to authenticated
using (
  owner_id in (select o.id from public.owners o where o.user_id = (select auth.uid()))
  and exists (
    select 1 from public.property_occupancies po
    where po.id = occupancy_charges.occupancy_id
      and po.owner_id = occupancy_charges.owner_id
  )
)
with check (
  owner_id in (select o.id from public.owners o where o.user_id = (select auth.uid()))
  and exists (
    select 1 from public.property_occupancies po
    where po.id = occupancy_charges.occupancy_id
      and po.owner_id = occupancy_charges.owner_id
  )
);

drop policy if exists occupancy_charges_owner_delete on public.occupancy_charges;
create policy occupancy_charges_owner_delete
on public.occupancy_charges for delete to authenticated
using (
  owner_id in (select o.id from public.owners o where o.user_id = (select auth.uid()))
  and exists (
    select 1 from public.property_occupancies po
    where po.id = occupancy_charges.occupancy_id
      and po.owner_id = occupancy_charges.owner_id
  )
);

grant select, insert, update, delete on public.occupancy_charges to authenticated;
revoke all on public.occupancy_charges from anon;

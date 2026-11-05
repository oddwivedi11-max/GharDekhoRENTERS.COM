-- Cover owner-scoped active charge queries used by GDR Finance.
create index if not exists occupancy_charges_owner_active_idx
  on public.occupancy_charges(owner_id, is_active, created_at desc);

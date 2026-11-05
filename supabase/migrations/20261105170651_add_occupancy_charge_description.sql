-- Add a descriptive field to owner-managed occupancy charges.
-- This is an additive change: existing charge rows and RLS policies are preserved.
alter table public.occupancy_charges
  add column if not exists description text
  check (description is null or length(description) <= 500);

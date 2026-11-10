-- Add an optional owner payment contact number and index owner-scoped lookups.
-- Nullable/additive: existing owner payment settings and renter records are preserved.
alter table public.owner_payment_settings
  add column if not exists payment_mobile text;

create index if not exists owner_payment_settings_owner_id_idx
  on public.owner_payment_settings (owner_id);

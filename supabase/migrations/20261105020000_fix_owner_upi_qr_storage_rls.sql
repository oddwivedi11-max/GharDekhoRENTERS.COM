-- Fix owner UPI QR Storage policies: qualify storage.objects.name to avoid
-- resolving "name" to public.owners.name inside the EXISTS subquery.
drop policy if exists owner_payment_qr_owner_insert on storage.objects;
drop policy if exists owner_payment_qr_owner_read on storage.objects;
drop policy if exists owner_payment_qr_owner_update on storage.objects;
drop policy if exists owner_payment_qr_owner_delete on storage.objects;

create policy owner_payment_qr_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'owner-payment-qr'
  and exists (
    select 1 from public.owners o
    where o.user_id = (select auth.uid())
      and o.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

create policy owner_payment_qr_owner_read
on storage.objects for select to authenticated
using (
  bucket_id = 'owner-payment-qr'
  and exists (
    select 1 from public.owners o
    where o.user_id = (select auth.uid())
      and o.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

create policy owner_payment_qr_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'owner-payment-qr'
  and exists (
    select 1 from public.owners o
    where o.user_id = (select auth.uid())
      and o.id::text = (storage.foldername(storage.objects.name))[1]
  )
)
with check (
  bucket_id = 'owner-payment-qr'
  and exists (
    select 1 from public.owners o
    where o.user_id = (select auth.uid())
      and o.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

create policy owner_payment_qr_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'owner-payment-qr'
  and exists (
    select 1 from public.owners o
    where o.user_id = (select auth.uid())
      and o.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- Enforce both ownership and the property-to-owner relationship on settings.
drop policy if exists owner_payment_settings_owner_all on public.owner_payment_settings;
create policy owner_payment_settings_owner_all
on public.owner_payment_settings for all to authenticated
using (
  exists (
    select 1 from public.owners o
    join public.properties p on p.owner_id = o.id
    where o.user_id = (select auth.uid())
      and o.id = owner_payment_settings.owner_id
      and p.id = owner_payment_settings.property_id
  )
)
with check (
  exists (
    select 1 from public.owners o
    join public.properties p on p.owner_id = o.id
    where o.user_id = (select auth.uid())
      and o.id = owner_payment_settings.owner_id
      and p.id = owner_payment_settings.property_id
  )
);

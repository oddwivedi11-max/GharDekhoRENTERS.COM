-- Consolidate permissive SELECT policies using OR-equivalent predicates.
-- No INSERT, UPDATE, DELETE, or ALL policy is changed.
-- Anonymous public listing visibility remains unchanged.

alter policy "Public can view verified properties"
  on public.properties to anon;

drop policy if exists "Owners can view own properties" on public.properties;
drop policy if exists properties_admin_select on public.properties;
drop policy if exists properties_owner_select on public.properties;
drop policy if exists properties_authenticated_select on public.properties;

create policy properties_authenticated_select
  on public.properties
  as permissive
  for select
  to authenticated
  using (
    public.is_ghardekho_admin()
    or status = any (array['verified'::text,'occupied'::text,'soon_available'::text])
    or (
      verification_status = 'verified'
      and status = any (array['verified'::text,'occupied'::text,'soon_available'::text])
    )
    or exists (
      select 1 from public.owners o
      where o.id = properties.owner_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists occupancy_charges_owner_select on public.occupancy_charges;
drop policy if exists occupancy_charges_renter_read on public.occupancy_charges;
create policy occupancy_charges_owner_select
  on public.occupancy_charges
  as permissive
  for select
  to authenticated
  using (
    (
      owner_id in (select o.id from public.owners o where o.user_id = (select auth.uid()))
      and exists (
        select 1 from public.property_occupancies po
        where po.id = occupancy_charges.occupancy_id
          and po.owner_id = occupancy_charges.owner_id
      )
    )
    or exists (
      select 1 from public.property_occupancies po
      where po.id = occupancy_charges.occupancy_id
        and po.renter_id = (select auth.uid())
        and po.released_at is null
    )
  );

drop policy if exists rent_payment_records_owner_read on public.rent_payment_records;
drop policy if exists rent_payment_records_renter_read on public.rent_payment_records;
create policy rent_payment_records_owner_read
  on public.rent_payment_records
  as permissive
  for select
  to authenticated
  using (
    owner_id in (select o.id from public.owners o where o.user_id = (select auth.uid()))
    or renter_id = (select auth.uid())
  );

drop policy if exists saved_properties_admin_select on public.saved_properties;
drop policy if exists saved_properties_select_own on public.saved_properties;
create policy saved_properties_select_own
  on public.saved_properties
  as permissive
  for select
  to authenticated
  using (
    public.is_ghardekho_admin()
    or user_id = (select auth.uid())
  );

drop policy if exists users_admin_select on public.users;
drop policy if exists users_select_own on public.users;
create policy users_select_own
  on public.users
  as permissive
  for select
  to authenticated
  using (
    public.is_ghardekho_admin()
    or id = (select auth.uid())
  );

drop policy if exists visit_requests_admin_select on public.visit_requests;
drop policy if exists visit_requests_authenticated_select on public.visit_requests;
create policy visit_requests_authenticated_select
  on public.visit_requests
  as permissive
  for select
  to authenticated
  using (
    public.is_ghardekho_admin()
    or owner_id in (select o.id from public.owners o where o.user_id = (select auth.uid()))
    or tenant_id = (select auth.uid())
  );

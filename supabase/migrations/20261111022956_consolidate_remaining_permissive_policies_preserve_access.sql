-- Consolidate the remaining duplicate permissive policies with exact OR-equivalent predicates.
-- Owner/admin and renter access remains unchanged. Existing action constraints are preserved.

-- Properties DELETE: admin OR owner.
drop policy if exists properties_admin_delete on public.properties;
drop policy if exists properties_owner_delete on public.properties;
create policy properties_owner_delete
  on public.properties as permissive for delete to authenticated
  using (
    public.is_ghardekho_admin()
    or owner_id in (select o.id from public.owners o where o.user_id=(select auth.uid()))
  );

-- Properties INSERT: admin OR owner pending-only validation.
drop policy if exists properties_admin_insert on public.properties;
drop policy if exists properties_owner_insert_pending_only on public.properties;
create policy properties_owner_insert_pending_only
  on public.properties as permissive for insert to authenticated
  with check (
    public.is_ghardekho_admin()
    or (
      verification_status='pending'
      and status='pending'
      and owner_id in (select o.id from public.owners o where o.user_id=(select auth.uid()))
      and nullif(btrim(address),'') is not null
      and latitude is not null
      and longitude is not null
      and latitude >= -90 and latitude <= 90
      and longitude >= -180 and longitude <= 180
    )
  );

-- Properties UPDATE: admin OR owner; owner must retain the original bounds.
drop policy if exists properties_admin_update on public.properties;
drop policy if exists properties_owner_update on public.properties;
create policy properties_owner_update
  on public.properties as permissive for update to authenticated
  using (
    public.is_ghardekho_admin()
    or owner_id in (select o.id from public.owners o where o.user_id=(select auth.uid()))
  )
  with check (
    public.is_ghardekho_admin()
    or (
      owner_id in (select o.id from public.owners o where o.user_id=(select auth.uid()))
      and status = any(array['verified'::text,'pending'::text,'occupied'::text,'soon_available'::text])
      and nullif(btrim(address),'') is not null
      and latitude is not null
      and longitude is not null
      and latitude >= -90 and latitude <= 90
      and longitude >= -180 and longitude <= 180
    )
  );

-- Saved properties DELETE: admin OR the owning user.
drop policy if exists saved_properties_admin_delete on public.saved_properties;
drop policy if exists saved_properties_delete_own on public.saved_properties;
create policy saved_properties_delete_own
  on public.saved_properties as permissive for delete to authenticated
  using (
    public.is_ghardekho_admin()
    or user_id=(select auth.uid())
  );

-- Users UPDATE: admin OR self, in both USING and WITH CHECK.
drop policy if exists users_admin_update on public.users;
drop policy if exists users_update_own on public.users;
create policy users_update_own
  on public.users as permissive for update to authenticated
  using (
    public.is_ghardekho_admin()
    or id=(select auth.uid())
  )
  with check (
    public.is_ghardekho_admin()
    or id=(select auth.uid())
  );

-- Split the prior owner ALL policy into action-specific owner policies.
-- The SELECT policy combines the original owner predicate with active-renter reads.
drop policy if exists owner_payment_settings_owner_all on public.owner_payment_settings;
drop policy if exists owner_payment_settings_renter_read on public.owner_payment_settings;

create policy owner_payment_settings_select
  on public.owner_payment_settings as permissive for select to authenticated
  using (
    exists (
      select 1
      from public.owners o
      join public.properties p on p.owner_id=o.id
      where o.user_id=(select auth.uid())
        and o.id=owner_payment_settings.owner_id
        and p.id=owner_payment_settings.property_id
    )
    or exists (
      select 1 from public.property_occupancies po
      where po.property_id=owner_payment_settings.property_id
        and po.renter_id=(select auth.uid())
        and po.released_at is null
    )
  );

create policy owner_payment_settings_owner_insert
  on public.owner_payment_settings as permissive for insert to authenticated
  with check (
    exists (
      select 1
      from public.owners o
      join public.properties p on p.owner_id=o.id
      where o.user_id=(select auth.uid())
        and o.id=owner_payment_settings.owner_id
        and p.id=owner_payment_settings.property_id
    )
  );

create policy owner_payment_settings_owner_update
  on public.owner_payment_settings as permissive for update to authenticated
  using (
    exists (
      select 1
      from public.owners o
      join public.properties p on p.owner_id=o.id
      where o.user_id=(select auth.uid())
        and o.id=owner_payment_settings.owner_id
        and p.id=owner_payment_settings.property_id
    )
  )
  with check (
    exists (
      select 1
      from public.owners o
      join public.properties p on p.owner_id=o.id
      where o.user_id=(select auth.uid())
        and o.id=owner_payment_settings.owner_id
        and p.id=owner_payment_settings.property_id
    )
  );

create policy owner_payment_settings_owner_delete
  on public.owner_payment_settings as permissive for delete to authenticated
  using (
    exists (
      select 1
      from public.owners o
      join public.properties p on p.owner_id=o.id
      where o.user_id=(select auth.uid())
        and o.id=owner_payment_settings.owner_id
        and p.id=owner_payment_settings.property_id
    )
  );

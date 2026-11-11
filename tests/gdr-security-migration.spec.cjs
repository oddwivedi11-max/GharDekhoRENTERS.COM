const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const migration = (name) => fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'migrations', name),
  'utf8'
);

test.describe('GDR draft SQL security guardrails (static checks only)', () => {
  test('owner contact migration requires authentication and an approved visit', () => {
    const sql = migration('20261020200000_limit_owner_contact_to_approved_visits.sql');

    expect(sql).toMatch(/if\s+auth\.uid\(\)\s+is\s+null\s+then/i);
    expect(sql).toMatch(/o\.verification_status\s*=\s*'verified'/i);
    expect(sql).toMatch(/vr\.tenant_id\s*=\s*auth\.uid\(\)/i);
    expect(sql).toMatch(/lower\(coalesce\(vr\.status,\s*''\)\)\s*=\s*'approved'/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.get_verified_owner_contact\(uuid\)\s+from\s+public,\s*anon/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.get_verified_owner_contact\(uuid\)\s+to\s+authenticated/i);
  });

  test('owner property RPCs enforce authentication, ownership and input bounds', () => {
    const sql = migration('20261020190000_guard_owner_property_updates_and_validate_images.sql');

    expect(sql).toMatch(/if\s+v_user_id\s+is\s+null\s+then\s+raise\s+exception\s+'Authentication required'/i);
    expect(sql).toMatch(/where\s+p\.id\s*=\s*p_property_id\s+and\s+p\.owner_id\s*=\s*v_owner_id/i);
    expect(sql).toMatch(/v_property\.status\s*=\s*'occupied'\s+and\s+v_requires_reverification/i);
    expect(sql).toMatch(/new\.verification_status\s+is\s+distinct\s+from\s+'pending'/i);
    expect(sql).toMatch(/p_rent\s+is\s+null\s+or\s+p_rent\s*<\s*1\s+or\s+p_rent\s*>\s*10000000/i);
    expect(sql).toMatch(/property-images\/'\s*\|\|\s*v_user_id::text\s*\|\|\s*'\//i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.owner_add_property\([\s\S]*?from\s+public,\s*anon/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.owner_add_property\([\s\S]*?to\s+authenticated/i);
  });

  test('legacy visit status RPC is owner-scoped and only updates pending requests', () => {
    const sql = migration('20261020210000_harden_legacy_owner_visit_rpc.sql');

    expect(sql).toMatch(/if\s+auth\.uid\(\)\s+is\s+null\s+then/i);
    expect(sql).toMatch(/p_status\s+not\s+in\s*\('approved',\s*'rejected'\)/i);
    expect(sql).toMatch(/vr\.status\s*=\s*'pending'/i);
    expect(sql).toMatch(/where\s+o\.user_id\s*=\s*auth\.uid\(\)/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.owner_update_visit_status\(uuid,\s*text\)\s+from\s+public,\s*anon/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.owner_update_visit_status\(uuid,\s*text\)\s+to\s+authenticated/i);
  });
});



test.describe('GharDekho 2026-11-10 database security and inventory migration', () => {
  test('public inventory excludes archived pending rows and preserves intentional public search RPCs', () => {
    const sql = migration('20261110210119_fix_public_archive_filter_trigger_acl_and_fk_indexes.sql').toLowerCase();

    expect(sql).toContain('where p.deleted_at is null');
    expect(sql).toContain('and (');
    expect(sql).toContain("(p.verification_status='pending' and p.status='pending')");
    expect(sql).toContain("p.status='occupied'");
    expect(sql).toContain('po.released_at is null');
    expect(sql).toContain('revoke execute on function public.gdr_write_admin_audit_log() from public,anon,authenticated;');
    for (const name of [
      'get_public_properties',
      'get_map_properties_in_bounds',
      'get_available_map_properties_in_bounds',
      'get_nearby_properties',
      'search_public_properties_for_assistant',
    ]) {
      expect(sql).not.toContain('revoke execute on function public.' + name);
    }
  });

  test('the migration adds the four audited foreign-key indexes without removing application tables', () => {
    const sql = migration('20261110210119_fix_public_archive_filter_trigger_acl_and_fk_indexes.sql').toLowerCase();
    for (const name of [
      'owner_rent_ledger_entries_created_by_idx',
      'owner_rent_ledger_entries_property_id_idx',
      'rent_payment_records_property_id_idx',
      'rent_payment_records_verified_by_idx',
    ]) {
      expect(sql).toContain('create index if not exists ' + name);
    }
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('drop column');
    expect(sql).not.toContain('delete from public.');
  });
});


test.describe('GharDekho policy-consolidation migrations preserve role access', () => {
  test('SELECT policies retain public, owner, renter and admin predicates', () => {
    const sql = migration('20261111022712_consolidate_select_policies_without_changing_access.sql').toLowerCase();
    expect(sql).toContain('alter policy "public can view verified properties"');
    expect(sql).toContain('on public.properties to anon');
    expect(sql).toContain('public.is_ghardekho_admin()');
    expect(sql).toContain('occupancy_charges_owner_select');
    expect(sql).toContain('po.renter_id = (select auth.uid())');
    expect(sql).toContain('rent_payment_records_owner_read');
    expect(sql).toContain('renter_id = (select auth.uid())');
    expect(sql).toContain('tenant_id = (select auth.uid())');
  });

  test('write policies keep admin/owner checks and owner-only payment-setting actions', () => {
    const sql = migration('20261111022956_consolidate_remaining_permissive_policies_preserve_access.sql').toLowerCase();
    expect(sql).toContain('create policy properties_owner_delete');
    expect(sql).toContain('create policy properties_owner_insert_pending_only');
    expect(sql).toContain("verification_status='pending'");
    expect(sql).toContain('create policy properties_owner_update');
    expect(sql).toContain('create policy users_update_own');
    expect(sql).toContain('id=(select auth.uid())');
    expect(sql).toContain('create policy owner_payment_settings_owner_insert');
    expect(sql).toContain('create policy owner_payment_settings_owner_update');
    expect(sql).toContain('create policy owner_payment_settings_owner_delete');
    expect(sql).toContain('po.released_at is null');
  });
});

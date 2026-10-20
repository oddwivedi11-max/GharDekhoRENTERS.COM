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

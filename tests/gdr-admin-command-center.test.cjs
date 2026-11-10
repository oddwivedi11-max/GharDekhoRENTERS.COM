const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('existing Admin Login and dashboard are preserved on both page entry files', () => {
  for (const file of ['index.html', 'admin/control.html']) {
    const html = read(file);
    assert.match(html, /id="adminDashboard"/, file + ': existing admin dashboard remains');
    assert.match(html, /function openAdminArea\(\)/, file + ': existing admin entry remains');
    assert.match(html, /SUPABASE_PUBLISHABLE_KEY/, file + ': current Supabase client wiring remains');
    assert.match(html, /gdr-admin-command-center\.js\?v=20261110-commandcenter1/, file + ': command center script loaded');
    assert.match(html, /gdr-admin-command-center\.css\?v=20261110-commandcenter1/, file + ': command center styles loaded');
    assert.match(html, /(?:async )?function loginUser\(\)/, file + ': existing login handler remains');
  }
});

test('command center calls real admin-guarded RPCs and adds support entry points', () => {
  const source = read('assets/gdr-admin-command-center.js');
  for (const rpc of [
    'admin_get_command_center_stats','admin_health_check','admin_global_search',
    'admin_list_support_tickets','admin_update_support_ticket','admin_get_support_ticket_events',
    'admin_get_audit_logs','admin_get_client_errors','create_support_ticket',
    'my_support_tickets','my_support_ticket_events','report_client_error'
  ]) assert.ok(source.includes(rpc), 'missing RPC integration: ' + rpc);
  assert.match(source, /ownerDashboard/);
  assert.match(source, /renterDashboard/);
  assert.match(source, /createSignedUrl/);
  assert.match(source, /Support & Resolution Center/);
  assert.match(source, /Audit Trail/);
  assert.match(source, /System Health/);
});

test('support and audit migration applies RLS and server-side admin guards', () => {
  const sql = read('supabase/migrations/20261110050503_admin_support_audit_command_center.sql');
  assert.match(sql, /alter table public\.support_tickets enable row level security/i);
  assert.match(sql, /public\.is_ghardekho_admin\(\)/i);
  assert.match(sql, /support-attachments/);
  assert.match(sql, /create trigger gdr_audit_properties/i);
  assert.match(sql, /create or replace function public\.admin_update_support_ticket/i);
  assert.match(sql, /create or replace function public\.admin_get_command_center_stats/i);
  assert.match(sql, /revoke all on function public\.admin_list_support_tickets/i);
});

test('global search correction scopes renter results by both role and query', () => {
  const sql = read('supabase/migrations/20261110050602_admin_global_search_scope_fix.sql');
  assert.match(sql, /where \(lower\(coalesce\(u\.role,''\)\) in \('tenant','renter'\) or coalesce\(u\.roles/i);
  assert.match(sql, /array_to_string\(u\.roles,' '\)\) ilike/i);
});

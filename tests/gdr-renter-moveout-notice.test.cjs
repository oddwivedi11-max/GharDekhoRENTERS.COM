const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const renter = read("assets/gdr-rental-suite.js");
const owner = read("assets/gdr-owner-renter-page.js");
const migration = read("supabase/migrations/20261107140000_renter_moveout_notice.sql");
const patcher = read("scripts/patch-property-studio.py");

test("renter can submit, update and withdraw a move-out notice through the secure RPC", () => {
  assert.match(renter, /gdrRenterMoveoutForm/);
  assert.match(renter, /gdrRenterWithdrawMoveout/);
  assert.match(renter, /renter_submit_move_out_notice/);
  assert.match(renter, /p_occupancy_id:rental\.occupancy_id/);
  assert.match(renter, /p_expected_move_out_at:value/);
  assert.match(renter, /p_expected_move_out_at:null/);
  assert.match(renter, /Your tenancy remains active until the owner confirms the move-out/);
});

test("move-out notice does not release a tenancy and automatically syncs verified property status", () => {
  assert.match(migration, /create or replace function public\.renter_submit_move_out_notice/);
  assert.match(migration, /v_renter_id <> auth\.uid\(\)/);
  assert.match(migration, /released_at is null/);
  assert.match(migration, /create trigger property_occupancies_sync_moveout_status/);
  assert.match(migration, /set status = 'soon_available'/);
  assert.match(migration, /if new\.released_at is not null then\s+return new/i);
  assert.match(migration, /grant execute[\s\S]*to authenticated/i);
  assert.match(migration, /revoke all[\s\S]*from public, anon/i);
});

test("owner still has an explicit action to confirm and release a renter", () => {
  assert.match(owner, /release_property_occupancy/);
  assert.match(owner, /Release this renter and mark the property available again/);
});

test("soon_available is presented as Vacating Soon in the owner portal", () => {
  assert.match(patcher, /Vacating Soon/);
  assert.match(patcher, /soon_available/);
});

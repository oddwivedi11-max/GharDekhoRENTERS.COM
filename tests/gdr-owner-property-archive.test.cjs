const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const adapter = fs.readFileSync(path.join(root, "assets/gdr-owner-property-archive.js"), "utf8");
const migration = [
  "supabase/migrations/20261109094407_owner_property_soft_archive.sql",
  "supabase/migrations/20261109094438_filter_archived_properties_from_inventory.sql"
].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\\n");

test("owner removal uses an authenticated soft-archive RPC, never a hard delete", () => {
  assert.match(adapter, /client\.rpc\("owner_archive_property",\s*\{\s*p_property_id:\s*id\s*\}\)/);
  assert.doesNotMatch(adapter, /\.from\(["']properties["']\)\.delete\(/);
  assert.match(migration, /add column if not exists deleted_at timestamptz/i);
  assert.match(migration, /set deleted_at = coalesce\(p\.deleted_at, now\(\)\)/i);
});

test("archiving is owner-scoped and preserves linked rental and payment history", () => {
  assert.match(migration, /o\.user_id = auth\.uid\(\)/i);
  assert.match(migration, /grant execute on function public\.owner_archive_property\(uuid\) to authenticated/i);
  assert.match(adapter, /Rental and payment history will be preserved/);
  assert.match(migration, /p\.deleted_at is null/i);
});

test("the owner dashboard refreshes all inventory surfaces after archive", () => {
  assert.match(adapter, /window\.location\.reload\(\)/);
});

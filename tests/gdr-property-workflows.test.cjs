const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = html.indexOf(endMarker, start);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return html.slice(start, end);
}

test('saved-property writes go through the guarded toggle RPC and handle its response', () => {
  const source = sourceBetween('async function saveProperty(propertyId)', '/* =========================================================');
  assert.match(source, /rpc\(["']toggle_saved_property["']/);
  assert.match(source, /if\s*\(toggleError\)/);
  assert.match(source, /rawSaved/);
  assert.match(source, /isSavedNow/);
});

test('owner edits use the validated database RPC and surface re-verification state', () => {
  const source = sourceBetween('async function savePropertyEdit(e)', '\nasync function');
  assert.match(source, /rpc\(["']owner_update_property["']/);
  assert.match(source, /requires_reverification/);
  assert.doesNotMatch(source, /\.from\(["']properties["']\)\.update\(/);
});

test('owner contact is requested only after an approved visit check', () => {
  const marker = 'get_verified_owner_contact';
  const index = html.indexOf(marker);
  assert.notEqual(index, -1, 'Owner contact RPC is missing');
  const before = html.slice(Math.max(0, index - 900), index);
  assert.match(before, /from\(["']visit_requests["']\)/);
  assert.match(before, /eq\(["']status["'],\s*["']approved["']\)/);
  assert.match(before, /if\s*\(!approvedVisitError\s*&&\s*approvedVisit\)/);
});

test('public property discovery uses the approved-inventory RPCs, not an unrestricted table read', () => {
  assert.match(html, /rpc\(["']get_public_properties["']/);
  assert.match(html, /rpc\(["']get_nearby_properties["']/);
  assert.doesNotMatch(html, /from\(["']properties["']\)\s*\.select\(["']\*["']\)/);
});

test('admin route isolation remains present in the public app', () => {
  assert.match(html, /id=["']gdr-admin-route-hard-isolation["']/);
  assert.match(html, /window\.__gdAdminHardRoute=true/);
});

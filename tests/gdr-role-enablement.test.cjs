const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");

function functionSource(signature, nextSignature) {
  const start = html.indexOf(signature);
  assert.notEqual(start, -1, "Missing function: " + signature);
  const end = html.indexOf(nextSignature, start);
  assert.notEqual(end, -1, "Could not find end marker for: " + signature);
  return html.slice(start, end);
}

test("explicit renter-to-owner request preserves existing roles before reauthentication", () => {
  const source = functionSource(
    "async function switchAccountRole(role)",
    "\nfunction updateDashboardRoleSwitcher()"
  );
  assert.match(source, /explicitOwnerRequest/);
  assert.match(source, /await saveActiveAccountRole\(target\)/);
  assert.match(source, /await supabaseClient\.auth\.signOut\(\)/);
  assert.match(source, /window\.location\.reload\(\)/);
  assert.doesNotMatch(source, /activeRole\s*=\s*target/);
});

test("failed role persistence leaves the renter account unchanged", () => {
  const source = functionSource(
    "async function switchAccountRole(role)",
    "\nfunction updateDashboardRoleSwitcher()"
  );
  assert.match(source, /Owner access could not be enabled\. Your Renter account is unchanged/);
  assert.match(source, /if \(!saved\)/);
  assert.doesNotMatch(source, /currentProfile\.roles\s*=|currentProfile\.role\s*=/);
});

test("the renter List a Property action uses explicit owner role enablement", () => {
  assert.match(html, /renterBecomeOwnerBtn/);
  assert.match(html, /await switchAccountRole\("owner"\)/);
});

test("ordinary Owner login does not silently grant Owner access to a renter-only account", () => {
  assert.match(html, /Never create Owner access during an ordinary login/);
  assert.match(html, /This account is not registered as an Owner/);
});

test("role persistence preserves the existing role when enabling the second mode", () => {
  const source = functionSource(
    "async function saveActiveAccountRole(role)",
    "\nasync function switchAccountRole(role)"
  );
  assert.match(source, /const existingRoles = getAccountRoles\(currentProfile\)/);
  assert.match(source, /existingRoles\.map/);
  assert.match(source, /normalized/);
  assert.match(source, /update\(\{ roles: roleValues \}\)/);
  assert.doesNotMatch(source, /update\(\{[^}]*role:\s*normalized/);
});

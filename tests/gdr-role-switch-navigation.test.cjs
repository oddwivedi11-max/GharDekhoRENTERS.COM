const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");

test("dashboard does not expose an Owner/Renter switcher", () => {
  assert.doesNotMatch(html, /id="dashboardRoleSwitch"/);
  assert.doesNotMatch(html, /data-role-switch=/);
  assert.match(html, /function updateDashboardRoleSwitcher/);
});

test("the explicit List a Property role-enablement action reauthenticates instead of switching in-session", () => {
  assert.match(html, /renterBecomeOwnerBtn/);
  assert.match(html, /await switchAccountRole\("owner"\)/);
  const start = html.indexOf("async function switchAccountRole(role)");
  const end = html.indexOf("\nfunction updateDashboardRoleSwitcher()", start);
  const fn = html.slice(start, end);
  assert.match(fn, /await supabaseClient\.auth\.signOut\(\)/);
  assert.match(fn, /window\.location\.reload\(\)/);
  assert.doesNotMatch(fn, /setRoleSpecificUI\(target\)/);
});

test("owner Nearby navigation remains independent of portal selection", () => {
  assert.match(html, /renterExploreNearbyBtn/);
  assert.match(html, /loadRenterNearbyHomes/);
});

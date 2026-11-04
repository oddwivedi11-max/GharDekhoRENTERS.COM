const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("Owner/Renter switch activates the requested role only after persistence", () => {
  const start = html.indexOf("async function switchAccountRole(role)");
  assert.notEqual(start, -1, "role switch handler exists");
  const end = html.indexOf("\nfunction updateDashboardRoleSwitcher()", start);
  assert.notEqual(end, -1, "role switch handler has a stable boundary");
  const handler = html.slice(start, end);
  assert.match(handler, /await saveActiveAccountRole\(target\)/);
  assert.match(handler, /activeRole\s*=\s*target/);
  assert.match(handler, /setRoleSpecificUI\(target\)/);
  assert.match(handler, /await renderActiveDashboard\(\)/);
  assert.ok(handler.indexOf("await saveActiveAccountRole(target)") < handler.indexOf("activeRole = target"));
});

test("role switcher is only offered to accounts with Owner access", () => {
  const start = html.indexOf("function updateDashboardRoleSwitcher()");
  const end = html.indexOf("\nfunction setRoleSpecificUI(", start);
  const fn = html.slice(start, end);
  assert.match(fn, /accountHasRole\("owner"\)/);
  assert.match(fn, /const canSwitch = hasOwnerRole/);
});

test("Nearby remains available and is not replaced by portal switching", () => {
  assert.match(html, /renterExploreNearbyBtn/);
  assert.match(html, /loadRenterNearbyHomes/);
});

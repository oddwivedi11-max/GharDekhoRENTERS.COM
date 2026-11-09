const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const patch = fs.readFileSync(path.join(__dirname, "..", "scripts/patch-renter-dashboard-ui.py"), "utf8");

test("renter promotional welcome hero is hidden without changing the action dashboard", () => {
  assert.match(patch, /#renterDashboard \.renter-welcome-card,[\s\S]*?#renterDashboard\.gdrx-premium \.renter-welcome-card\{display:none!important\}/);
  assert.match(patch, /#renterDashboard #renterExploreMapBtn/);
  assert.match(patch, /#renterDashboard #renterLiveNearbyBtn/);
});

test("owner archive adapter is added to the production page once", () => {
  assert.match(patch, /gdr-owner-property-archive\.js/);
  assert.match(patch, /if archive_tag not in source/);
});

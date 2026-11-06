const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function functionSource(signature, nextSignature) {
  const start = html.indexOf(signature);
  assert.notEqual(start, -1, "Missing function: " + signature);
  const end = html.indexOf(nextSignature, start);
  assert.notEqual(end, -1, "Could not find end marker for: " + signature);
  return html.slice(start, end);
}

test("Owner/Renter switching controls are absent from the dashboard", () => {
  assert.doesNotMatch(html, /id="dashboardRoleSwitch"/);
  assert.doesNotMatch(html, /data-role-switch=/);
  assert.match(html, /Dashboard switching is disabled/);
});

test("explicit portal change persists role access, signs out and requires a new login", () => {
  const handler = functionSource("async function switchAccountRole(role)", "\nfunction updateDashboardRoleSwitcher()");
  assert.match(handler, /saveActiveAccountRole\(target\)/);
  assert.match(handler, /sessionStorage\.setItem\("gd_pending_login_role", target\)/);
  assert.match(handler, /await supabaseClient\.auth\.signOut\(\)/);
  assert.match(handler, /window\.location\.reload\(\)/);
  assert.doesNotMatch(handler, /activeRole\s*=\s*target/);
  assert.doesNotMatch(handler, /await renderActiveDashboard\(\)/);
});

test("each dashboard is still gated by its own stored role", () => {
  const source = functionSource("async function renderActiveDashboard()", "\n        /* =========================================================\n           ADMIN CONTROL CENTER");
  assert.match(source, /activeRole === "owner" && roles\.includes\("owner"\)/);
  assert.match(source, /activeRole === "renter" && roles\.includes\("renter"\)/);
  assert.match(source, /owner\.style\.display = "none"/);
  assert.match(source, /renter\.style\.display = "none"/);
});

test("existing Owner and Renter login choices are preserved", () => {
  assert.match(html, /gd-owner-choice/);
  assert.match(html, /gd-renter-choice/);
  assert.match(html, /openLoginAs\("owner"\)/);
  assert.match(html, /openLoginAs\("renter"\)/);
});

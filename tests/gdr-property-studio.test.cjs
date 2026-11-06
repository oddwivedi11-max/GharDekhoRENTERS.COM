const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const html = read("index.html");
const studio = read("assets/gdr-property-studio.js");
const studioMarkup = read("assets/gdr-property-studio.html");
const studioCss = read("assets/gdr-property-studio.css");
const migration = read("supabase/migrations/20261106195955_owner_property_studio.sql");
const patcher = read("scripts/patch-property-studio.py");

test("List Your Property is the first major owner dashboard action before statistics", () => {
  const hero = html.indexOf('id="gdrListPropertyHero"');
  const firstStat = html.indexOf('class="dashboard-stat-card owner-stat-card');
  assert.notEqual(hero, -1);
  assert.notEqual(firstStat, -1);
  assert.ok(hero < firstStat);
  assert.match(html, /id="gdrListPropertyStart"/);
  assert.match(html, /id="gdrListPropertySpeak"/);
});

test("dashboard role switch is removed while role choice remains at login", () => {
  assert.doesNotMatch(html, /id="dashboardRoleSwitch"/);
  assert.doesNotMatch(html, /data-role-switch=/);
  assert.doesNotMatch(html, /ghardekho-final-role-switch-v11/);
  assert.match(html, /gd-owner-choice/);
  assert.match(html, /gd-renter-choice/);
  assert.match(html, /openLoginAs\("owner"\)/);
  assert.match(html, /openLoginAs\("renter"\)/);
});

test("cross-role access requires sign-out and a fresh role-guarded login", () => {
  const start = html.indexOf("async function switchAccountRole(role)");
  const end = html.indexOf("\nfunction updateDashboardRoleSwitcher()", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = html.slice(start, end);
  assert.match(fn, /await saveActiveAccountRole\(target\)/);
  assert.match(fn, /await supabaseClient\.auth\.signOut\(\)/);
  assert.match(fn, /window\.location\.reload\(\)/);
  assert.doesNotMatch(fn, /activeRole\s*=\s*target/);
  assert.doesNotMatch(fn, /renderActiveDashboard\(\)/);
  assert.match(html, /activeRole === "owner" && roles\.includes\("owner"\)/);
  assert.match(html, /activeRole === "renter" && roles\.includes\("renter"\)/);
});

test("Property Studio is a separate guided page with the required simple listing fields", () => {
  assert.match(html, /gdrPropertyStudioMount/);
  for (const token of [
    "gdrStudioStepTitle", "gdrStudioRent",
    "gdrStudioDeposit", "gdrStudioLocation", "gdrStudioUseGps",
    "gdrStudioOpenMap", "gdrStudioPhotoFiles", "gdrStudioCameraFiles",
    "gdrStudioVoiceStart", "gdrStudioPublish"
  ]) assert.ok(studioMarkup.includes(token), token);
  for (const type of ["apartment", "independent_house", "villa", "pg", "hostel", "other"]) {
    assert.ok(studioMarkup.includes('data-gdr-property-type="' + type + '"'), type);
  }
  for (const configuration of ["1 RK", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK"]) {
    assert.ok(studioMarkup.includes('data-gdr-configuration="' + configuration + '"'), configuration);
  }
});

test("Property Studio saves drafts, uploads owner-scoped photos and uses the secure publish RPC", () => {
  assert.match(studio, /localStorage\.setItem/);
  assert.match(studio, /storage\.from\("property-images"\)\.upload/);
  assert.match(studio, /owner_publish_property_studio/);
  assert.match(studio, /p_submission_id/);
  assert.match(studio, /p_photo_urls/);
  assert.match(studio, /SpeechRecognition/);
  assert.match(studio, /GDRMapExperience\.openOwnerMapPicker/);
  assert.match(studio, /PlacesService/);
  assert.match(studio, /GDR_GOOGLE_MAPS_API_KEY/);
  assert.match(studio, /You must review and correct every field before continuing/);
});

test("missing Google Places credentials fail closed instead of inventing nearby places", () => {
  assert.match(studio, /Google Places is not configured yet/);
  assert.match(studio, /if\(!googleKey\(\)\)return/);
  assert.match(studio, /nearbyPlaces=Array\.from/);
  assert.match(studioMarkup, /gdrStudioNearbyStatus/);
});

test("production migration adds only listing metadata and an authenticated owner-scoped publish RPC", () => {
  for (const column of ["property_type", "configuration", "security_deposit", "pincode", "photo_urls", "nearby_places", "studio_submission_id"]) {
    assert.match(migration, new RegExp("add column if not exists " + column));
  }
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /public\.owner_add_property/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/i);
  assert.match(migration, /from public, anon/i);
  assert.doesNotMatch(migration, /drop table|truncate|delete from public\.properties/i);
});

test("local property placeholder and responsive Studio styles are present", () => {
  assert.match(html, /gdr-property-placeholder\.svg/);
  assert.match(html, /property\.property_type === "apartment"/);
  assert.match(studioCss, /@media\(max-width:760px\)/);
  assert.match(studioCss, /gdr-studio-photo-remove/);
  assert.match(studioCss, /gdr-property-nearby-public/);
  assert.match(patcher, /gdrListPropertyHero/);
});

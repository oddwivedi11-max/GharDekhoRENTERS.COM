const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const studio = fs.readFileSync(path.join(root, "assets/gdr-property-studio.js"), "utf8");
const map = fs.readFileSync(path.join(root, "assets/gdr-map-experience.js"), "utf8");

test("Property Studio verifies six-digit Indian PIN codes through India Post", () => {
  assert.match(studio, /async function resolveStudioPincode\(/);
  assert.match(studio, /api\.postalpincode\.in\/pincode\//);
  assert.match(studio, /Status === "Success"/);
});

test("verified PIN locality is geocoded and saved with exact map coordinates", () => {
  assert.match(studio, /photon\.komoot\.io\/api/);
  assert.match(studio, /setLocation\(label,Number\(coords\[1\]\),Number\(coords\[0\]\),pin\)/);
  assert.match(studio, /dataset\.gdSelectedLat=String\(coords\[1\]\)/);
  assert.match(studio, /dataset\.gdSelectedLng=String\(coords\[0\]\)/);
});

test("owner map recenters to the resolved PIN while requiring exact entrance confirmation", () => {
  assert.match(map, /function centerOwnerMapPicker\(lat,lng,label\)/);
  assert.match(map, /setOwnerPin\(point,String\(label\|\|"PIN code location"\),false\)/);
  assert.match(map, /centerOwnerMapPicker/);
});

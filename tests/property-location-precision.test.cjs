const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const studio = fs.readFileSync(path.join(root, "assets/gdr-property-studio.js"), "utf8");
const map = fs.readFileSync(path.join(root, "assets/gdr-map-experience.js"), "utf8");

test("Property Studio PIN resolution verifies India Post and sequences requests", () => {
  assert.match(studio, /api\.postalpincode\.in\/pincode\//);
  assert.match(studio, /pinResolveSequence/);
  assert.match(studio, /const isCurrent=\(\)=>run===pinResolveSequence/);
});

test("PIN locality remains approximate until exact property confirmation", () => {
  assert.match(studio, /state\.resolvedPincode=pin;setLocation\(label,lat,lng,pin,false\)/);
  assert.match(studio, /state\.locationConfirmed=confirmed===true&&valid/);
  assert.match(studio, /if\(!state\.locationConfirmed\)/);
});

test("address suggestions cannot mark an approximate Photon result as exact", () => {
  assert.match(studio, /setLocation\(label,lat,lng,p\.postcode\|\|"",false\)/);
  assert.match(studio, /centerOwnerMapPicker\(lat,lng,label\)/);
  assert.match(studio, /addressSearchSequence/);
  assert.match(studio, /requestId===addressSearchSequence/);
});

test("publishing requires the entered PIN to match the resolved PIN", () => {
  assert.match(studio, /state\.pincode&&state\.resolvedPincode!==state\.pincode/);
  assert.match(studio, /distance>25&& !window\.confirm|distance>25&&!window\.confirm/);
});

test("owner map search ignores stale PIN and Photon responses", () => {
  assert.match(map, /searchId!==state\.ownerLocationSearchId/);
  assert.match(map, /input\.value\.trim\(\)!==q/);
});

test("exact map confirmation reverse-geocodes and warns on PIN mismatch", () => {
  assert.match(map, /async function confirmOwnerMapLocation/);
  assert.match(map, /photon\.komoot\.io\/reverse/);
  assert.match(map, /enteredPin&&reversePin&&enteredPin!==reversePin/);
  assert.match(map, /window\.__gdrSetPropertyLocation\(address,selected\.lat,selected\.lng\)/);
});

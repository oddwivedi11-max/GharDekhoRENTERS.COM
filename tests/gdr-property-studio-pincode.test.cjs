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
  assert.match(studio, /Status\s*===\s*"Success"/);
});

test("verified PIN locality is geocoded as an approximate centre, not an exact house pin", () => {
  assert.match(studio, /photon\.komoot\.io\/api/);
  assert.match(studio, /state\.pinCenter=\{lat,lng\};state\.resolvedPincode=pin;setLocation\(label,lat,lng,pin,false\)/);
  assert.match(studio, /dataset\.gdSelectedLat=String\(state\.lat\)/);
  assert.match(studio, /dataset\.gdSelectedLng=String\(state\.lng\)/);
});

test("owner map recenters to the resolved PIN while requiring exact entrance confirmation", () => {
  assert.match(map, /function centerOwnerMapPicker\(lat,lng,label\)/);
  assert.match(map, /setOwnerPin\(point,String\(label\|\|"PIN code location"\),false\)/);
  assert.match(map, /centerOwnerMapPicker/);
});

test("changing a PIN clears the previous location and ignores stale lookup responses",()=>{
  assert.match(studio,/function invalidateStudioLocationForPinChange\(/);
  assert.match(studio,/state\.address="";state\.nearbyPlaces=\[\];clearStudioCoordinateSelection\(\)/);
  assert.match(studio,/function clearStudioCoordinateSelection\(/);
  assert.match(studio,/pinResolveSequence\+\+/);
  assert.match(studio,/const isCurrent=\(\)=>run===pinResolveSequence/);
  assert.match(studio,/if\(nextPin\.length===6\)pinResolveTimer=setTimeout\(\(\)=>resolveStudioPincode\(nextPin\),450\)/);
  assert.match(studio,/districtMatch=!expectedDistrict\|\|districtText\.includes\(expectedDistrict\)/);
  assert.match(studio,/stateMatch=!expectedState\|\|!!stateText/);
});

test("approximate PIN and address coordinates cannot publish before exact entrance confirmation",()=>{
  assert.match(studio,/function validIndiaPoint\(/);
  assert.match(studio,/state\.locationConfirmed=confirmed===true&&valid/);
  assert.match(studio,/setLocation\(address,Number\(lat\),Number\(lng\),state\.pincode,true\)/);
  assert.match(studio,/if\(inStudio&&!validIndiaPoint\(Number\(lat\),Number\(lng\)\)\)/);
  assert.match(studio,/if\(!state\.locationConfirmed\)/);
  assert.match(studio,/approximate area/);
});

test("owner map clears old marker and no longer defaults the owner picker to Bhopal",()=>{
  assert.match(map,/function clearOwnerMapSelectionForPinChange\(/);
  assert.match(map,/clearOwnerMapSelectionForPinChange,searchRenterArea/);
  assert.doesNotMatch(map,/function initOwnerMap\(\)[\s\S]{0,350}setView\(\[23\.2599,77\.4126\],12\)/);
});

test("Owner and renter PIN resolvers prefer the principal postal office and rank map results by postal locality",()=>{
  assert.match(studio,/offices\.find\(item=>\/head office\/i/);
  assert.match(studio,/offices\.find\(item=>\/sub office\/i/);
  assert.match(map,/offices\.find\(x=>\/head office\/i/);
  assert.match(map,/offices\.find\(x=>\/sub office\/i/);
  assert.match(map,/const postalMatches=rows=>/);
  assert.ok(map.includes('const rankingQuery=/^\\d{6}$/.test(q)?preferredLabel:q;'));
  assert.match(map,/renderMarkers\(\[\],INDIA_CENTER\)/);
  assert.match(map,/state\.renterMap\.setView\(INDIA_CENTER,5/);
});

test("Owner and renter PIN resolvers prefer the principal postal office and rank map results by postal locality",()=>{
  assert.match(studio,/offices\.find\(item=>\/head office\/i/);
  assert.match(studio,/offices\.find\(item=>\/sub office\/i/);
  assert.match(map,/offices\.find\(x=>\/head office\/i/);
  assert.match(map,/offices\.find\(x=>\/sub office\/i/);
  assert.match(map,/const postalMatches=rows=>/);
  assert.ok(map.includes('const rankingQuery=/^\\d{6}$/.test(q)?preferredLabel:q;'));
  assert.match(map,/renderMarkers\(\[\],INDIA_CENTER\)/);
  assert.match(map,/state\.renterMap\.setView\(INDIA_CENTER,5/);
});

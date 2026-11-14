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
  assert.match(map, /setOwnerPin\(point,point\.label,false\)/);
  assert.match(map, /centerOwnerMapPicker/);
});

test("changing a PIN clears the previous location and ignores stale lookup responses",()=>{
  assert.match(studio,/function invalidateStudioLocationForPinChange\(/);
  assert.match(studio,/state\.address="";state\.nearbyPlaces=\[\];clearStudioCoordinateSelection\(\)/);
  assert.match(studio,/function clearStudioCoordinateSelection\(/);
  assert.match(studio,/pinResolveSequence\+\+/);
  assert.match(studio,/const isCurrent=\(\)=>run===pinResolveSequence/);
  assert.match(studio,/if\(nextPin\.length===6\)pinResolveTimer=setTimeout\(\(\)=>resolveStudioPincode\(nextPin\),450\)/);
  assert.match(studio,/return item\.officeMatch\|\|item\.postcodeMatch/);
  assert.match(studio,/const stateMatch=!expectedState\\|\\|!rowState\\|\\|rowState===expectedState/);
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
  assert.match(studio,/function preferredPostOffice\(offices\)/);
  assert.match(studio,/rows\.find\(item=>\/sub office\/i/);
  assert.match(map,/function preferredPinOffice\(offices\)/);
  assert.match(map,/rows\.find\(item=>\/sub office\/i/);
  assert.match(map,/const postalMatches=\(rows,allowDistrictFallback\)=>/);
  assert.ok(map.includes('const rankingQuery=/^\\d{6}$/.test(q)?preferredLabel:q;'));
  assert.match(map,/renderMarkers\(\[\],INDIA_CENTER\)/);
  assert.match(map,/state\.renterMap\.setView\(INDIA_CENTER,5/);
});



test("owner PIN map centre is queued until Leaflet initializes and then applied",()=>{
  assert.ok(map.includes("pendingOwnerMapCenter:null"));
  assert.ok(map.includes("state.pendingOwnerMapCenter=point"));
  assert.ok(map.includes("if(state.pendingOwnerMapCenter)"));
  assert.ok(map.includes("setOwnerPin(pending,pending.label,false)"));
});
test("six-digit owner listing PIN automatically opens the map at the verified locality",()=>{
  assert.ok(studio.includes("openMap();"));
  assert.ok(studio.includes("PIN verified. "));
  assert.ok(studio.includes("openMap();"));
});
test("renter and owner map search fields automatically resolve six-digit PINs",()=>{
  assert.ok(map.includes('if(/^\\d{6}$/.test(q)&&kind==="renter")'));
  assert.ok(map.includes('if(/^\\d{6}$/.test(q)&&kind==="owner")'));
  assert.ok(map.includes("const point=await resolveMapQuery(q)"));
});


test("property map stays on one page, uses raster tiles and auto-shows nearby places",()=>{
  assert.match(map,/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(map,/function addAutomaticNearbyPlaces\(map\)/);
  assert.match(map,/category:"all"/);
  assert.match(map,/map\.on\("moveend",schedule\)/);
  assert.doesNotMatch(map,/function addMapExploreControls/);
  assert.doesNotMatch(map,/360° street imagery|openMapillaryAt|Mapillary|maplibregl|openfreemap/);
  assert.doesNotMatch(map,/window\.open\(/);
  assert.ok(studio.includes("centerOwnerMapPicker(lat,lng,label)"));
  assert.ok(studio.includes("openMap();"));
});
test("owner PIN entry ignores stale requests and centers the map at the verified locality",()=>{
  assert.match(map,/ownerLocationSearchId:0/);
  assert.match(map,/if\(kind==="owner"\)state\.ownerLocationSearchId\+\+/);
  assert.match(map,/if\(searchId!==state\.ownerLocationSearchId\|\|!state\.ownerMap\)return/);
  assert.match(map,/state\.ownerMap\.setView\(\[point\.lat,point\.lng\],13,\{animate:false\}\)/);
});


test("PIN 486886 prefers Waidhan Sub Office and does not reject a legitimate district-label difference",()=>{
  assert.match(studio,/function preferredPostOffice\(offices\)[\s\S]*?rows\.find\(item=>\/sub office\/i[\s\S]*?rows\.find\(item=>\/head office\/i/);
  assert.match(map,/function preferredPinOffice\(offices\)[\s\S]*?rows\.find\(item=>\/sub office\/i[\s\S]*?rows\.find\(item=>\/head office\/i/);
  assert.match(studio,/const exactQueries=Array\.from\(new Set\(/);
  assert.match(studio,/\[officeName,district,region,"India"\]/);
  assert.match(studio,/return item\.officeMatch\|\|item\.postcodeMatch/);
  assert.match(map,/return item\.officeMatch\|\|item\.postcodeMatch/);
});

test("postal coordinate fallback is available when Photon has no matching post-office feature",()=>{
  assert.ok(studio.includes("api.pincodeapi.in/api/v1/pincode/"));
  assert.ok(studio.includes("function lookupPostalApiCoordinates("));
  assert.ok(studio.includes("row.office_name"));
  assert.ok(studio.includes("row.latitude"));
  assert.ok(studio.includes("row.longitude"));
  assert.ok(studio.includes("localStorage.setItem(cacheKey,JSON.stringify(result))"));
  assert.ok(map.includes("api.pincodeapi.in/api/v1/pincode/"));
  assert.ok(map.includes("function lookupPostalApiCoordinates("));
});

test("automatic nearby map places load around the PIN and retry the backup data source",()=>{
  assert.match(map,/function poiSearchBounds\(map,radiusKm=3\)/);
  assert.match(map,/const bounds=poiSearchBounds\(map,3\)/);
  assert.match(map,/const endpointController=new AbortController\(\)/);
  assert.match(map,/payload&&payload\.remark/);
  assert.match(map,/emptyResponses===OVERPASS_ENDPOINTS\.length/);
  assert.match(map,/gdr-poi-status/);
  assert.match(map,/state\.ownerMap\.setView\(\[point\.lat,point\.lng\],13,\{animate:false\}\)/);
});

test("nearby map uses the current free endpoint and cannot remain loading forever",()=>{
  assert.ok(map.includes("https://overpass.private.coffee/api/interpreter"));
  assert.ok(map.includes("https://maps.mail.ru/osm/tools/overpass/api/interpreter"));
  assert.match(map,/\[out:json\]\[timeout:9\]/);
  assert.match(map,/const overallTimer=setTimeout\(\(\)=>request\.abort\(\),35000\)/);
  assert.match(map,/gdr:poi-nearby:v2:/);
  assert.match(map,/tags\.place/);
});

test("owner PIN map search label follows the latest verified PIN and clears stale labels on PIN changes",()=>{
  const centerStart=map.indexOf("function centerOwnerMapPicker(");
  const clearStart=map.indexOf("function clearOwnerMapSelectionForPinChange(");
  const clearEnd=map.indexOf("function closeOwnerMapPicker(",clearStart);
  assert.ok(centerStart>=0&&clearStart>centerStart&&clearEnd>clearStart);
  const centerBlock=map.slice(centerStart,clearStart);
  const clearBlock=map.slice(clearStart,clearEnd);
  assert.ok(centerBlock.includes('const searchInput=$("gdrOwnerMapSearch");'));
  assert.ok(centerBlock.includes("if(searchInput)searchInput.value=point.label;"));
  assert.ok(clearBlock.includes('const searchInput=$("gdrOwnerMapSearch");'));
  assert.ok(clearBlock.includes('if(searchInput)searchInput.value="";'));
});

test("postal coordinate fallback accepts rows without a repeated PIN and ranks all post offices from a PIN-scoped lookup",()=>{
  assert.match(studio,/const rowPin=String\(row&&\(row\.pincode\|\|row\.pin_code\|\|row\.postal_code\)\|\|pin\)/);
  assert.match(map,/const rowPin=String\(row&&\(row\.pincode\|\|row\.pin_code\|\|row\.postal_code\)\|\|pin\)/);
  assert.match(studio,/const officeNames=\(Array\.isArray\(officeRecords\)\?officeRecords:\[officeRecords\]\)/);
  assert.match(map,/const officeNames=\(Array\.isArray\(officeRecords\)\?officeRecords:\[officeRecords\]\)/);
  assert.match(studio,/const nameScore=officeKeys\.reduce/);
  assert.match(map,/const nameScore=officeKeys\.reduce/);
});

test("all valid India Post PINs try locality variants, postal coordinates and verified district fallback",()=>{
  assert.match(studio,/const exactQueries=Array\.from\(new Set\(/);
  assert.match(studio,/lookupPostalApiCoordinates\(pin,offices,region,district,signal\)/);
  assert.match(studio,/matchesFromPhoton\(payload&&payload\.features,true\)/);
  assert.match(map,/const queries=Array\.from\(new Set\(/);
  assert.match(map,/lookupPostalApiCoordinates\(pin,offices,expectedState,expectedDistrict\)/);
  assert.match(map,/postalMatches\(districtFeatures,true\)/);
  assert.match(studio,/state\.resolvedPincode=pin;setLocation\(label,lat,lng,pin,false\)/);
  assert.ok(map.includes(String.raw`const label=/^\d{6}$/.test(q)?preferredLabel:`));
});

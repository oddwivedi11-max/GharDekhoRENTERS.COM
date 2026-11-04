const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const map=fs.readFileSync(path.join(root,"assets/gdr-map-experience.js"),"utf8");
const style=fs.readFileSync(path.join(root,"assets/gdr-map-experience.css"),"utf8");
const suite=fs.readFileSync(path.join(root,"assets/gdr-rental-suite.js"),"utf8");
test("owner Nearby opens a separate map and never calls renter search or browser GPS",()=>{
 assert.match(map,/async function openOwnerNearbyMap\(\)/);
 assert.match(map,/function closeOwnerNearbyMap\(\)/);
 assert.match(map,/gdrOwnerNearbyExperience/);
 assert.match(map,/ownerNearby\.radius=5/);
 assert.match(map,/client\.from\("owners"\)/);
 assert.match(map,/client\.from\("properties"\)\.select\(OWNER_NEARBY_FIELDS\)/);
 assert.match(map,/p\.gdrDistanceKm<=ownerNearby\.radius/);
 assert.match(map,/client\.rpc\("get_public_properties"\)/);
 assert.match(map,/makeLayer\(ownerNearby\.map\)/);
 assert.doesNotMatch(map.slice(map.indexOf("async function openOwnerNearbyMap()"),map.indexOf("function bind()")),/locateRenter\(|navigator\.geolocation/);
});
test("owner map includes 5 KM default, radius choices, preview details and recenter controls",()=>{
 for(const text of ["1 KM","2 KM","3 KM","5 KM","10 KM","gdrOnRecenter","gdrOnRefresh","View Details","gdrOnCount","available_beds"])assert.ok(map.includes(text),text);
 assert.match(map,/gdrDistanceKm/);
});
test("owner dashboard gets its own direct Nearby Properties action",()=>{
 assert.match(suite,/function addOwnerNearbyAction\(\)/);
 assert.match(suite,/gdrOwnerNearbyOpen/);
 assert.match(suite,/openOwnerNearbyMap/);
});
test("map uses a light premium palette and 3D-inspired house markers",()=>{
 assert.match(style,/\.gdr-on-house-marker/);
 assert.match(style,/background:#f4f8f6/);
 assert.match(style,/body\.gdr-owner-nearby-open/);
});

test("owner map renders its own MY HOME pin and My Property recenters to its preview",()=>{
 assert.match(map,/ownerNearbyMyHomeIcon/);
 assert.match(map,/MY HOME/);
 assert.match(map,/ownerNearby\.ownerMarker=.*addTo\(ownerNearby\.map\)/);
 assert.match(map,/gdrIsOwnerProperty:true/);
 assert.match(map,/ownerNearbyPreview\(ownPoint\)/);
});
test("owner map branding is separated from the title and avoids old logo overlap",()=>{
 assert.match(map,/gdr-on-brand/);
 assert.match(style,/\.gdr-on-brand/);
 assert.match(style,/gdr-owner-nearby-open \.gdr-header-brand/);
});

test("owner map initializes Leaflet at the saved property coordinates before loading tiles",()=>{
 assert.match(map,/\.setView\(initialCenter,14\)/);
 assert.ok(map.indexOf("setView(initialCenter,14)")<map.indexOf("ownerNearby.tileLayer.addTo(ownerNearby.map)"));
 assert.match(map,/tileLayer\.on\("tileerror"/);
});
test("owner map hides and restores the dashboard background while open",()=>{
 assert.match(map,/hideOwnerNearbyBackground\(\)/);
 assert.match(map,/restoreOwnerNearbyBackground\(\)/);
 assert.match(map,/setProperty\("display","none","important"\)/);
});

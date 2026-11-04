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
 assert.match(map,/gdrOnSocietyScene/);
 assert.doesNotMatch(map.slice(map.indexOf("async function openOwnerNearbyMap()"),map.indexOf("function bind()")),/locateRenter\(|navigator\.geolocation/);
});
test("owner dashboard gets its own direct Nearby Properties action",()=>{
 assert.match(suite,/function addOwnerNearbyAction\(\)/);
 assert.match(suite,/gdrOwnerNearbyOpen/);
 assert.match(suite,/openOwnerNearbyMap/);
});

test("owner map branding is separated from the title and avoids old logo overlap",()=>{
 assert.match(map,/gdr-on-brand/);
 assert.match(style,/\.gdr-on-brand/);
 assert.match(style,/gdr-owner-nearby-open \.gdr-header-brand/);
});

test("owner map hides and restores the dashboard background while open",()=>{
 assert.match(map,/hideOwnerNearbyBackground\(\)/);
 assert.match(map,/restoreOwnerNearbyBackground\(\)/);
 assert.match(map,/setProperty\("display","none","important"\)/);
});

test("owner Nearby is a 3D-inspired society view and does not load a tile map",()=>{
 assert.match(map,/gdrOnSocietyScene/);
 assert.match(map,/ownerNearbyHomeCard/);
 assert.match(map,/gdr-on-building-roof/);
 assert.doesNotMatch(map.slice(map.indexOf("async function openOwnerNearbyMap()"),map.indexOf("function bind()")),/ensureLeaflet\(|L\.map\(|tileLayer\(/);
});
test("owner society view shows all public nearby homes, including occupied/full listings, by exact radius",()=>{
 assert.match(map,/client\.rpc\("get_public_properties"\)/);
 assert.match(map,/p\.gdrDistanceKm<=ownerNearby\.radius/);
 assert.doesNotMatch(map,/inventory\.filter\(p=>String\(p\.id\)!==selectedId&&validPoint\(p\.latitude,p\.longitude\)&&ownerNearbyAvailable\(p\)\)/);
});
test("owner society view keeps own property card and functional radius, refresh, details controls",()=>{
 for(const t of ["gdrOnRecenter","gdrOnRefresh","gdrOnRadius","View Details","gdrIsOwnerProperty","gdrOnCount"])assert.ok(map.includes(t),t);
 assert.match(map,/gdr-on-home-card-own/);
});
test("owner society branding and mobile layout avoid overlap",()=>{
 assert.match(map,/gdr-on-brand/);
 assert.match(style,/\.gdr-on-society-scene/);
 assert.match(style,/\.gdr-on-home-card/);
 assert.match(style,/@media\(max-width:760px\)/);
 assert.match(map,/overlay\.scrollTop=0/);
});

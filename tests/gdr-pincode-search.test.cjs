const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("PIN search falls back to exact PIN inventory when optional preferences hide all matches", () => {
  assert.match(html, /if \(!finalResults\.length && pinTerms\.length\)/);
  assert.match(html, /const pinInventoryMatches = pinTerms\.length \? allProperties\.filter/);
  assert.match(html, /const pinOnlyMatches = pinInventoryMatches\.filter/);
  assert.match(html, /return stayTypeMatch && vacancyMatch/);
  assert.match(html, /Your selected budget, BHK or furnishing filters were hiding them/);
});

test("PIN inventory is checked before the optional India Post service", () => {
  assert.match(html, /if \(pinTerms\.length && !pinInventoryMatches\.length\)/);
  assert.match(html, /India Post PIN lookup unavailable; continuing with live inventory matches/);
});

test("PIN fallback preserves explicit stay type and Vacant-only filters", () => {
  assert.match(html, /const stayTypeMatch = !listingType \|\| \(property\.listing_type \|\| "home"\) === listingType/);
  assert.match(html, /propertyStatus === "vacant"/);
  assert.match(html, /normalizedStatus === "pending" \|\| normalizedStatus === "verified"/);
});

test("PIN 486889's two real listings are both eligible under Home + All properties", () => {
  const listings = [
    { title: "DON789", location: "Rajmata Chun Kumari Stadium, Waidhan, Singrauli, Madhya Pradesh, India, PIN 486889", rent: 100000, bhk: 7, furnishing: "Furnished", listing_type: "home", status: "pending" },
    { title: "DWIVEDI HOUSE", location: "Rajmata Chun Kumari Stadium, Waidhan, Singrauli, Madhya Pradesh, India, PIN 486889", rent: 2588, bhk: 2, furnishing: "Furnished", listing_type: "home", status: "occupied" }
  ];
  const pin = "486889";
  const rows = listings.filter(p => p.location.replace(/[^a-z0-9]+/gi, " ").toLowerCase().includes(pin)
    && p.listing_type === "home");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(p => p.title), ["DON789", "DWIVEDI HOUSE"]);
});

test("renter map clusters show a 3D house instead of numeric count bubbles",()=>{
 const map=fs.readFileSync(path.join(__dirname,"..","assets","gdr-map-experience.js"),"utf8");
 const css=fs.readFileSync(path.join(__dirname,"..","assets","gdr-map-experience.css"),"utf8");
 assert.match(map,/iconCreateFunction:function\(\)/);
 assert.match(map,/gdr-home-3d-cluster/);
 assert.match(map,/A clustered group of nearby listings is represented by the same 3D GharDekho house motif/);
 assert.match(css,/\.gdr-home-3d-cluster-wrap/);
 assert.match(css,/\.gdr-home-3d-cluster-back/);
});

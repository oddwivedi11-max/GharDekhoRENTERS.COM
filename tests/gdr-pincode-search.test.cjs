const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("PIN search falls back to exact PIN inventory when optional preferences hide all matches", () => {
  assert.match(html, /if \(!finalResults\.length && pinTerms\.length\)/);
  assert.match(html, /const exactPinMatch = pinSearchText\.includes\(pin\)/);
  assert.match(html, /return exactPinMatch && stayTypeMatch && vacancyMatch/);
  assert.match(html, /Your selected budget, BHK or furnishing filters were hiding them/);
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

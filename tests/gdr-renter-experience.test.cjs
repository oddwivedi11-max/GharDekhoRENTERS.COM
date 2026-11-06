const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const js = fs.readFileSync('assets/gdr-renter-experience.js', 'utf8');
const map = fs.readFileSync('assets/gdr-map-experience.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const start = js.indexOf('function parseRequest(raw){');
const end = js.indexOf('\nfunction setValue', start);
assert.ok(start >= 0 && end > start, 'local parser is present');
const parseRequest = vm.runInNewContext(js.slice(start, end) + '; parseRequest');

test('Hinglish assistant extracts locality, budget, BHK and furnishing', () => {
  const p = parseRequest('Mujhe Patel Nagar Bhopal mein 2 BHK furnished flat chahiye. Budget 8000 rupees hai aur college paas hona chahiye.');
  assert.equal(p.location, 'Patel Nagar Bhopal'); assert.equal(p.maxBudget, '8000'); assert.equal(p.bhk, '2');
  assert.equal(p.furnishing, 'Furnished'); assert.equal(p.stayType, 'home'); assert.equal(p.nearby, 'college');
});
test('English assistant extracts location, budget, BHK and furnishing', () => {
  const p = parseRequest('Show me a 1 BHK apartment near Vijay Nagar Indore under 12000, semi furnished');
  assert.equal(p.location, 'Vijay Nagar Indore'); assert.equal(p.maxBudget, '12000'); assert.equal(p.bhk, '1'); assert.equal(p.furnishing, 'Semi-Furnished');
});
test('PG search is parsed without inventing property records', () => {
  const p = parseRequest('PG in Patel Nagar Bhopal budget 7000');
  assert.equal(p.location, 'Patel Nagar Bhopal'); assert.equal(p.stayType, 'pg'); assert.equal(p.maxBudget, '7000');
});
test('map exposes real inventory preference ranking and comparison actions', () => {
  assert.match(map, /function applyRenterFilters\(prefs\)/); assert.match(map, /gdrMatchScore/); assert.match(map, /toggleCompare\(p\)/);
});
test('index loads renter experience assets', () => {
  assert.match(index, /gdr-renter-experience\.js\?v=20261107-(?:renter1|compare2|voice1)/); assert.match(index, /gdr-renter-experience\.css\?v=20261107-(?:renter1|compare2|voice1)/);
});

test('map API exports a real radius setter so initialization cannot fail', () => {
  assert.match(map, /function setRenterRadius\(value,skipSearch\)/);
  assert.match(map, /setRenterRadius,getRenterVisibleProperties/);
});
test('map voice uses its own microphone and status elements', () => {
  assert.match(js, /const micId=mapMode\?"gdrxMapMic":"gdrxMic"/);
  assert.match(js, /const statusId=mapMode\?"gdrxMapStatus":"gdrxStatus"/);
  assert.match(js, /function runMapSearch\(\)/);
  assert.match(js, /const searchResult=await api\.searchTypedMapLocation\(\)/);
});
test('map voice supports an explicit spoken search radius', () => {
  const p = parseRequest('2 BHK under 8000 near Patel Nagar within 3 km');
  assert.equal(p.radiusKm, 3);
});

test('production headers allow same-origin microphone permission for browser speech search', () => {
  const headers = fs.readFileSync('_headers', 'utf8');
  assert.match(headers, /microphone=\(self\)/);
  assert.doesNotMatch(headers, /microphone=\(\)/);
});


test('compare selection seeds the clicked home plus up to two nearest visible real listings', () => {
  const start = js.indexOf('function buildCompareSelection(primary,available){');
  const end = js.indexOf('\nfunction toggleCompare(p){', start);
  assert.ok(start >= 0 && end > start, 'comparison selection helper is present');
  const helper = vm.runInNewContext(js.slice(start, end) + '; buildCompareSelection');
  const selected = helper({id:'b'}, [
    {id:'c',gdrDistanceKm:2},{id:'a',gdrDistanceKm:1},{id:'b',gdrDistanceKm:0},{id:'d',gdrDistanceKm:3}
  ]);
  assert.deepEqual(Array.from(selected,p=>p.id),['b','a','c']);
});
test('compare selection deduplicates property ids and caps at three', () => {
  const start = js.indexOf('function buildCompareSelection(primary,available){');
  const end = js.indexOf('\nfunction toggleCompare(p){', start);
  const helper = vm.runInNewContext(js.slice(start, end) + '; buildCompareSelection');
  const selected = helper({id:1},[{id:1},{id:2},{id:2},{id:3},{id:4}]);
  assert.deepEqual(Array.from(selected,p=>p.id),[1,2,3]);
});
test('comparison persists for the current browser session', () => {
  assert.match(js,/sessionStorage\.setItem\("gdrxCompareHomes"/);
  assert.match(js,/sessionStorage\.getItem\("gdrxCompareHomes"/);
  assert.match(js,/GDR_COMPARE_AUTOFILL_V2/);
});

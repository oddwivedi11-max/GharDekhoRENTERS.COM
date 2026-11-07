const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const js = fs.readFileSync('assets/gdr-renter-experience.js', 'utf8');
const map = fs.readFileSync('assets/gdr-map-experience.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const mapMigration = fs.readFileSync('supabase/migrations/20261107120000_available_map_search.sql', 'utf8');
const rentalSuite = fs.readFileSync('assets/gdr-rental-suite-v2.js', 'utf8');
const css = fs.readFileSync('assets/gdr-renter-experience.css', 'utf8');
const normalizeStart = js.indexOf('function normalizeSearchText(value){');
const start = js.indexOf('function parseRequest(raw){');
const end = js.indexOf('\nfunction setValue', start);
assert.ok(normalizeStart >= 0 && start > normalizeStart && end > start, 'local parser and normalizer are present');
const parseRequest = vm.runInNewContext(js.slice(normalizeStart, start) + js.slice(start, end) + '; parseRequest');


test('Hindi locality searches transliterate into Latin inventory text instead of becoming an empty match', () => {
  const start = js.indexOf('function normalizeSearchText(value){');
  const end = js.indexOf('function parseRequest(raw){', start);
  assert.ok(start >= 0 && end > start, 'Hindi-aware search normalizer is present');
  const normalize = vm.runInNewContext(js.slice(start, end) + '; normalizeSearchText');
  assert.equal(normalize('अजय पटेल नगर'), 'ajay patel nagar');
  assert.equal(normalize('सिंगरौली'), 'singrauli');
  assert.equal(normalize('भोपाल'), 'bhopal');
  assert.equal(normalize('इंदौर'), 'indore');
  const inventory = normalize('Ajay Patel Nagar, Singrauli, Madhya Pradesh');
  assert.ok(normalize('अजय पटेल नगर').split(' ').every(term => inventory.includes(term)));
});

test('Hindi Smart Finder generic home request keeps stay type unrestricted', () => {
  const p = parseRequest('अजय पटेल नगर में जितने भी घर है दिखाओ');
  assert.equal(p.location, 'अजय पटेल नगर');
  assert.equal(p.stayType, '');
});

test('Hinglish assistant extracts locality, budget, BHK and furnishing', () => {
  const p = parseRequest('Mujhe Patel Nagar Bhopal mein 2 BHK furnished flat chahiye. Budget 8000 rupees hai aur college paas hona chahiye.');
  assert.equal(p.location, 'Patel Nagar Bhopal'); assert.equal(p.maxBudget, '8000'); assert.equal(p.bhk, '2');
  assert.equal(p.furnishing, 'Furnished'); assert.equal(p.stayType, 'home'); assert.equal(p.nearby, 'college');
});

test('Madhya Pradesh state-plus-city voice request resolves to the requested city and executes search', () => {
  const p = parseRequest('मध्य प्रदेश के इंदौर में जितने भी rental houses available हैं दिखाओ');
  assert.equal(p.location, 'Indore');
  assert.equal(p.stayType, '');
});
test('state normalization preserves a locality when a city and state are spoken together', () => {
  const p = parseRequest('Patel Nagar Bhopal Madhya Pradesh mein rental houses dikhao');
  assert.equal(p.location, 'Patel Nagar Bhopal');
});
test('spoken renter search is one-shot, stop-safe and submits the existing real search form', () => {
  assert.ok(js.includes('r.continuous=false'));
  assert.ok(js.includes('state.voiceDraft=finalTranscript.trim()'));
  assert.ok(js.includes('const transcript=finalTranscript.trim()'));
  assert.ok(js.includes('state.voiceSession'));
  assert.ok(js.includes('function stopRenterVoice'));
  assert.ok(js.includes('r.abort?r.abort():r.stop()'));
  assert.ok(js.includes('review(finalText,{autoSearch:true})'));
  assert.ok(js.includes('speakAssistantReply(spokenReply,replyLanguage)'));
  assert.ok(js.includes('form.requestSubmit()'));
  assert.ok(js.includes('Chrome speech recognition could not reach its speech service'));
});

test('voice parser distinguishes Room from Apartment for renter searches', () => {
  const room = parseRequest('Patel Nagar Bhopal mein single room rent par dikhao');
  assert.equal(room.stayType, 'home');
  assert.equal(room.propertyType, 'room');
  const apartment = parseRequest('Show me an apartment in Indore');
  assert.equal(apartment.propertyType, 'apartment');
});
test('spoken follow-up filters preserve the previously selected city and stay type', () => {
  assert.ok(js.includes('const extracted=parseRequest(raw),previous=state.parsed||{}'));
  assert.ok(js.includes('if(!extracted[key]&&!(broadHomes&&(key==="stayType"||key==="propertyType")))p[key]=previous[key]||""'));
  assert.ok(js.includes('if(broadHomes){p.stayType="";p.propertyType="";}'));
});
test('renter search applies an exact property type filter to real inventory', () => {
  assert.ok(index.includes('id="renterSearchPropertyType"'));
  assert.ok(index.includes('propertyType:$("renterSearchPropertyType")'));
  assert.ok(index.includes('const propertyTypeMatch = !renterPropertyType'));
  assert.ok(index.includes('locationMatch && listingTypeMatch && propertyTypeMatch'));
});

test('Hindi locality search requires all meaningful locality words, not a generic shared token', () => {
  assert.match(index, /const typedLocationMatch = typedTerms\.every\(term =>/);
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
  assert.match(index, /gdr-renter-experience\.js(?:\?v=[^"']+)?/); assert.match(index, /gdr-renter-experience\.css(?:\?v=[^"']+)?/);
});

test('map API exports a real radius setter so initialization cannot fail', () => {
  assert.match(map, /function setRenterRadius\(value,skipSearch\)/);
  assert.match(map, /setRenterRadius,getRenterVisibleProperties/);
});
test('map voice uses its own microphone and status elements', () => {
  assert.match(js, /micId=mapMode\?"gdrxMapMic":"gdrxMic"/);
  assert.match(js, /statusId=mapMode\?"gdrxMapStatus":"gdrxStatus"/);
  assert.match(js, /function runMapSearch\(rawOverride\)/);
  assert.match(js, /await api\.searchTypedMapLocation\(\)/);
});
test('Hindi voice command extracts Singrauli Madhya Pradesh as the location', () => {
  const p = parseRequest('मुझे सिंगरौली मध्य प्रदेश में जितने भी घर अवेलेबल हैं दिखाओ');
  assert.equal(p.location, 'Singrauli');
  assert.equal(p.stayType, '');
});
test('voice assistant replies in the language used by the speaker', () => {
  const start = js.indexOf('function detectReplyLanguage(raw){');
  const end = js.indexOf('function setValue', start);
  assert.ok(start >= 0 && end > start, 'voice response helpers are present');
  const helpers = vm.runInNewContext(js.slice(start, end) + '; ({detectReplyLanguage, assistantReply})');
  assert.equal(helpers.detectReplyLanguage('मुझे भोपाल में घर दिखाओ'), 'hi');
  assert.equal(helpers.detectReplyLanguage('Show available homes in Bhopal'), 'en');
  assert.match(helpers.assistantReply('hi', 3, 'सिंगरौली'), /मुझे 3 उपलब्ध/);
  assert.match(helpers.assistantReply('en', 2, 'Bhopal'), /I found 2 available/);
});
test('map assistant speaks responses and preserves previous location for follow-up filters', () => {
  assert.match(js, /speechSynthesis\.speak/);
  assert.match(js, /const parsed=parseRequest\(raw\),previous=state\.lastMapSearch\|\|\{\}/);
  assert.match(js, /await api\.openRenterMap\(\)/);
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

test('map search calls the live Supabase viewport RPC and enforces map bounds and radius', () => {
  assert.match(map, /get_available_map_properties_in_bounds/);
  assert.match(map, /p_south:/); assert.match(map, /p_north:/);
  assert.match(map, /p_radius_km:Number\(state\.radiusKm\)/);
  assert.match(map, /distanceKm\(center/);
  assert.match(map, /bounds\.contains/);
  assert.match(map, /Search this area/);
});
test('map results exclude occupied inventory and deduplicate property ids', () => {
  assert.match(map, /status!=="verified"&&status!=="pending"/);
  assert.match(map, /unique\.has\(String\(p\.id\)\)/);
  assert.match(mapMigration, /released_at is null/);
});
test('map GPS action centers the map before searching the selected viewport', () => {
  assert.match(map, /async function searchAtCoordinates\(lat,lng,label\)/);
  assert.match(map, /searchAtCoordinates,usePreciseOwnerLocation/);
});

test('renter dashboard keeps Explore Map and Explore Nearby as separate actions', () => {
  assert.match(index, /id="renterExploreMapBtn"/);
  assert.match(index, /id="renterLiveNearbyBtn"/);
  assert.match(index, /<strong>Explore Nearby<\/strong>/);
  assert.match(js, /mapBtn\.addEventListener\("click"/);
  assert.match(index, /action\.addEventListener\("click",event=>\{/);
  assert.match(index, /function showPanel\(\)/);
});
test('renter dashboard keeps the Find a Home shortcut and working payment destination', () => {
  assert.match(index, /id="renterFindHomeBtn"/);
  assert.match(js, /fbtn\.addEventListener\("click",openFind\)/);
  assert.match(rentalSuite, /id="gdrRenterPaymentsAction"/);
  assert.match(rentalSuite, /openRenter\("payments"\)/);
});
test('renter dashboard final visual overrides provide readable hero and premium pastel actions', () => {
  assert.match(index, /gdr-renter-dashboard-visual-fix-v4/);
  assert.match(index, /renter-welcome-copy h3\{[\s\S]*?color:#fff!important/);
  assert.match(index, /#gdrRenterPaymentsAction\{[\s\S]*?background:linear-gradient\(135deg,#e5f5ff/);
  assert.match(index, /#gdrxSupport\{[\s\S]*?background:linear-gradient\(145deg,#f2fbf6/);
  assert.match(js, /We’re here to help with your rental journey/);
});


test('GDR Smart Finder greets renters as their personal assistant and searches the live public inventory', () => {
  assert.match(js, /Hello! मैं GDR Assistant हूँ — GharDekho का आपका personal assistant/);
  assert.match(js, /client\.rpc\("get_public_properties"\)/);
  assert.match(js, /searchAssistantListings\(p,raw\)/);
  assert.ok(js.includes('rows.length===1?"Home":"Homes"'));
  assert.match(js, /filterAssistantListings/);
});

test('database-backed assistant results exclude occupied listings and unrelated city matches', () => {
  const start = js.indexOf('function filterAssistantListings(rows,prefs){');
  const end = js.indexOf('\nasync function searchAssistantListings', start);
  assert.ok(start >= 0 && end > start, 'assistant listing filter is present');
  const helpers = vm.runInNewContext(js.slice(normalizeStart, start) + js.slice(start, end) + '; ({normalizeSearchText,filterAssistantListings})');
  const fixtures = [
    {id:'bhopal-1',location:'Patel Nagar, Bhopal, Madhya Pradesh',address:'Patel Nagar, Bhopal',status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:6000},
    {id:'wrong-city',location:'Patel Nagar, Bhopal, Madhya Pradesh',address:'Karol Bagh, Delhi',latitude:28.6450127,longitude:77.1692817,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:7000},
    {id:'occupied',location:'Patel Nagar, Bhopal, Madhya Pradesh',address:'Patel Nagar, Bhopal',status:'occupied',verification_status:'verified',owner_verified:true,listing_type:'home',rent:5000},
    {id:'singrauli',location:'Waidhan, Singrauli, Madhya Pradesh',address:'Waidhan, Singrauli',status:'verified',verification_status:'verified',owner_verified:true,listing_type:'home',rent:5000}
  ];
  const bhopal = helpers.filterAssistantListings(fixtures,{location:'Patel Nagar Bhopal',stayType:'home'});
  assert.deepEqual(Array.from(bhopal,row=>row.id),['bhopal-1']);
  const singrauli = helpers.filterAssistantListings(fixtures,{location:'Singrauli',stayType:'home'});
  assert.deepEqual(Array.from(singrauli,row=>row.id),['singrauli']);
});

test('assistant district results can show a genuine listing without map coordinates', () => {
  const start = js.indexOf('function filterAssistantListings(rows,prefs){');
  const end = js.indexOf('\nasync function searchAssistantListings', start);
  const helpers = vm.runInNewContext(js.slice(normalizeStart, start) + js.slice(start, end) + '; filterAssistantListings');
  const rows = helpers([{id:'no-pin',location:'Vindhyanagar, Singrauli, Madhya Pradesh',address:'Vindhyanagar, Singrauli',status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',latitude:null,longitude:null}],{location:'Singrauli',stayType:'home'});
  assert.equal(rows.length,1);
});


test('dashboard initialization does not rescan the entire document for every DOM mutation', () => {
  assert.equal(js.includes('new MutationObserver(bind).observe(document.body'), false);
  assert.doesNotMatch(js, /__gdrAvailableRentalPanelObserver/);
  assert.ok(js.includes('scoreFrame=requestAnimationFrame(()=>{scoreFrame=0;applyManualScores();})'));
  assert.ok(js.includes('document.addEventListener("DOMContentLoaded",bind)'));
});

test('mobile Smart Finder property cards use a vertical layout with a readable three-action row', () => {
  assert.match(css, /#gdrxAssistantResults \.gdrx-assistant-property-card\{[\s\S]*?flex-direction:column!important/);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css, /writing-mode:horizontal-tb!important/);
  assert.match(css, /overflow-wrap:normal!important/);
});

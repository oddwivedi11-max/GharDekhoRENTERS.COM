const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const js = fs.readFileSync('assets/gdr-renter-experience.js', 'utf8');
const map = fs.readFileSync('assets/gdr-map-experience.js', 'utf8');
const mapVoice = fs.readFileSync('assets/gdr-map-voice.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const mapMigration = fs.readFileSync('supabase/migrations/20261107120000_available_map_search.sql', 'utf8');
const assistantSearchMigration = fs.readFileSync('supabase/migrations/20261107150000_gdr_assistant_server_search.sql', 'utf8');
const cityLocalitySearchMigration = fs.readFileSync('supabase/migrations/20261107162245_expand_assistant_city_locality_search.sql', 'utf8');
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

test('Hindi generic house requests search available homes', () => {
  const p = parseRequest('अजय पटेल नगर में जितने भी घर है दिखाओ');
  assert.equal(p.location, 'अजय पटेल नगर');
  assert.equal(p.stayType, 'home');
});

test('Hinglish assistant extracts locality, budget, BHK and furnishing', () => {
  const p = parseRequest('Mujhe Patel Nagar Bhopal mein 2 BHK furnished flat chahiye. Budget 8000 rupees hai aur college paas hona chahiye.');
  assert.equal(p.location, 'Patel Nagar Bhopal'); assert.equal(p.maxBudget, '8000'); assert.equal(p.bhk, '2');
  assert.equal(p.furnishing, 'Furnished'); assert.equal(p.stayType, 'home'); assert.equal(p.nearby, 'college');
});

test('Madhya Pradesh state-plus-city voice request resolves to the requested city and executes search', () => {
  const p = parseRequest('मध्य प्रदेश के इंदौर में जितने भी rental houses available हैं दिखाओ');
  assert.equal(p.location, 'Indore');
  assert.equal(p.stayType, 'home');
});
test('state normalization preserves a locality when a city and state are spoken together', () => {
  const p = parseRequest('Patel Nagar Bhopal Madhya Pradesh mein rental houses dikhao');
  assert.equal(p.location, 'Patel Nagar Bhopal');
});
test('GDR assistant uses indexed server-side pagination and never preloads the full public inventory', () => {
  assert.match(js, /search_public_properties_for_assistant/);
  assert.match(js, /p_limit:pageSize/);
  assert.match(js, /p_offset:offset/);
  assert.match(js, /total_count/);
  assert.match(js, /assistantAbortController/);
  assert.match(js, /AbortController/);
  assert.match(js, /function loadMore\(button\)/);
  assert.doesNotMatch(js, /get_public_properties|warmPublicInventory/);
  assert.match(assistantSearchMigration, /CREATE INDEX IF NOT EXISTS properties_assistant_search_tsv_idx/i);
  assert.match(assistantSearchMigration, /search_public_properties_for_assistant/);
  assert.match(assistantSearchMigration, /REVOKE ALL ON FUNCTION/i);
  assert.match(assistantSearchMigration, /GRANT EXECUTE ON FUNCTION/i);
});

test('typed map searches fit every returned property marker into the map viewport', () => {
  const start = map.indexOf('async function searchTypedMapLocation(){');
  const end = map.indexOf('async function searchRenterArea(', start);
  assert.ok(start >= 0 && end > start, 'typed map search implementation is present');
  const search = map.slice(start, end);
  assert.match(search, /const mapped=\(Array\.isArray\(results\)\?results:\[\]\)\.filter/);
  assert.match(search, /state\.renterMap\.fitBounds\(mapped,\{padding:\[56,56\],maxZoom:13,animate:false\}\)/);
  assert.match(search, /state\.renterMap\.setView\(mapped\[0\]/);
});

test('typed GDR assistant searches immediately and automatically reveals the property results', () => {
  assert.ok(js.includes('review($("gdrxPrompt").value,{autoSearch:true})'), 'the main assistant action starts a real search without a second confirmation click');
  assert.ok(js.includes('Find matching homes →'), 'the primary action clearly communicates that it searches');
  assert.ok(js.includes('Searching matching homes now… Results will open automatically below.'), 'the review state explains that results are loading automatically');
  assert.ok(js.includes('section.scrollIntoView({behavior:window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"})'), 'the actual Available Rental Properties section is brought into view after results render');
});

test('spoken renter search is one-shot, stop-safe and uses the direct database search', () => {
  assert.ok(js.includes('r.continuous=false'));
  assert.ok(js.includes('state.voiceDraft=finalTranscript.trim()'));
  assert.ok(js.includes('const transcript=finalTranscript.trim()'));
  assert.ok(js.includes('state.voiceSession'));
  assert.ok(js.includes('function stopRenterVoice'));
  assert.ok(js.includes('r.abort?r.abort():r.stop()'));
  assert.ok(js.includes('review(finalText,{autoSearch:true})'));
  assert.ok(js.includes('speakAssistantReply(spokenReply,replyLanguage)'));
  assert.ok(js.includes('searchAssistantListings(p,raw)'));
  assert.doesNotMatch(js, /form\\.requestSubmit\\(\\);searchAssistantListings/);
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
  assert.ok(js.includes('const resetKeys=broadAllListings?'));
  assert.ok(js.includes('if(!extracted[key]&&!resetKeys.includes(key))p[key]=previous[key]||""'));
  assert.ok(js.includes('if(resetListingType){p.stayType=broadAllListings?"":"home";p.propertyType="";}'));
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
test('map has one dedicated voice assistant microphone and status surface', () => {
  assert.match(mapVoice, /id="gdrMapVoiceMic"/);
  assert.match(mapVoice, /id="gdrMapVoiceStatus"/);
  assert.match(map, /GDRMapVoiceAssistant\.mount\(panel\)/);
  assert.doesNotMatch(js, /toolbar\.appendChild\(w\)/);
  assert.doesNotMatch(js, /function runMapSearch\(rawOverride\)/);
});
test('Hindi all-property command resolves Singrauli and clears restrictive listing filters', () => {
  const p = parseRequest('मुझे सिंगरौली मध्य प्रदेश में जितने भी प्रॉपर्टीज है दिखाओ');
  assert.equal(p.location, 'Singrauli');
  assert.equal(p.stayType, '');
  assert.equal(p.bhk, '');
  assert.equal(p.furnishing, '');
});
test('Locality-only Hindi/Hinglish all-property commands retain the requested locality', () => {
  assert.equal(parseRequest('मुझे पटेल नगर की सारी प्रॉपर्टी दिखाओ').location, 'पटेल नगर');
  assert.equal(parseRequest('Patel Nagar Bhopal ki saari properties').location, 'Patel Nagar Bhopal');
  assert.equal(parseRequest('Mujhe Patel Nagar Bhopal ki saari properties dikhao').location, 'Patel Nagar Bhopal');
});

test('a new location-only Find Home request clears filters carried over from the previous city', () => {
  assert.match(js, /const locationChanged=!!\(extracted\.location&&normalizeSearchText\(extracted\.location\)!==normalizeSearchText\(previous\.location\|\|""\)\)/);
  assert.match(js, /locationOnlyRequest=!!extracted\.location/);
  assert.match(js, /resetLocationFilters=locationChanged\|\|locationOnlyRequest/);
  assert.match(js, /resetLocationFilters\?\["minBudget","maxBudget","stayType","bhk","furnishing","nearby","propertyType"\]/);
  assert.match(js, /setValue\("renterSearchBhk",p\.bhk,true\)/);
  assert.match(js, /setValue\("renterSearchFurnishing",p\.furnishing,true\)/);
  assert.match(js, /function bindLocationOnlySearchReset\(\)/);
  assert.match(js, /location\.addEventListener\("input",resetIfLocationChanged\)/);
  assert.match(js, /function clearRenterSearchFilters\(\)/);
  assert.match(js, /\["renterMinBudgetPreset","No minimum"\]/);
  assert.match(js, /\["renterStayType","All property types"\]/);
});

test('Find Home review clears previous filters for Hindi jitne bhi property requests', () => {
  assert.ok(js.includes('जितने\\s+भी') && js.includes('jitne\\s+bhi'));
  assert.ok(js.includes('const resetKeys=broadAllListings'));
  assert.ok(js.includes('setValue("renterMinBudget",p.minBudget||"",true)'));
});
test('assistant city-level search expands Singrauli and Bhopal locality aliases without relaxing listing eligibility', () => {
  assert.ok(cityLocalitySearchMigration.includes('waidhan|vindhyanagar'));
  assert.ok(cityLocalitySearchMigration.includes('dav[[:space:]]+road'));
  assert.ok(cityLocalitySearchMigration.includes('patel[[:space:]]+nagar'));
  assert.ok(cityLocalitySearchMigration.includes('not exists('));
  assert.ok(cityLocalitySearchMigration.includes("p.status='verified'"));
});

test('voice auto-search safely runs even when review mode omits the manual action buttons', () => {
  const start = js.indexOf('function review(raw,options){');
  const end = js.indexOf('function setRenterMicState', start);
  assert.ok(start >= 0 && end > start, 'assistant review handler is present');
  const review = js.slice(start, end);
  assert.match(review, /const editButton=\$\("gdrxEdit"\);\s*if\(editButton\)/);
  assert.match(review, /const findButton=\$\("gdrxFind"\);\s*if\(findButton\)/);
  assert.match(review, /if\(options&&options\.autoSearch\)void searchAssistantListings\(p,raw\)/);
  assert.doesNotMatch(review, /\$\("gdrxEdit"\)\.onclick/);
  assert.doesNotMatch(review, /\$\("gdrxFind"\)\.onclick/);
});

test('assistant search keeps property cards visible if optional map rendering fails', () => {
  const start = js.indexOf('const renderLoadedRows=()=>{');
  const end = js.indexOf('const describeCount=', start);
  assert.ok(start >= 0 && end > start);
  const render = js.slice(start, end);
  assert.ok(render.indexOf('window.renderVoicePropertyResults(loadedRows)') < render.indexOf('try{mapApi.showVoiceSearchResults'));
  assert.match(render, /catch\(error\)\{console\.warn\("GDR assistant list results are ready; map rendering was skipped:"/);
});

test('assistant result analytics use actual loaded listing and verification fields', () => {
  assert.match(js, /function setAssistantAnalytics\(rows,count\)/);
  assert.match(js, /Total matching/);
  assert.match(js, /Property verification:/);
  assert.match(js, /Listed rent range:/);
  assert.match(js, /Map-ready/);
  assert.match(js, /Owner verified:/);
  assert.match(css, /gdrx-assistant-analytics/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?gdrx-analytics-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
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
test('voice map search renders markers only once after its location is resolved', () => {
  const start = js.indexOf('const renderLoadedRows=()=>{');
  const end = js.indexOf('const describeCount=', start);
  assert.ok(start >= 0 && end > start);
  const render = js.slice(start, end);
  assert.ok(render.includes('if(!target){') && render.includes('showVoiceSearchResults'));
  assert.ok(mapVoice.includes('api.showVoiceSearchResults(rows,point,location)'));
});

test('GPS voice searches apply the requested radius and active assistant filters before querying', () => {
  const start = mapVoice.indexOf('if(intent.nearMe){');
  const end = mapVoice.indexOf('const position=await new Promise', start);
  assert.ok(start >= 0 && end > start);
  const nearby = mapVoice.slice(start, end);
  assert.ok(nearby.includes('setRenterSearchPreferences(state.prefs)'));
  assert.ok(nearby.includes('setRenterRadius(intent.radiusKm,true)'));
});

test('voice follow-up commands can explicitly clear active budget, BHK and furnishing filters', () => {
  assert.ok(mapVoice.includes('budget|rent') && mapVoice.includes('hatao'));
  assert.ok(mapVoice.includes('bhk|bedrooms?'));
  assert.ok(mapVoice.includes('furnishing'));
});

test('map assistant speaks responses and retains search context for follow-up filters', () => {
  assert.match(mapVoice, /speechSynthesis\.speak/);
  assert.match(mapVoice, /prefs=\{\.\.\.state\.prefs\}/);
  assert.match(mapVoice, /const intent=extractIntent\(raw\),location=intent\.location\|\|state\.city/);
  assert.match(mapVoice, /assistant\.searchAssistantListings\(\{\.\.\.state\.prefs,location\},raw,target\)/);
  assert.match(map, /GDRMapVoiceAssistant\.mount\(panel\)/);
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
  assert.match(map, /verification==="pending"&&status!=="pending"/);
  assert.match(map, /unique\.has\(String\(p\.id\)\)/);
  assert.match(mapMigration, /released_at is null/);
});
test('map GPS action centers the map before searching the selected viewport', () => {
  assert.match(map, /async function searchAtCoordinates\(lat,lng,label\)/);
  assert.match(map, /searchAtCoordinates,showVoiceSearchResults,usePreciseOwnerLocation/);
});

test('renter dashboard keeps Explore Map and Explore Nearby as separate actions', () => {
  assert.match(index, /id="renterExploreMapBtn"/);
  assert.match(index, /id="renterLiveNearbyBtn"/);
  assert.match(index, /<strong>Explore Nearby<\/strong>/);
  assert.match(map, /renterExploreMapBtn.*addEventListener\("click",openRenterMap\)/);
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
  assert.match(js, /client\.rpc\("search_public_properties_for_assistant"/);
  assert.match(js, /searchAssistantListings\(p,raw\)/);
  assert.ok(js.includes('window.renderVoicePropertyResults(loadedRows)'));
  assert.doesNotMatch(js, /gdrx-assistant-property-card/);
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


test('Renter Edit Profile is a single action below the main renter dashboard content', () => {
  const welcomeStart = index.indexOf('<div class="renter-welcome-card">');
  const actionsStart = index.indexOf('<div class="renter-dashboard-actions">', welcomeStart);
  const welcomeMarkup = index.slice(welcomeStart, actionsStart);
  const savedStart = index.indexOf('id="renterSavedPropertiesSection"');
  const editButton = index.indexOf('id="renterEditProfileBtn"');
  assert.ok(welcomeStart >= 0 && actionsStart > welcomeStart, 'renter welcome card is present');
  assert.doesNotMatch(welcomeMarkup, /renterEditProfileBtn/, 'Edit Profile is not inside the welcome card');
  assert.ok(savedStart >= 0 && editButton > savedStart, 'Edit Profile is positioned after the renter dashboard content');
  assert.equal((index.match(/id="renterEditProfileBtn"/g) || []).length, 1, 'only one Edit Profile button exists');
  assert.match(index, /getElementById\("renterEditProfileBtn"\)\?\.addEventListener\("click", openRenterProfileEditor\)/);
  assert.match(index, /getElementById\("renterProfileForm"\)\?\.addEventListener\("submit", saveRenterProfile\)/);
});

test('Renter dashboard action colors match the approved beige Map and forest-green Nearby palette', () => {
  assert.match(index, /#renterDashboard #renterExploreMapBtn[\s\S]*?background:#E8D8C3!important;border:1px solid #D5C1A8!important;color:#493A2B!important/);
  assert.match(index, /#renterDashboard #renterLiveNearbyBtn,[\s\S]*?background:#174B35!important;border:1px solid #103B2A!important;color:#fff!important/);
  assert.match(index, /#renterDashboard #renterLiveNearbyBtn:hover[\s\S]*?background:#103B2A!important/);
});

test('Renter welcome and account-edit cards remain responsive without replacing the existing profile editor', () => {
  assert.match(index, /Find a Home That Fits for You/);
  assert.match(index, /class="renter-account-edit-card"/);
  assert.match(index, /@media\(max-width:760px\)[\s\S]*?renter-account-edit-card\{align-items:stretch!important;flex-direction:column!important/);
  assert.match(index, /id="renterProfileEditor"/);
});


test('voice intent understands numeric, word-based and Hindi BHK requests', () => {
  const twoBhk = parseRequest('Mujhe Patel Nagar mein 2 BHK houses dikhao');
  assert.equal(twoBhk.bhk, '2');
  assert.equal(twoBhk.stayType, 'home');
  assert.equal(twoBhk.location, 'Patel Nagar');
  const twoBedroom = parseRequest('मुझे सिंगरौली में 2 बेडरूम घर दिखाओ');
  assert.equal(twoBedroom.bhk, '2');
  assert.equal(twoBedroom.stayType, 'home');
  const wordBhk = parseRequest('Show me two bedroom homes in Singrauli');
  assert.equal(wordBhk.bhk, '2');
  assert.equal(wordBhk.stayType, 'home');
});

test('location filters include Waidhan, Vindhyanagar and Singrauli spelling variants while rejecting distant false pins', () => {
  const filterStart = js.indexOf('function filterAssistantListings(rows,prefs){');
  const filterEnd = js.indexOf('async function searchAssistantListings', filterStart);
  const normalizerStart = js.indexOf('function normalizeSearchText(value){');
  const parserStart = js.indexOf('function parseRequest(raw){', normalizerStart);
  assert.ok(normalizerStart >= 0 && parserStart > normalizerStart && filterEnd > filterStart);
  const helpers = vm.runInNewContext(js.slice(normalizerStart, parserStart) + js.slice(filterStart, filterEnd) + '; ({normalizeSearchText,filterAssistantListings})');
  const fixtures = [
    {id:'singrauli-core',location:'Rajmata Chun Kumari Stadium, Waidhan, Singrauli, Madhya Pradesh',latitude:24.0688,longitude:82.6255,bhk:2,status:'verified',verification_status:'verified',owner_verified:true,listing_type:'home',rent:2588},
    {id:'vindhyanagar',location:'DAV Road, Vindhyanagar, Singrauli, Madhya Pradesh',latitude:null,longitude:null,bhk:2,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:6000},
    {id:'saved-spelling',location:'DAV Road Singruali',latitude:null,longitude:null,bhk:2,status:'pending',verification_status:'pending',owner_verified:false,listing_type:'home',rent:2626},
    {id:'waidhan-only',location:'Waidhan, Madhya Pradesh',latitude:24.0794,longitude:82.5731,bhk:3,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:2700},
    {id:'wrong-city',location:'Singrauli, Madhya Pradesh',latitude:28.6450,longitude:77.1692,bhk:2,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:7000},
    {id:'occupied',location:'Singrauli, Madhya Pradesh',latitude:24.07,longitude:82.62,bhk:2,status:'occupied',verification_status:'verified',owner_verified:true,listing_type:'home',rent:5000}
  ];
  const results = helpers.filterAssistantListings(fixtures,{location:'Singrauli',stayType:'home',bhk:'2'});
  assert.deepEqual(Array.from(results,row=>row.id),['singrauli-core','saved-spelling','vindhyanagar']);
});

test('Patel Nagar Bhopal returns available 2 BHK homes and excludes occupied homes and a Delhi pin', () => {
  const filterStart = js.indexOf('function filterAssistantListings(rows,prefs){');
  const filterEnd = js.indexOf('async function searchAssistantListings', filterStart);
  const normalizerStart = js.indexOf('function normalizeSearchText(value){');
  const parserStart = js.indexOf('function parseRequest(raw){', normalizerStart);
  const helpers = vm.runInNewContext(js.slice(normalizerStart, parserStart) + js.slice(filterStart, filterEnd) + '; filterAssistantListings');
  const fixtures = [
    {id:'patel-pending',location:'Patel Nagar, Bhopal, Madhya Pradesh',latitude:23.2557,longitude:77.5021,bhk:2,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:6000},
    {id:'patel-verified',location:'Patel Nagar, Bhopal, Madhya Pradesh',latitude:23.2557,longitude:77.5021,bhk:2,status:'verified',verification_status:'verified',owner_verified:true,listing_type:'home',rent:7777},
    {id:'patel-delhi-pin',location:'Patel Nagar, Bhopal, Madhya Pradesh',latitude:28.6450,longitude:77.1692,bhk:2,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:7000},
    {id:'patel-occupied',location:'Patel Nagar, Bhopal, Madhya Pradesh',latitude:23.2557,longitude:77.5021,bhk:2,status:'occupied',verification_status:'verified',owner_verified:true,listing_type:'home',rent:5000},
    {id:'patel-hostel',location:'Patel Nagar, Bhopal, Madhya Pradesh',latitude:23.2557,longitude:77.5021,bhk:null,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'hostel',available_beds:10,rent:8000}
  ];
  const results = helpers(fixtures,{location:'Patel Nagar Bhopal',stayType:'home',bhk:'2'});
  assert.deepEqual(Array.from(results,row=>row.id),['patel-pending','patel-verified']);
});

test('voice results reuse the Available Rental Properties renderer instead of duplicate assistant cards', () => {
  const start=js.indexOf('async function searchAssistantListings(prefs,raw,target){');
  const end=js.indexOf('function parseRequest(raw){',start);
  const search=js.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(search,/window\.renderVoicePropertyResults\(loadedRows\)/);
  assert.match(search,/propertiesSection/);
  assert.match(search,/propertiesContainer/);
  assert.match(search,/gdrVoiceInventorySummary/);
  assert.match(search,/section\.scrollIntoView\(\{behavior:window\.matchMedia&&window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\?"auto":"smooth",block:"start"\}\)/);
  assert.doesNotMatch(search,/gdrx-assistant-property-card/);
});

test('map voice responses identify the actual Available Rental Properties section', () => {
  assert.match(mapVoice,/Available Rental Properties below/);
  assert.match(mapVoice,/assistant\.searchAssistantListings\(\{\.\.\.state\.prefs,location\},raw,target\)/);
});


test('configuration-based BHK matching is exact and does not classify 1 RK as 1 BHK', () => {
  const normalizerStart = js.indexOf('function normalizeSearchText(value){');
  const filterStart = js.indexOf('function filterAssistantListings(rows,prefs){');
  const filterEnd = js.indexOf('async function searchAssistantListings', filterStart);
  assert.ok(normalizerStart >= 0 && filterStart > normalizerStart && filterEnd > filterStart);
  const helpers = vm.runInNewContext(js.slice(normalizerStart, filterStart) + js.slice(filterStart, filterEnd) + '; filterAssistantListings');
  const fixtures = [
    {id:'configured-2bhk',location:'Patel Nagar, Bhopal',configuration:'2 BHK',bhk:null,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:7000},
    {id:'one-rk',location:'Patel Nagar, Bhopal',configuration:'1 RK',bhk:1,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:4000},
    {id:'missing-configuration',location:'Patel Nagar, Bhopal',configuration:null,bhk:null,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:5000}
  ];
  const twoBhk = helpers(fixtures,{location:'Patel Nagar',stayType:'home',bhk:'2'});
  assert.deepEqual(Array.from(twoBhk,row=>row.id),['configured-2bhk']);
  const oneBhk = helpers(fixtures,{location:'Patel Nagar',stayType:'home',bhk:'1'});
  assert.deepEqual(Array.from(oneBhk,row=>row.id),[]);
});

test('Singrauli city search uses the structured 486xxx PIN when a valid locality has no city text or nearby coordinates', () => {
  const normalizerStart = js.indexOf('function normalizeSearchText(value){');
  const filterStart = js.indexOf('function filterAssistantListings(rows,prefs){');
  const filterEnd = js.indexOf('async function searchAssistantListings', filterStart);
  const helpers = vm.runInNewContext(js.slice(normalizerStart, filterStart) + js.slice(filterStart, filterEnd) + '; filterAssistantListings');
  const fixtures = [
    {id:'remote-singrauli-pin',location:'Shakti Nagar',address:'Shakti Nagar',pincode:'486885',latitude:24.95,longitude:82.62,bhk:2,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:6500},
    {id:'wrong-delhi-pin',location:'Singrauli, Madhya Pradesh',pincode:'110005',latitude:28.645,longitude:77.169,bhk:2,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:7000}
  ];
  const results = helpers(fixtures,{location:'Singrauli',stayType:'home',bhk:'2'});
  assert.deepEqual(Array.from(results,row=>row.id),['remote-singrauli-pin']);
});

// CI executes these live-search regression cases before production deployment.


test('Singrauli city-wide search includes the wider district area while excluding occupied homes', () => {
  assert.match(js, /singrauli:\{center:\[24\.0724946,82\.6246537\],radiusKm:120/);
  assert.match(js, /const unavailable=\["occupied","rejected","removed","deleted","unavailable","released"\]/);
  assert.match(js, /verification==="verified"&&row\.owner_verified===true/);
});


test('Hindi city-first all-property request in Singrauli resolves the city and clears accidental filters', () => {
  const examples = [
    ['सिंगरौली में जितनी भी प्रॉपर्टीज है मुझे', ''],
    ['सिंगरौली में जितनी भी प्रॉपर्टीज हैं मुझे दिखाओ', ''],
    ['मुझे सिंगरौली में सभी प्रॉपर्टीज दिखाओ', ''],
    ['सिंगरौली में जितने भी घर हैं दिखाओ', 'home']
  ];
  for (const [phrase, expectedStayType] of examples) {
    const parsed = parseRequest(phrase);
    assert.equal(parsed.location, 'Singrauli', phrase);
    assert.equal(parsed.stayType, expectedStayType, phrase);
    assert.equal(parsed.bhk, '', phrase);
    assert.equal(parsed.maxBudget, '', phrase);
    assert.equal(parsed.propertyType, '', phrase);
  }
});

test('Hindi city-first locality searches retain the locality while stripping all-property wording', () => {
  const parsed = parseRequest('भोपाल में पटेल नगर की जितनी भी प्रॉपर्टीज हैं मुझे दिखाओ');
  assert.equal(parsed.location, 'पटेल नगर, भोपाल');
  assert.equal(parsed.stayType, '');
});


test('Hindi request "भोपाल पटेल नगर में जितनी प्रॉपर्टीज है दिखाओ" resolves to Patel Nagar, Bhopal', () => {
  const p = parseRequest('भोपाल पटेल नगर में जितनी प्रॉपर्टीज है दिखाओ');
  assert.equal(p.location, 'patel nagar, Bhopal');
  assert.equal(p.stayType, '');
});

test('Patel Nagar Bhopal assistant search returns only real available records with accurate coordinates', () => {
  const filterStart = js.indexOf('function normalizedPropertyBhk(row){');
  const filterEnd = js.indexOf('async function searchAssistantListings', filterStart);
  assert.ok(filterStart >= 0 && filterEnd > filterStart, 'shared inventory filter is present');
  const helpers = vm.runInNewContext(
    js.slice(normalizeStart, start) +
    js.slice(start, end) +
    js.slice(filterStart, filterEnd) +
    '; ({parseRequest,filterAssistantListings})'
  );
  const intent = helpers.parseRequest('भोपाल पटेल नगर में जितनी प्रॉपर्टीज है दिखाओ');
  const inventory = [
    {id:'patel-pending-home',title:'liitle one house',location:'Patel Nagar, Bhopal, Madhya Pradesh',address:'Patel Nagar, Bhopal',latitude:23.2557212,longitude:77.5021024,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'home',rent:7000},
    {id:'patel-pending-hostel',title:'dwivedi house ji',location:'Patel Nagar, Bhopal, Madhya Pradesh',address:'Patel Nagar, Bhopal',latitude:23.2557212,longitude:77.5021024,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'hostel',available_beds:24,rent:8000},
    {id:'patel-verified-home',title:'om house',location:'Patel Nagar, Bhopal, Madhya Pradesh',address:'Patel Nagar, Bhopal',latitude:23.2557212,longitude:77.5021024,status:'verified',verification_status:'verified',owner_verified:true,listing_type:'home',rent:9000},
    {id:'wrong-delhi-coordinate',title:'Lalu bhai home',location:'Patel Nagar, Bhopal, Madhya Pradesh',address:'Patel Nagar, Bhopal',latitude:28.6450127,longitude:77.1692817,status:'pending',verification_status:'pending',owner_verified:true,listing_type:'hostel',available_beds:7,rent:7000},
    {id:'occupied-patel-home',title:'occupied home',location:'Patel Nagar, Bhopal',latitude:23.2557212,longitude:77.5021024,status:'occupied',verification_status:'verified',owner_verified:true,listing_type:'home',rent:7000}
  ];
  const rows = helpers.filterAssistantListings(inventory,{location:intent.location});
  assert.deepEqual(Array.from(rows,row=>row.id),['patel-pending-home','patel-pending-hostel','patel-verified-home']);
});


test('premium compare studio exposes add, replace, nearby discovery and comparison actions', () => {
  assert.match(js, /function getNearbyCompareProperties\(\)/);
  assert.match(js, /function addCompareProperty\(p\)/);
  assert.match(js, /function openCompareStudio\(\)/);
  assert.match(js, /function showReplaceOptions\(index,options\)/);
  assert.match(js, /gdrxCompareNow/);
  assert.match(js, /gdrxCompareNearby/);
  assert.match(js, /gdrxCompareStudio/);
  assert.match(js, /sessionStorage\.setItem\("gdrxCompareHomes"/);
});
test('map compare action has a dedicated premium button class', () => {
  assert.match(map, /gdr-map-compare-btn/);
});

test('comparison insights disclose amenities and equal-weight value criteria', () => {
  assert.match(js, /Most listed amenities/);
  assert.match(js, /Best overall value/);
  assert.match(js, /equal-weight ranking of monthly rent \+ recorded maintenance and distance/);
});

test('comparison tray provides its own database-backed property picker and filters', () => {
  assert.match(js, /id="gdrxCompareSearch"/);
  assert.match(js, /id="gdrxCompareBhk"/);
  assert.match(js, /id="gdrxCompareFurnishing"/);
  assert.match(js, /async function loadComparePickerInventory\(\)/);
  assert.match(js, /await loadPublicInventory\(\)/);
  assert.match(js, /function renderComparePicker\(\)/);
  assert.match(js, /gdrx-picker-add/);
});

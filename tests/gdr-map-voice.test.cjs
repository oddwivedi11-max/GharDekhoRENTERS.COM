const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const voice = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-voice.js'), 'utf8');
const map = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-experience.js'), 'utf8');
const renter = fs.readFileSync(path.join(__dirname, '../assets/gdr-renter-experience.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-voice.css'), 'utf8');
const mapCss = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-experience.css'), 'utf8');

test('voice assistant loads inside the existing renter Explore Map', () => {
  assert.match(map, /ensureMapVoiceAssistant/);
  assert.match(map, /GDRMapVoiceAssistant\.mount\(panel\)/);
  assert.match(voice, /GDRRenterExperience/);
  assert.match(voice, /assistant\.searchAssistantListings\(\{\.\.\.state\.prefs,location\},raw,target\)/);
  assert.match(voice, /gdrMapVoiceResults/);
});

test('voice recognition is single-utterance, final-transcript-only, and has typed fallback', () => {
  assert.match(voice, /window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(voice, /r\.continuous=false/);
  assert.match(voice, /if\(!current\)state\.finalText=spoken/);
  assert.match(voice, /setTimeout\(finishTurn,450\)/);
  assert.doesNotMatch(voice, /setTimeout\(finishTurn,1800\)/);
  assert.match(voice, /gdrMapVoiceSearch/);
  assert.match(voice, /SpeechSynthesisUtterance/);
  assert.match(voice, /hi-IN/);
  assert.match(voice, /en-IN/);
});
test('voice UI has responsive controls and accessible microphone state', () => {
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 86px/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /\.gdr-map-voice-mic\.is-listening/);
  assert.match(voice, /aria-pressed/);
  assert.match(css, /background:linear-gradient\(145deg,#103d32 0%,#0b3028 100%\)/);
});

test('common rental filters are delegated to the shared deterministic intent parser', () => {
  assert.match(voice, /assistant\.parseRequest\(raw\)/);
  assert.match(voice, /minBudget/);
  assert.match(voice, /maxBudget/);
  assert.match(voice, /bhk/);
  assert.match(renter, /p\.furnishing="Furnished"/);
  assert.match(renter, /p\.stayType="pg"/);
});


test('voice searches the public inventory and renders results in Available Rental Properties', () => {
  assert.match(voice, /assistant\.searchAssistantListings\(\{\.\.\.state\.prefs,location\},raw,target\)/);
  assert.match(voice, /gdrMapVoiceResults/);
  assert.doesNotMatch(voice, /api\.searchTypedMapLocation\(\)/);
  assert.match(voice, /api\.showVoiceSearchResults\(rows,point,location\)/);
  assert.match(renter, /client\.rpc\("search_public_properties_for_assistant"/);
  assert.match(renter, /searchAssistantListings\(prefs,raw,target\)/);
  assert.match(renter, /window\.renderVoicePropertyResults\((?:rows|loadedRows)\)/);
  assert.match(renter, /propertiesSection/);
  assert.doesNotMatch(renter, /gdrx-assistant-property-card/);
  assert.match(map, /get_available_map_properties_in_bounds/);
  assert.match(map, /function showVoiceSearchResults\(rows,point,label\)/);
  assert.match(map, /renderMarkers\(mappedItems,center,false,false,listRows\)/);
  assert.match(map, /fitBounds\(coordinates,\{padding:\[48,48\],maxZoom:15,animate:false\}\)/);
  assert.match(map, /map pins · /);
  assert.match(map, /const rent=Number\(p\.rent\|\|0\),short=money\(rent\)/);
  assert.match(map, /if\(!p\|\|!validPoint\(p\.latitude,p\.longitude\)\)return/);
  assert.match(map, /if\(pan&&state\.renterMap&&validPoint\(p\.latitude,p\.longitude\)\)/);
});
test('map voice places its assistant directly below the map heading and uses an SVG microphone', () => {
  assert.match(voice, /\.gdr-map-head, \.gdr-map-header/);
  assert.match(map, /gdr-map-voice\.js\?v=20261107-map-voice7/);
  assert.match(voice, /rows\.totalCount\?\?rows\.length/);
  assert.match(voice, /gdr-map-voice-mic-icon/);
  assert.match(voice, /<svg viewBox="0 0 24 24"/);
});
test('speech finalization never submits an interim-only partial transcript', () => {
  assert.match(voice, /const final=String\(state\.finalText/);
  assert.match(voice, /if\(!current\)state\.finalText=spoken/);
  assert.match(voice, /current\.endsWith\(" "\+next\)/);
});
test('Hindi and Hinglish speech phrases retain locality, BHK and rent filters', () => {
  const start = renter.indexOf('function normalizeSearchText(value){');
  const end = renter.indexOf('\nfunction detectReplyLanguage', start);
  const vm = require('node:vm');
  const helpers = vm.runInNewContext(renter.slice(start, end) + '; ({normalizeSearchText,parseRequest})');
  const singrauli = helpers.parseRequest('Mujhe Madhya Pradesh Singrauli mein 2 BHK ghar 10,000 ke kam rent wale dikhao');
  assert.equal(singrauli.location, 'Singrauli');
  assert.equal(singrauli.bhk, '2');
  assert.equal(singrauli.maxBudget, '10000');
  const locality = helpers.parseRequest('मेरे मोबाइल बड़े नगर में 2 BHK घर दिखाओ');
  assert.equal(locality.location, 'बड़े नगर');
  assert.equal(locality.bhk, '2');
});


test('Hindi city-first locality phrases preserve both locality and city', () => {
  const start = renter.indexOf('function normalizeSearchText(value){');
  const end = renter.indexOf('\nfunction detectReplyLanguage', start);
  const vm = require('node:vm');
  const helpers = vm.runInNewContext(renter.slice(start, end) + '; ({normalizeSearchText,parseRequest})');
  const hindi = helpers.parseRequest('मुझे भोपाल में पटेल नगर के सभी 2 BHK घर दिखाओ');
  assert.equal(hindi.location, 'पटेल नगर, भोपाल');
  assert.equal(hindi.bhk, '2');
  const hinglish = helpers.parseRequest('Bhopal mein Patel Nagar mein 2 BHK ghar dikhao under 10k');
  assert.equal(hinglish.location, 'Patel Nagar, Bhopal');
  assert.equal(hinglish.bhk, '2');
  assert.equal(hinglish.maxBudget, '10000');
  const singrauli = helpers.parseRequest('मध्य प्रदेश सिंगरौली में 10,000 रुपये से कम किराये वाले घर दिखाओ');
  assert.equal(singrauli.location, 'Singrauli');
  assert.equal(singrauli.maxBudget, '10000');
});

test('legacy map microphone is removed so only one map voice UI can mount', () => {
  assert.match(renter, /former gdrxMapVoice toolbar injected a second microphone/);
  assert.doesNotMatch(renter, /TALK TO GDR · MAP SEARCH/);
  assert.match(map, /GDRMapVoiceAssistant\.mount\(panel\)/);
});

test('map voice keeps its markers while rental cards render in the shared Available Rental Properties section', () => {
  assert.match(renter, /window\.renderVoicePropertyResults\((?:rows|loadedRows)\)/);
  assert.match(renter, /gdrVoiceInventorySummary/);
  assert.match(renter, /target\.append\(summary\)/);
  assert.doesNotMatch(renter, /gdrx-assistant-property-card/);
  assert.match(map, /marker\.on\("click",\(\)=>selectProperty\(p,true\)\)/);
  assert.match(map, /showPreview\(p\)/);
});



test('4 BHK and conversational location changes are supported by the shared intent parser', () => {
  assert.match(renter, /\[1-5\]/);
  assert.match(renter, /four\|five/);
  assert.match(renter, /const clean=original\.replace/);
  assert.match(voice, /prefs=\{\.\.\.state\.prefs\}/);
  assert.match(voice, /const intent=extractIntent\(raw\),location=intent\.location\|\|state\.city/);
});

test('map assistant starts with a greeting and an empty search field', () => {
  assert.match(voice, /नमस्ते! मैं GDRS/);
  assert.match(voice, /placeholder="बोलें या यहाँ अपनी property search लिखें…"/);
  assert.doesNotMatch(voice, /value="बड़े नगर में 2 BHK/);
});


test('renter map offers free satellite and hybrid layers and uses a full radius bounds search for GPS', () => {
  assert.match(map, /ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile/);
  assert.match(map, /Reference\/World_Boundaries_and_Places\/MapServer\/tile/);
  assert.match(map, /"Satellite \+ labels"/);
  assert.match(map, /searchUsesRadius/);
  assert.match(map, /radiusBounds\(state\.searchCenter\)/);
  assert.match(map, /searchRenterArea\(undefined,true\)/);
  assert.match(map, /Location permission is blocked/);
});

test('map voice assistant styles keep the headline and microphone readable on dark green', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-voice.css'), 'utf8');
  assert.match(css, /#gdrMapVoiceAssistant \.gdr-map-voice-head h3\{color:#fff!important/);
  assert.match(css, /#gdrMapVoiceAssistant \.gdr-map-voice-mic\{background:linear-gradient/);
  assert.match(css, /leaflet-control-layers/);
});


test('all-properties voice requests clear stale BHK, budget, furnishing and home-type filters', () => {
  assert.match(voice, /const allListings=/);
  assert.match(voice, /if\(allListings\)\{\["bhk","minBudget","maxBudget","furnishing","stayType","propertyType"\]\.forEach\(key=>delete prefs\[key\]\);\}/);
  assert.match(voice, /mapSummary=api\.showVoiceSearchResults\(rows,point,location\)/);
  assert.match(voice, /mapSummary\.unmapped/);
});


test('voice inventory stays cached and renter map automatically filters markers to the current viewport on zoom or pan', () => {
  assert.ok(map.includes('browseInventory:null, browseCenter:null, browseTimer:null'));
  assert.ok(map.includes('function filterBrowseInventoryToBounds(rows,bounds,center,prefs)'));
  assert.ok(map.includes('bounds.contains(point)'));
  assert.ok(map.includes('function renderBrowseViewport()'));
  assert.ok(map.includes('renderMarkers(rows,origin,false,true,listRows)'));
  assert.ok(map.includes('state.browseTimer=setTimeout(()=>{state.browseTimer=null;renderBrowseViewport();},120)'));
  assert.ok(map.includes('state.browseInventory=items.slice()'));
  assert.ok(map.includes('invalidateSize({pan:false})'));
  assert.ok(map.includes('Showing "+rows.length+" of "+total+" mapped homes in the current map view'));
});


test('viewport browsing shows Bhopal homes after zooming in without applying the 5 km search radius', () => {
  const start = map.indexOf('function filterBrowseInventoryToBounds(rows,bounds,center,prefs){');
  const end = map.indexOf('function renderBrowseViewport()', start);
  assert.ok(start >= 0 && end > start, 'viewport filter helper must exist');
  const vm = require('node:vm');
  const filter = vm.runInNewContext(
    'const validPoint=(lat,lng)=>Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Number(lat)>=-90&&Number(lat)<=90&&Number(lng)>=-180&&Number(lng)<=180;'+
    'const distanceKm=(a,b)=>Math.hypot((a[0]-b[0])*111,(a[1]-b[1])*102);'+
    map.slice(start,end)+';filterBrowseInventoryToBounds'
  );
  const inventory = [
    {id:'bhopal-1',latitude:23.25,longitude:77.40,rent:7000,status:'verified',verification_status:'verified',owner_verified:true,listing_type:'home'},
    {id:'bhopal-2',latitude:23.30,longitude:77.45,rent:9000,status:'verified',verification_status:'verified',owner_verified:true,listing_type:'home'},
    {id:'singrauli-1',latitude:24.20,longitude:82.60,rent:8000,status:'verified',verification_status:'verified',owner_verified:true,listing_type:'home'}
  ];
  const bhopalBounds = {contains: point => point[0] >= 23.1 && point[0] <= 23.4 && point[1] >= 77.2 && point[1] <= 77.6};
  const rows = filter(inventory,bhopalBounds,[23.25,77.40],{});
  assert.deepEqual(Array.from(rows, row => row.id), ['bhopal-1','bhopal-2']);
  assert.ok(rows.some(row => row.gdrDistanceKm >= 0));
});

test('viewport browsing retains the full inventory and preserves the selected location pin', () => {
  assert.ok(map.includes("state.browseInventory=items.slice()"));
  assert.ok(map.includes("if(state.renterPin&&preservePin!==true)"));
  assert.ok(map.includes("state.browseInventory=null"));
});

test('voice result list keeps every property after map viewport refresh and sorts mappable homes by distance', () => {
  assert.ok(map.includes('browseCenter:null'));
  assert.ok(map.includes('function sortBrowseInventoryForList(rows,center)'));
  assert.ok(map.includes('renderMarkers(rows,origin,false,true,listRows)'));
  assert.ok(map.includes('Distance unavailable'));
  const vm = require('node:vm');
  const start = map.indexOf('function sortBrowseInventoryForList(rows,center){');
  const end = map.indexOf('function renderBrowseViewport()', start);
  assert.ok(start >= 0 && end > start, 'full-inventory list sorter must exist');
  const sorter = vm.runInNewContext(
    'const asNumber=v=>v===null||v===undefined||String(v).trim()===""?null:(Number.isFinite(Number(v))?Number(v):null);' +
    'const validPoint=(lat,lng)=>asNumber(lat)!==null&&asNumber(lng)!==null&&asNumber(lat)>=-90&&asNumber(lat)<=90&&asNumber(lng)>=-180&&asNumber(lng)<=180;' +
    'const distanceKm=(a,b)=>{const rad=n=>n*Math.PI/180,dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]);const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};' +
    map.slice(start,end) + ';sortBrowseInventoryForList'
  );
  const rows = [
    {id:'far',latitude:24.09,longitude:82.6247},
    {id:'near',latitude:24.073,longitude:82.6247},
    {id:'middle',latitude:24.08,longitude:82.6247},
    {id:'no-pin'}
  ];
  const sorted = sorter(rows,[24.0725,82.6247]);
  assert.deepEqual(Array.from(sorted,row=>row.id),['near','middle','far','no-pin']);
  assert.equal(sorted[3].gdrDistanceKm,null);
});



test('map cluster marker always displays the exact number of nearby listings', () => {
  const start = map.indexOf('function makeLayer(map){');
  const end = map.indexOf('async function fetchInventory()', start);
  assert.ok(start >= 0 && end > start, 'renter marker cluster setup exists');
  const layer = map.slice(start, end);
  assert.match(layer, /zoomToBoundsOnClick:true/);
  assert.match(layer, /spiderfyOnMaxZoom:true/);
  assert.match(layer, /maxClusterRadius:function\(zoom\)/);
  assert.match(layer, /if\(zoom>=16\)return 0/);
  assert.match(layer, /cluster\.getChildCount\(\)/);
  assert.match(layer, /gdr-home-3d-cluster-count/);
  assert.match(layer, /count\+" rental homes in this area"/);
});

test('cluster count badge is visible and legible on the GharDekho house marker', () => {
  assert.match(mapCss, /\.gdr-home-3d-cluster-count\s*\{[\s\S]*background:#123d35[\s\S]*color:#fff/);
  assert.match(mapCss, /\.gdr-home-3d-cluster-count\s*\{[\s\S]*position:absolute[\s\S]*z-index:5/);
});

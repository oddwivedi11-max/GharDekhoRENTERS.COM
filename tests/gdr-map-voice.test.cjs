const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const voice = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-voice.js'), 'utf8');
const map = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-experience.js'), 'utf8');
const renter = fs.readFileSync(path.join(__dirname, '../assets/gdr-renter-experience.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-voice.css'), 'utf8');

test('voice assistant loads inside the existing renter Explore Map', () => {
  assert.match(map, /ensureMapVoiceAssistant/);
  assert.match(map, /GDRMapVoiceAssistant\.mount\(panel\)/);
  assert.match(voice, /GDRRenterExperience/);
  assert.match(voice, /assistant\.searchAssistantListings\(\{\.\.\.state\.prefs,location\},raw,target\)/);
  assert.match(voice, /gdrMapVoiceResults/);
});

test('voice recognition has automatic silence finalization and typed fallback', () => {
  assert.match(voice, /window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(voice, /setTimeout\(finishTurn,1800\)/);
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
});

test('common rental filters are delegated to the shared deterministic intent parser', () => {
  assert.match(voice, /assistant\.parseRequest\(raw\)/);
  assert.match(voice, /minBudget/);
  assert.match(voice, /maxBudget/);
  assert.match(voice, /bhk/);
  assert.match(renter, /p\.furnishing="Furnished"/);
  assert.match(renter, /p\.stayType="pg"/);
});


test('voice searches the complete public inventory and renders matching home cards under the microphone', () => {
  assert.match(voice, /assistant\.searchAssistantListings\(\{\.\.\.state\.prefs,location\},raw,target\)/);
  assert.match(voice, /gdrMapVoiceResults/);
  assert.doesNotMatch(voice, /api\.searchTypedMapLocation\(\)/);
  assert.match(voice, /api\.showVoiceSearchResults\(rows,point,location\)/);
  assert.match(renter, /client\.rpc\("get_public_properties"\)/);
  assert.match(renter, /searchAssistantListings\(prefs,raw,target\)/);
  assert.match(map, /get_available_map_properties_in_bounds/);
  assert.match(map, /function showVoiceSearchResults\(rows,point,label\)/);
  assert.match(map, /renderMarkers\(items,center,false\)/);
  assert.match(map, /if\(!p\|\|!validPoint\(p\.latitude,p\.longitude\)\)return/);
});
test('map voice places its assistant directly below the map heading and uses an SVG microphone', () => {
  assert.match(voice, /\.gdr-map-head, \.gdr-map-header/);
  assert.match(voice, /gdr-map-voice-mic-icon/);
  assert.match(voice, /<svg viewBox="0 0 24 24"/);
});
test('speech finalization prefers final speech and does not append interim text twice', () => {
  assert.match(voice, /const final=String\(state\.finalText\|\|""\)\.trim\(\)\|\|String\(state\.interimText\|\|""\)\.trim\(\)/);
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

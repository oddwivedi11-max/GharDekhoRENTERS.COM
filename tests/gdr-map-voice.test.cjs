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
  assert.match(voice, /searchAssistantListings\(filters,raw,target\)/);
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
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 104px/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /\.gdr-map-voice-mic\.is-listening/);
  assert.match(voice, /aria-pressed/);
});

test('common rental filters are parsed deterministically', () => {
  assert.match(voice, /maxBudget/);
  assert.match(voice, /p\.bhk/);
  assert.match(voice, /p\.furnishing="Furnished"/);
  assert.match(voice, /p\.stayType="pg"/);
});


test('voice requests use the database-backed assistant and do not use a map-radius-only search', () => {
  assert.match(voice, /assistant\.searchAssistantListings\(filters,raw,target\)/);
  assert.doesNotMatch(voice, /api\.searchAtCoordinates/);
  assert.doesNotMatch(voice, /api\.filterVisibleByLocation/);
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

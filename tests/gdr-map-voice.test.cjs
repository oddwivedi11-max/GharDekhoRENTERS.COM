const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const voice = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-voice.js'), 'utf8');
const map = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-experience.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../assets/gdr-map-voice.css'), 'utf8');

test.describe('GDR renter map voice assistant', () => {
  test('loads only inside the existing Explore Map and uses the existing map search API', () => {
    expect(map).toContain('ensureMapVoiceAssistant');
    expect(map).toContain('window.GDRMapVoiceAssistant.mount(panel)');
    expect(voice).toContain('window.GDRMapExperience');
    expect(voice).toContain('resolveMapQuery');
    expect(voice).toContain('searchAtCoordinates');
    expect(voice).toContain('filterVisibleByLocation');
  });
  test('supports browser-native speech, silence finalization and typed fallback', () => {
    expect(voice).toContain('window.SpeechRecognition||window.webkitSpeechRecognition');
    expect(voice).toContain('setTimeout(finishTurn,1800)');
    expect(voice).toContain('gdrMapVoiceSearch');
    expect(voice).toContain('SpeechSynthesisUtterance');
    expect(voice).toContain('hi-IN');
    expect(voice).toContain('en-IN');
  });
  test('keeps microphone controls responsive and prevents overlapping UI', () => {
    expect(css).toContain('grid-template-columns:minmax(0,1fr) 104px');
    expect(css).toContain('@media(max-width:620px)');
    expect(css).toContain('.gdr-map-voice-mic.is-listening');
    expect(voice).toContain('aria-pressed');
  });
  test('filters common rent, BHK and furnishing commands deterministically', () => {
    expect(voice).toContain('maxBudget');
    expect(voice).toContain('p.bhk');
    expect(voice).toContain('p.furnishing="Furnished"');
    expect(voice).toContain('p.stayType="pg"');
  });
});
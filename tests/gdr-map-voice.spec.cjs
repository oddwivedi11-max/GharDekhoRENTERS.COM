const { test, expect } = require('@playwright/test');

async function openMapWithMockLeaflet(page) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => {
    const dashboardShell = document.getElementById('dashboardSection');
    if (dashboardShell) { dashboardShell.hidden = false; dashboardShell.style.display = 'block'; dashboardShell.setAttribute('aria-hidden', 'false'); }
    const dashboard = document.getElementById('renterDashboard');
    if (dashboard) { dashboard.hidden = false; dashboard.style.display = 'block'; }
    const center = { lat: 23.2599, lng: 77.4126 };
    const makeMap = element => {
      element.classList.add('leaflet-container');
      return {
        setView() { return this; },
        on() { return this; },
        invalidateSize() {},
        getCenter() { return center; },
        getBounds() {
          return {
            getSouthWest: () => ({ lat: 23.1, lng: 77.2 }),
            getNorthEast: () => ({ lat: 23.4, lng: 77.6 }),
            contains: point => point[0] < 23.4
          };
        },
        flyTo() { return this; },
        removeLayer() {}
      };
    };
    window.L = {
      map: element => makeMap(element),
      tileLayer: () => ({ addTo() { return this; } }),
      control: { zoom: () => ({ addTo() { return this; } }), layers: () => ({ addTo() { return this; } }) },
      layerGroup: () => ({ addTo() { return this; } }),
      markerClusterGroup: () => ({ addTo() { return this; }, clearLayers() {}, addLayer() {} }),
      divIcon: () => ({}),
      marker: () => ({ on() { return this; }, addTo() { return this; }, getLatLng: () => center }),
      circle: () => ({ addTo() { return this; } })
    };
    document.getElementById('renterExploreMapBtn').click();
  });
  await expect(page.locator('#gdrMapVoiceAssistant')).toHaveCount(1, { timeout: 15000 });
  await page.evaluate(() => {
    const shell = document.getElementById('dashboardSection');
    const dashboard = document.getElementById('renterDashboard');
    const panel = document.getElementById('gdrExploreMapPanel');
    if (shell) { shell.hidden = false; shell.style.setProperty('display', 'block', 'important'); shell.style.setProperty('visibility', 'visible', 'important'); shell.setAttribute('aria-hidden', 'false'); }
    if (dashboard) { dashboard.hidden = false; dashboard.style.setProperty('display', 'block', 'important'); dashboard.style.setProperty('visibility', 'visible', 'important'); }
    if (panel) { panel.hidden = false; panel.style.setProperty('display', 'block', 'important'); panel.style.setProperty('visibility', 'visible', 'important'); }
  });
  await expect(page.locator('#gdrMapVoiceAssistant')).toBeVisible({ timeout: 5000 });
}

test.describe('GDR renter map voice UI', () => {
  test('injects the microphone and language controls into the existing Explore Map', async ({ page }) => {
    await openMapWithMockLeaflet(page);
    await expect(page.locator('#gdrMapVoiceMic')).toBeVisible();
    await expect(page.locator('#gdrMapVoiceLanguage')).toBeVisible();
    await expect(page.locator('#gdrMapVoiceTranscript')).toBeVisible();
    await expect(page.locator('#gdrMapVoiceSearch')).toBeVisible();
  });

  test('microphone enters listening state after an explicit click', async ({ page }) => {
    await openMapWithMockLeaflet(page);
    await page.evaluate(() => {
      window.SpeechRecognition = class {
        start() { if (this.onstart) this.onstart(); }
        stop() { if (this.onend) this.onend(); }
      };
    });
    await page.locator('#gdrMapVoiceMic').click();
    await expect(page.locator('#gdrMapVoiceMic')).toHaveClass(/is-listening/);
    await expect(page.locator('#gdrMapVoiceStatus')).toHaveAttribute('data-state', 'listening');
  });



  test('full-inventory voice results synchronize with map markers and the map list', async ({ page }) => {
    await openMapWithMockLeaflet(page);
    await page.evaluate(() => {
      const api = window.GDRMapExperience;
      api.resolveMapQuery = async location => ({
        lat: 24.0725, lng: 82.6247, label: location,
        properties: { type: 'city', city: 'Singrauli' }
      });
      window.GDRRenterExperience.searchAssistantListings = async (prefs, raw, target) => {
        const properties = Array.from({length:6},(_,index)=>({
          id:'voice-property-'+(index+1),
          title:'Singrauli test home '+(index+1),
          rent:7000+index*500,
          location:'Singrauli',address:'Singrauli, Madhya Pradesh',
          bhk:2,furnishing:'Unfurnished',listing_type:'home',
          latitude:index===5?null:24.073+index*.007,
          longitude:index===5?null:82.625,
          status:'verified',verification_status:'verified',owner_verified:true
        }));
        window.renderVoicePropertyResults(properties);
        target.replaceChildren();
        const summary = document.createElement('p');
        summary.textContent = '6 matching properties displayed in Available Rental Properties below.';
        target.append(summary);
        window.__voiceSearchPrefs = prefs;
        return properties;
      };
      document.getElementById('gdrMapVoiceTranscript').value = 'Mujhe Singrauli mein 2 BHK ghar dikhao';
    });
    await page.locator('#gdrMapVoiceSearch').click();
    await expect(page.locator('#propertiesContainer')).toContainText('Singrauli test home');
    await expect(page.locator('#gdrMapVoiceResults')).toContainText('Available Rental Properties below');
    await expect(page.locator('#gdrMapVoiceResults')).not.toContainText('Singrauli test home');
    await expect(page.locator('#gdrMapListPanel .gdr-map-list-card')).toHaveCount(6);
    await expect(page.locator('#gdrMapCount')).toContainText('5 map pins · 6 results');
    const beforeViewport = await page.evaluate(() => ({
      prefs: window.__voiceSearchPrefs,
      visible: window.GDRMapExperience.getRenterVisibleProperties().map(property => property.id)
    }));
    expect(beforeViewport.prefs.bhk).toBe('2');
    expect(beforeViewport.visible).toEqual(['voice-property-1','voice-property-2','voice-property-3','voice-property-4','voice-property-5','voice-property-6']);
    await page.evaluate(() => window.GDRMapExperience.renderBrowseViewport());
    await expect(page.locator('#gdrMapCount')).toContainText('0 visible map pins · 6 list results');
    await expect(page.locator('#gdrMapListPanel .gdr-map-list-card')).toHaveCount(6);
    const listed = await page.locator('#gdrMapListPanel .gdr-map-list-title').allTextContents();
    expect(listed).toEqual([
      '1. Singrauli test home 1','2. Singrauli test home 2','3. Singrauli test home 3',
      '4. Singrauli test home 4','5. Singrauli test home 5','6. Singrauli test home 6'
    ]);
    await page.locator('#gdrMapListToggle').click();
    await expect(page.locator('#gdrMapLayout')).toHaveClass(/gdr-list-mode/);
    await expect(page.locator('#gdrMapListPanel')).toBeVisible();
  });

  test('renter assistant automatically loads the next property page on mobile scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect.poll(() => page.evaluate(() => !!window.GDRRenterExperience?.searchAssistantListings)).toBe(true);
    await page.evaluate(() => {
      const section = document.getElementById('propertiesSection');
      const container = document.getElementById('propertiesContainer');
      if (!container) throw new Error('Available Rental Properties container is missing.');
      if (section) {
        section.hidden = false;
        section.style.setProperty('display', 'block', 'important');
        section.style.setProperty('visibility', 'visible', 'important');
      }
      window.__assistantCalls = [];
      window.__assistantResultIds = [];
      window.renderVoicePropertyResults = rows => {
        window.__assistantResultIds = rows.map(row => String(row.id));
        container.replaceChildren(...rows.map(row => {
          const card = document.createElement('article');
          card.className = 'gdr-infinite-scroll-test-card';
          card.style.height = '90px';
          card.textContent = row.title;
          return card;
        }));
      };
      window.__gdrSupabaseClient = {
        rpc: (name, args) => {
          const offset = Number(args.p_offset || 0);
          const limit = Number(args.p_limit || 100);
          window.__assistantCalls.push({ name, offset, limit });
          const results = Array.from({ length: Math.max(0, Math.min(limit, 200 - offset)) }, (_, index) => {
            const n = offset + index;
            return {
              id: 'scroll-property-' + n,
              title: 'Singrauli test property ' + n,
              location: 'Singrauli, Madhya Pradesh',
              rent: 7000,
              status: 'verified',
              verification_status: 'verified',
              owner_verified: true,
              listing_type: 'home',
              latitude: 24.073,
              longitude: 82.625,
              bhk: 2,
              furnishing: 'Unfurnished',
              photo_urls: []
            };
          });
          return Promise.resolve({ data: { results, total_count: 200 }, error: null });
        }
      };
      const target = document.createElement('div');
      target.id = 'gdrInfiniteScrollTarget';
      document.body.append(target);
      window.__assistantTarget = target;
    });
    await page.evaluate(async () => {
      await window.GDRRenterExperience.searchAssistantListings(
        { location: 'Singrauli' },
        'Singrauli',
        window.__assistantTarget
      );
    });
    await expect.poll(() => page.locator('.gdr-infinite-scroll-test-card').count()).toBe(100);
    await page.locator('.gdrx-assistant-pagination-sentinel').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__assistantCalls?.length === 2, undefined, { timeout: 15000 });
    await expect.poll(() => page.locator('.gdr-infinite-scroll-test-card').count()).toBe(200);
    const evidence = await page.evaluate(() => ({
      offsets: window.__assistantCalls.map(call => call.offset),
      ids: window.__assistantResultIds
    }));
    expect(evidence.offsets).toEqual([0, 100]);
    expect(new Set(evidence.ids).size).toBe(200);
    await expect(page.locator('.gdrx-assistant-pagination-sentinel')).toHaveCount(0);
  });

  test('Back to Dashboard closes map mode and restores focus to Explore Map', async ({ page }) => {
    await openMapWithMockLeaflet(page);
    await expect(page.locator('#renterDashboard')).toHaveClass(/gdr-map-mode/);
    await page.locator('#gdrMapBackBtn').click();
    expect(await page.locator('#gdrExploreMapPanel').evaluate(panel => panel.hidden)).toBe(true);
    await expect(page.locator('#renterDashboard')).not.toHaveClass(/gdr-map-mode/);
    await expect(page.locator('#renterExploreMapBtn')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#renterExploreMapBtn')).toBeFocused();
  });

  test('microphone and transcript remain in separate columns on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMapWithMockLeaflet(page);
    const boxes = await Promise.all([
      page.locator('#gdrMapVoiceTranscript').boundingBox(),
      page.locator('#gdrMapVoiceMic').boundingBox()
    ]);
    expect(boxes[0]).not.toBeNull();
    expect(boxes[1]).not.toBeNull();
    expect(boxes[1].x).toBeGreaterThanOrEqual(boxes[0].x + boxes[0].width - 1);
    expect(boxes[1].y).toBeLessThan(boxes[0].y + boxes[0].height);
  });
});

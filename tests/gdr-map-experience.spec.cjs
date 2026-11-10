const { test, expect } = require('@playwright/test');

async function exposeAuthenticatedRenterDashboard(page) {
  await page.evaluate(() => {
    const shell = document.getElementById('dashboardSection');
    if (shell) { shell.hidden = false; shell.style.display = 'block'; shell.setAttribute('aria-hidden', 'false'); }
    const renter = document.getElementById('renterDashboard');
    if (renter) { renter.hidden = false; renter.style.display = 'block'; }
  });
}

test.describe('GDR map-first experience structure', () => {
  test('renter map entry and map controls are present exactly once', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (const selector of [
      '#renterExploreMapBtn', '#gdrExploreMapPanel', '#gdrExploreMapCanvas',
      '#gdrMapPlaceSearch', '#gdrMapRadius', '#gdrMapSearchAreaBtn',
      '#gdrMapListToggle', '#gdrMapViewToggle', '#gdrMapPreview'
    ]) {
      await expect(page.locator(selector)).toHaveCount(1);
    }
  });

  test('owner property form exposes a map pin picker without replacing address entry', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.locator('#propertyLocation')).toHaveCount(1);
    await expect(page.locator('#gdrOpenOwnerMapPickerBtn')).toHaveCount(1);
    await expect(page.locator('#gdrOwnerMapPicker')).toHaveCount(1);
    await expect(page.locator('#gdrOwnerMapCanvas')).toHaveCount(1);
    await expect(page.locator('#gdrConfirmOwnerMapLocation')).toHaveCount(1);
  });

  test('map/list control switches list state without changing Nearby controls', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const listState = await page.evaluate(() => {
      document.getElementById('gdrExploreMapPanel').hidden = false;
      document.getElementById('gdrMapListToggle').click();
      return {
        listMode: document.getElementById('gdrMapLayout').classList.contains('gdr-list-mode'),
        listHidden: document.getElementById('gdrMapListPanel').hidden,
        mapDisplay: getComputedStyle(document.getElementById('gdrExploreMapCanvas')).display,
        listDisplay: getComputedStyle(document.getElementById('gdrMapListPanel')).display
      };
    });
    expect(listState.listMode).toBe(true);
    expect(listState.listHidden).toBe(false);
    expect(listState.mapDisplay).toBe('none');
    expect(listState.listDisplay).toBe('grid');

    const mapState = await page.evaluate(() => {
      document.getElementById('gdrMapViewToggle').click();
      return {
        listMode: document.getElementById('gdrMapLayout').classList.contains('gdr-list-mode'),
        listHidden: document.getElementById('gdrMapListPanel').hidden
      };
    });
    expect(mapState.listMode).toBe(false);
    expect(mapState.listHidden).toBe(true);
  });

  test('renter map initializes without guessing a location or requesting GPS', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await exposeAuthenticatedRenterDashboard(page);
    await page.evaluate(() => {
      const center = { lat: 23.2599, lng: 77.4126 };
      const makeMap = element => {
        element.classList.add('leaflet-container');
        return {
          setView() { return this; }, on() { return this; }, invalidateSize() {},
          getCenter() { return center; },
          getBounds() { return { getSouthWest: () => ({ lat: 23.1, lng: 77.2 }), getNorthEast: () => ({ lat: 23.4, lng: 77.6 }), contains: () => true }; },
          flyTo() { return this; }, removeLayer() {}
        };
      };
      window.L = {
        map: makeMap, tileLayer: () => ({ addTo() { return this; } }),
        control: { zoom: () => ({ addTo() { return this; } }), layers: () => ({ addTo() { return this; } }) },
        layerGroup: () => ({ addTo() { return this; } }),
        markerClusterGroup: () => ({ addTo() { return this; }, clearLayers() {}, addLayer() {} }),
        divIcon: () => ({}), marker: () => ({ on() { return this; }, addTo() { return this; }, getLatLng: () => center }),
        circle: () => ({ addTo() { return this; } })
      };
      window.__gdrRpcCalls = [];
      window.__gdrSupabaseClient = { rpc: async name => { window.__gdrRpcCalls.push(name); return { data: [], error: null }; } };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: () => { throw new Error('GPS must not be requested automatically'); } } });
      document.getElementById('renterExploreMapBtn').click();
    });
    await expect(page.locator('#gdrExploreMapCanvas')).toHaveClass(/leaflet-container/);
    await expect(page.locator('#gdrMapStatus')).toContainText('Tap anywhere on the map to place your starting location');
    expect(await page.evaluate(() => window.__gdrRpcCalls)).toEqual([]);
  });

  test('owner map pin confirms coordinates through the existing property form setter', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(() => {
      const center = { lat: 23.2599, lng: 77.4126 };
      const mapHandlers = {};
      window.__gdrOwnerMapHandlers = mapHandlers;
      window.L = {
        map: element => ({
          setView() { return this; },
          on(name, callback) { mapHandlers[name] = callback; return this; },
          invalidateSize() {},
          getCenter() { return center; },
          flyTo() { return this; },
          removeLayer() {}
        }),
        tileLayer: () => ({ addTo() { return this; } }),
        control: { zoom: () => ({ addTo() { return this; } }), layers: () => ({ addTo() { return this; } }) },
        layerGroup: () => ({ addTo() { return this; } }),
        markerClusterGroup: () => ({ addTo() { return this; }, clearLayers() {}, addLayer() {} }),
        marker: () => ({ on() { return this; }, addTo() { return this; }, getLatLng: () => center }),
        divIcon: () => ({}),
        circle: () => ({ addTo() { return this; } })
      };
      document.getElementById('propertyLocation').value = 'MP Nagar, Bhopal';
      document.getElementById('gdrOpenOwnerMapPickerBtn').click();
    });
    await expect.poll(() => page.locator('#gdrOwnerMapPicker').evaluate(element => element.hidden)).toBe(false);
    await page.evaluate(() => {
      window.__gdrOwnerMapHandlers.click({ latlng: { lat: 23.2599, lng: 77.4126 } });
      document.getElementById('gdrConfirmOwnerMapLocation').click();
    });
    const saved = await page.locator('#propertyLocation').evaluate(element => ({
      value: element.value,
      latitude: element.dataset.gdSelectedLat,
      longitude: element.dataset.gdSelectedLng,
      pickerHidden: document.getElementById('gdrOwnerMapPicker').hidden
    }));
    expect(saved.value).toBe('MP Nagar, Bhopal');
    expect(saved.latitude).toBe('23.2599');
    expect(saved.longitude).toBe('77.4126');
    expect(saved.pickerHidden).toBe(true);
  });

  test('map entry does not remove existing Nearby controls', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.locator('#renterDashboard')).toHaveCount(1);
    await expect(page.locator('#renterLiveNearbyBtn')).toHaveCount(1);
    await expect(page.locator('#liveNearbyBtn')).toHaveCount(1);
    await expect(page.locator('#renterExploreMapBtn')).toHaveAttribute('type', 'button');
  });

  test('Saved Properties stays hidden until its dashboard shortcut is clicked', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await exposeAuthenticatedRenterDashboard(page);
    const section = page.locator('#renterSavedPropertiesSection');
    await expect(section).toHaveCSS('display', 'none');
    await page.locator('#renterSavedPropertiesBtn').evaluate(button => button.click());
    await exposeAuthenticatedRenterDashboard(page);
    await expect(section).toBeVisible();
  });
});

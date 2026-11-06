const { test, expect } = require('@playwright/test');

async function openMapWithMockLeaflet(page) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => {
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
            contains: () => true
          };
        },
        flyTo() { return this; },
        removeLayer() {}
      };
    };
    window.L = {
      map: element => makeMap(element),
      tileLayer: () => ({ addTo() { return this; } }),
      control: { zoom: () => ({ addTo() { return this; } }) },
      markerClusterGroup: () => ({ addTo() { return this; }, clearLayers() {}, addLayer() {} }),
      divIcon: () => ({}),
      marker: () => ({ on() { return this; }, addTo() { return this; }, getLatLng: () => center }),
      circle: () => ({ addTo() { return this; } })
    };
    document.getElementById('renterExploreMapBtn').click();
  });
  await expect(page.locator('#gdrMapVoiceAssistant')).toBeVisible({ timeout: 15000 });
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
    await expect(page.locator('#gdrMapVoiceStatus')).toContainText('Listening');
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

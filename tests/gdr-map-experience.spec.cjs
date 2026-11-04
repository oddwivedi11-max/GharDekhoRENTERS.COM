const { test, expect } = require('@playwright/test');

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

  test('map entry does not remove existing Nearby controls', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.locator('#renterDashboard')).toHaveCount(1);
    await expect(page.locator('#renterLiveNearbyBtn')).toHaveCount(1);
    await expect(page.locator('#liveNearbyBtn')).toHaveCount(1);
    await expect(page.locator('#renterExploreMapBtn')).toHaveAttribute('type', 'button');
  });
});

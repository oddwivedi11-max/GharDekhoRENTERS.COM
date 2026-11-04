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

  test('map/list control switches the list panel without changing Nearby controls', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(() => {
      document.getElementById('dashboardSection').style.display = 'block';
      document.getElementById('renterDashboard').style.display = 'block';
      document.getElementById('gdrExploreMapPanel').hidden = false;
    });
    await page.locator('#gdrMapListToggle').click({ force: true });
    await expect(page.locator('#gdrMapLayout')).toHaveClass(/gdr-list-mode/);
    await expect(page.locator('#gdrMapListPanel')).toBeVisible();
    await page.locator('#gdrMapViewToggle').click({ force: true });
    await expect(page.locator('#gdrMapLayout')).not.toHaveClass(/gdr-list-mode/);
    await expect(page.locator('#gdrMapListPanel')).toBeHidden();
  });

  test('map entry does not remove existing Nearby controls', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.locator('#renterDashboard')).toHaveCount(1);
    await expect(page.locator('#renterLiveNearbyBtn')).toHaveCount(1);
    await expect(page.locator('#liveNearbyBtn')).toHaveCount(1);
    await expect(page.locator('#renterExploreMapBtn')).toHaveAttribute('type', 'button');
  });
});

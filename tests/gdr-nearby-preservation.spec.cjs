const { test, expect } = require('@playwright/test');

test.describe('GDR Nearby preservation and radius safety', () => {
  test('keeps Nearby separate from map-first Explore', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });

    const checks = await page.evaluate(() => {
      const source = Array.from(document.scripts)
        .map(script => script.textContent || '')
        .join('\\n');
      return {
        nearbyEntryPoint: source.includes('renterExploreNearbyBtn'),
        nearbySection: source.includes('renterNearbyPropertiesSection'),
        nearbyLoader: source.includes('async function loadRenterNearbyHomes'),
        nearbyRpc: source.includes('get_nearby_properties'),
        mapEntryPoint: Boolean(document.getElementById('renterExploreMapBtn')),
        mapPanel: Boolean(document.getElementById('gdrExploreMapPanel')),
        radiusControl: Boolean(document.getElementById('radiusSelect')),
        distanceBoundaryGuard: source.includes('distanceKm >= 0 && distanceKm <= radiusKm')
      };
    });

    expect(checks.nearbyEntryPoint).toBe(true);
    expect(checks.nearbySection).toBe(true);
    expect(checks.nearbyLoader).toBe(true);
    expect(checks.nearbyRpc).toBe(true);
    expect(checks.mapEntryPoint).toBe(true);
    expect(checks.mapPanel).toBe(true);
    expect(checks.radiusControl).toBe(true);
    expect(checks.distanceBoundaryGuard).toBe(true);
  });

  test('retains the existing Nearby radius options', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const values = await page.locator('#radiusSelect option').evaluateAll(options =>
      options.map(option => option.value)
    );
    expect(values).toEqual(['3', '5', '10', '15', '20']);
  });
});

const { test, expect } = require('@playwright/test');

async function readLoadedScripts(page) {
  return page.evaluate(async () => {
    const scripts = Array.from(document.scripts);
    const contents = await Promise.all(scripts.map(async script => {
      if (!script.src) return script.textContent || '';
      try {
        const response = await fetch(script.src, { cache: 'no-store' });
        return response.ok ? await response.text() : '';
      } catch (_) { return ''; }
    }));
    return contents.join('\n');
  });
}

test.describe('GDR Nearby preservation and radius safety', () => {
  test('keeps Nearby separate from map-first Explore and retains radius filtering', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const source = await readLoadedScripts(page);
    const checks = await page.evaluate(() => ({
      nearbyEntryPoint: Boolean(document.getElementById('renterExploreNearbyBtn')),
      nearbySection: Boolean(document.getElementById('renterNearbyPropertiesSection')),
      mapEntryPoint: Boolean(document.getElementById('renterExploreMapBtn')),
      mapPanel: Boolean(document.getElementById('gdrExploreMapPanel')),
      radiusControl: Boolean(document.getElementById('radiusSelect')),
    }));

    expect(checks.nearbyEntryPoint).toBe(true);
    expect(checks.nearbySection).toBe(true);
    expect(source).toContain('loadRenterNearbyHomes');
    expect(source).toContain('get_nearby_properties');
    expect(checks.mapEntryPoint).toBe(true);
    expect(checks.mapPanel).toBe(true);
    expect(checks.radiusControl).toBe(true);
    expect(source).toMatch(/distanceKm\\s*<=\\s*radiusKm/);
  });

  test('retains the existing Nearby radius options', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const values = await page.locator('#radiusSelect option').evaluateAll(options =>
      options.map(option => option.value)
    );
    expect(values).toEqual(['3', '5', '10', '15', '20']);
  });
});

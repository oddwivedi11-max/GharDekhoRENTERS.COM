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

test.describe('Renter Find Home premium search regression', () => {
  test('keeps all preference fields, Nearby entry point and smooth responsive layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45000 });

    const section = page.locator('#renterFindHomeSection');
    await expect(section).toHaveCount(1);
    await expect(page.locator('#renterSearchLocation')).toHaveAttribute('placeholder', /Search area, city or PIN code/i);
    await expect(page.locator('#renterMinBudgetPreset')).toHaveCount(1);
    await expect(page.locator('#renterMaxBudgetPreset')).toHaveCount(1);
    await expect(page.locator('#renterStayType')).toHaveCount(1);
    await expect(page.locator('#renterSearchBhk')).toHaveCount(1);
    await expect(page.locator('#renterSearchFurnishing')).toHaveCount(1);
    await expect(page.locator('#renterSearchStatus')).toHaveCount(1);

    const source = await readLoadedScripts(page);
    const checks = await page.evaluate(() => ({
      smoothStylePresent: Boolean(document.getElementById('gdr-find-home-smooth-v4')),
      nearbyFeaturePreserved: Boolean(document.getElementById('renterExploreNearbyBtn') || document.getElementById('renterNearbyPropertiesSection')),
      mobileWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    }));

    expect(checks.smoothStylePresent).toBe(true);
    expect(source).toContain('editDistanceAtMostOne');
    expect(source).toContain('pinDistrictMatch');
    expect(checks.nearbyFeaturePreserved).toBe(true);
    expect(checks.pageWidth).toBeLessThanOrEqual(checks.mobileWidth + 1);
  });
});

const { test, expect } = require('@playwright/test');

test.describe('Renter Find Home premium search regression', () => {
  test('keeps all preference fields and applies the smooth responsive layout', async ({ page }) => {
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

    const checks = await page.evaluate(() => {
      const style = document.getElementById('gdr-find-home-smooth-v4');
      const source = Array.from(document.scripts).map(script => script.textContent || '').join('\n');
      return {
        smoothStylePresent: Boolean(style),
        fuzzyLocationFallbackPresent: source.includes('editDistanceAtMostOne'),
        districtFallbackPresent: source.includes('pinDistrictMatch'),
        nearbyFeaturePreserved: source.includes('renterExploreNearbyBtn') && source.includes('loadRenterNearbyHomes'),
        mobileWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
      };
    });

    expect(checks.smoothStylePresent).toBe(true);
    expect(checks.fuzzyLocationFallbackPresent).toBe(true);
    expect(checks.districtFallbackPresent).toBe(true);
    expect(checks.nearbyFeaturePreserved).toBe(true);
    expect(checks.pageWidth).toBeLessThanOrEqual(checks.mobileWidth + 1);
  });
});

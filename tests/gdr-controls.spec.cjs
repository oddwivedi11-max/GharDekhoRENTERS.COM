const { test, expect } = require('@playwright/test');

test.describe('GDR core controls (read-only)', () => {
  test('core renter, owner and admin controls are present in the app document', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });

    const selectors = [
      '#searchBtn', '#nearMeBtn', '#liveNearbyBtn', '#loginBtn', '#loginSection',
      '#renterFindHomeForm', '#renterSearchLocation', '#renterFindHomeMessage',
      '#renterSavedPropertiesBtn', '#ownerDashboard', '#addPropertyForm',
      '#propertyPincode', '#addPropertyBtn', '#adminDashboard'
    ];
    for (const selector of selectors) {
      await expect(page.locator(selector).first(), 'Missing core control: ' + selector).toHaveCount(1);
    }
    expect(await page.title()).toMatch(/GharDekho Renters/i);
  });

  test('blank renter search returns validation feedback without navigation', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const form = page.locator('#renterFindHomeForm');
    await expect(form).toHaveCount(1);
    const beforeUrl = page.url();
    await form.evaluate(element => element.requestSubmit());
    await expect(page.locator('#renterFindHomeMessage')).toContainText(/enter the city|area|district/i);
    expect(page.url()).toBe(beforeUrl);
  });

  test('initial DOM has no duplicate concrete element IDs', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const duplicates = await page.evaluate(() => {
      const seen = new Set();
      const duplicate = new Set();
      for (const element of document.querySelectorAll('[id]')) {
        if (seen.has(element.id)) duplicate.add(element.id);
        seen.add(element.id);
      }
      return [...duplicate];
    });
    expect(duplicates, 'Duplicate IDs can break selectors: ' + duplicates.join(', ')).toEqual([]);
  });
});

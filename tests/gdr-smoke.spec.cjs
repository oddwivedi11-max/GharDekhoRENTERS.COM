const { test, expect } = require('@playwright/test');

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 900 },
];

test.describe('GharDekho public-page smoke checks (read-only)', () => {
  for (const viewport of viewports) {
    test(`home page renders without horizontal overflow at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));

      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await expect(page.locator('body')).toBeVisible();
      await expect(page).toHaveTitle(/.+/);

      // Allow layout scripts and read-only public inventory requests to settle.
      await page.waitForTimeout(2500);

      const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      }));

      expect(
        dimensions.documentWidth,
        `Horizontal overflow at ${viewport.name}: ${JSON.stringify(dimensions)}`
      ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

      // Report browser exceptions, but do not fail on third-party network/CDN errors.
      expect(pageErrors, `Uncaught browser exceptions: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  }

  test('public page can be opened without signing in', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.locator('body')).toBeVisible();

    // This test deliberately does not click visit, save, signup, owner, or admin actions.
    const visibleText = (await page.locator('body').innerText()).slice(0, 12000);
    expect(visibleText.length).toBeGreaterThan(0);
  });
});

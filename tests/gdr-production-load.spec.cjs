const { test, expect } = require('@playwright/test');

const productionTargets = [
  { name: 'custom-domain', url: 'https://ghardekhorenters.com/' },
  { name: 'cloudflare-worker', url: 'https://ghardekhorenters-com.od-dwivedi11.workers.dev/' },
];

for (const target of productionTargets) {
  test(`production page renders on ${target.name}`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];
    const badResponses = [];

    page.on('pageerror', error => pageErrors.push(error.stack || error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('requestfailed', request => failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || 'unknown',
    }));
    page.on('response', response => {
      if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() });
    });

    const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(7000);

    const pageState = await page.evaluate(() => ({
      title: document.title,
      readyState: document.readyState,
      bodyText: (document.body?.innerText || '').trim().slice(0, 2000),
      bodyTextLength: (document.body?.innerText || '').trim().length,
      bodyHtmlLength: document.body?.innerHTML?.length || 0,
      htmlLength: document.documentElement?.innerHTML?.length || 0,
      scriptCount: document.scripts.length,
      visibleElements: Array.from(document.body?.children || []).filter(el => {
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }).length,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
    }));

    await testInfo.attach(`${target.name}-diagnostics.json`, {
      body: Buffer.from(JSON.stringify({
        url: target.url, httpStatus: response?.status(), pageState,
        pageErrors, consoleErrors, failedRequests, badResponses,
      }, null, 2)),
      contentType: 'application/json',
    });

    expect(response, `No HTTP response from ${target.url}`).toBeTruthy();
    expect(response.status(), `HTTP response from ${target.url}`).toBeLessThan(400);
    expect(pageState.title, 'Production page title should exist').not.toBe('');
    expect(pageState.bodyTextLength, 'Production page should render visible text, not a blank white page').toBeGreaterThan(100);
    expect(pageErrors, `Uncaught JavaScript errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });
}

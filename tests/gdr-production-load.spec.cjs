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
      propertyStudioScript: Array.from(document.scripts).map(script => script.src).find(src => src.includes("gdr-property-studio.js")) || null,
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
    const studioScriptSource = String(pageState.propertyStudioScript || "");
    const studioVersion = studioScriptSource.match(/gdr-property-studio\.js\?v=([^&"']+)/)?.[1];
    expect(studioVersion, 'A versioned Property Studio launcher script must be included').toBeTruthy();
    const studioScriptUrl = new URL(studioScriptSource, target.url).toString();
    const studioScriptResponse = await page.request.get(studioScriptUrl, { timeout: 45000 });
    expect(studioScriptResponse.status(), 'Property Studio launcher script should load on production').toBe(200);
    const studioScript = await studioScriptResponse.text();
    expect(studioScript, 'The live script must register the Start Listing click handler').toContain('bindPropertyStudioLauncher();');
    expect(studioScript, 'The live click handler must open Property Studio').toContain('window.GDRPropertyStudio.open(trigger.id==="gdrListPropertySpeak")');
    expect(studioScript, 'The launcher source must match its cache version').toContain('const VERSION="' + studioVersion + '"');
    const markupUrl = new URL('/assets/gdr-property-studio.txt?v=' + encodeURIComponent(studioVersion), target.url).toString();
    const markupResponse = await page.request.get(markupUrl, { timeout: 45000 });
    expect(markupResponse.status(), 'Property Studio step markup must load').toBe(200);
    const markup = await markupResponse.text();
    // The branch is tested before it is deployed; require the corrected
    // fragment on production only after the deployment workflow runs on main.
    if (process.env.GITHUB_REF_NAME === 'main') {
      expect(studioVersion).toBe('20261112-owner-pin1');
      expect(markup, 'Final review step must be a valid section').toContain('<section class="gdr-studio-panel" data-gdr-studio-panel="4" hidden>');
      expect(markup, 'Raw panel attributes must not leak as standalone text').not.toMatch(/^\s*data-gdr-studio-panel="4" hidden>/m);
    }
    expect(pageErrors, `Uncaught JavaScript errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });
}

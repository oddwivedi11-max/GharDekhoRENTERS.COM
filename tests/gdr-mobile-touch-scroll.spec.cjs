const { test, expect } = require("@playwright/test");

test("mobile touch swipe scrolls the Property Studio overlay", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL || "http://127.0.0.1:4173", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForFunction(() =>
      Array.from(document.styleSheets).some(sheet =>
        sheet.href && sheet.href.includes("gdr-property-studio.css")
      ), { timeout: 15000 }
    );

    await page.evaluate(() => {
      let root = document.getElementById("gdrPropertyStudio");
      if (!root) {
        root = document.createElement("div");
        root.id = "gdrPropertyStudio";
        document.body.appendChild(root);
      }
      root.hidden = false;
      root.replaceChildren();
      const content = document.createElement("div");
      content.style.cssText = "min-height:2200px;padding:24px;background:linear-gradient(#fff,#eef5ea)";
      content.innerHTML = "<h2>Mobile scroll test</h2><p>Swipe vertically to move through the listing steps.</p>";
      root.appendChild(content);
      document.body.classList.add("gdr-property-studio-open");
      root.scrollTop = 0;
    });

    const metrics = await page.locator("#gdrPropertyStudio").evaluate(el => ({
      overflowY: getComputedStyle(el).overflowY,
      touchAction: getComputedStyle(el).touchAction,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      momentum: getComputedStyle(el).webkitOverflowScrolling,
    }));
    expect(metrics.overflowY).toBe("auto");
    expect(metrics.touchAction).toBe("auto");
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: 195, y: 730 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: 195, y: 210 }],
    });
    await page.waitForTimeout(120);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect.poll(
      () => page.locator("#gdrPropertyStudio").evaluate(el => el.scrollTop),
      { timeout: 4000, message: "A vertical mobile swipe should scroll the Property Studio panel." }
    ).toBeGreaterThan(80);
    await cdp.detach();
  } finally {
    await context.close();
  }
});

test("fixed owner and renter workspace overlays expose scrollable touch viewports", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() =>
    Array.from(document.styleSheets).some(sheet =>
      sheet.href && sheet.href.includes("gdr-property-studio.css")
    ), { timeout: 15000 }
  );
  const result = await page.evaluate(() => {
    const ids = [
      "gdrOwnerNearbyExperience",
      "gdrOwnerRenterPage",
      "gdrOwnerCurrentRentersPage",
    ];
    return ids.map(id => {
      const el = document.createElement("div");
      el.id = id;
      el.innerHTML = "<div style='height:1400px'></div>";
      document.body.appendChild(el);
      const style = getComputedStyle(el);
      const output = { id, overflowY: style.overflowY, touchAction: style.touchAction, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
      el.remove();
      return output;
    });
  });
  for (const item of result) {
    expect(item.overflowY, item.id).toBe("auto");
    expect(item.touchAction, item.id).toBe("auto");
    expect(item.scrollHeight, item.id).toBeGreaterThan(item.clientHeight);
  }
});

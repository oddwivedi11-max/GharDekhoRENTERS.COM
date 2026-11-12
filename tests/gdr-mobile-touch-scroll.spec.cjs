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

test("owner My Properties supports card-by-card horizontal touch swipes at phone widths", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL || "http://127.0.0.1:4173", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction(() => Array.from(document.styleSheets).some(sheet => sheet.href && sheet.href.includes("gdr-property-studio.css")), { timeout: 15000 });
    await page.evaluate(() => {
      const shell = document.getElementById("dashboardSection");
      if (shell) { shell.hidden = false; shell.style.display = "block"; }
      const dashboard = document.getElementById("ownerDashboard");
      dashboard.hidden = false;
      dashboard.classList.add("active", "gdr-owner-mode-properties");
      dashboard.classList.remove("gdr-owner-mode-home", "gdr-owner-mode-visits", "gdr-owner-mode-analytics", "gdr-owner-mode-notifications");
      dashboard.style.display = "block";
      const home = dashboard.querySelector("#gdrOwnerCommandCenterHome");
      if (home) home.hidden = true;
      const header = dashboard.querySelector("#gdrOwnerModuleHeader");
      if (header) header.hidden = false;
      let scroller = document.getElementById("ownerPropertiesContainer");
      if (!scroller) {
        scroller = document.createElement("div");
        scroller.id = "ownerPropertiesContainer";
        scroller.className = "owner-properties-grid";
        dashboard.appendChild(scroller);
      }
      scroller.className = "owner-properties-grid";
      scroller.replaceChildren();
      for (let i = 0; i < 4; i++) {
        const card = document.createElement("article");
        card.className = "owner-property-premium-card";
        card.innerHTML = "<div class='owner-property-photo'><span class='owner-property-photo-badge available'>Vacant</span></div><div class='owner-property-premium-body'><h4>QA property " + (i + 1) + "</h4><p>Mobile swipe regression card.</p><button type='button'>View</button></div>";
        scroller.appendChild(card);
      }
      scroller.scrollLeft = 0;
    });
    for (const width of [360, 390, 412]) {
      await page.setViewportSize({ width, height: 844 });
      const metrics = await page.locator("#ownerPropertiesContainer").evaluate(el => ({
        overflowX: getComputedStyle(el).overflowX,
        snap: getComputedStyle(el).scrollSnapType,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(metrics.overflowX).toBe("auto");
      expect(metrics.snap).toContain("x");
      expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const list = page.locator("#ownerPropertiesContainer");
    await list.scrollIntoViewIfNeeded();
    const listBox = await list.boundingBox();
    expect(listBox).toBeTruthy();
    const listY = Math.round(listBox.y + Math.min(42, listBox.height / 2));
    const listRight = Math.round(listBox.x + listBox.width - 18);
    const listLeft = Math.round(listBox.x + 18);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 7, x: listRight, y: listY }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 7, x: listLeft, y: listY }] });
    await page.waitForTimeout(100);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.locator("#ownerPropertiesContainer").evaluate(el => el.scrollLeft), { timeout: 4000 }).toBeGreaterThan(80);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 8, x: listLeft, y: listY }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 8, x: listRight, y: listY }] });
    await page.waitForTimeout(100);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.locator("#ownerPropertiesContainer").evaluate(el => el.scrollLeft), { timeout: 4000 }).toBeLessThan(80);
    await cdp.detach();
  } finally {
    await context.close();
  }
});

test("Add Listing exterior/interior photo previews support horizontal finger swipes on phones", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(baseURL || "http://127.0.0.1:4173", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction(() => Array.from(document.styleSheets).some(sheet => sheet.href && sheet.href.includes("gdr-property-studio.css")), { timeout: 15000 });
    await page.evaluate(() => {
      let root = document.getElementById("gdrPropertyStudio");
      if (!root) {
        root = document.createElement("div");
        root.id = "gdrPropertyStudio";
        document.body.appendChild(root);
      }
      root.hidden = false;
      root.style.display = "block";
      root.innerHTML = "<div id='gdrStudioPhotoPreview'><section class='gdr-studio-photo-group'><h3>Exterior photos · 4</h3><div class='gdr-studio-photo-grid'>" +
        Array.from({ length: 4 }, (_, i) => "<article class='gdr-studio-photo-card'><img alt='QA exterior " + (i + 1) + "' src='/assets/gdr-property-placeholder.svg'><div><span>QA exterior " + (i + 1) + "</span><button type='button'>Set as cover</button></div></article>").join("") +
        "</div></section></div>";
    });
    const grid = page.locator("#gdrStudioPhotoPreview .gdr-studio-photo-grid");
    const metrics = await grid.evaluate(el => ({
      overflowX: getComputedStyle(el).overflowX,
      snap: getComputedStyle(el).scrollSnapType,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(metrics.overflowX).toBe("auto");
    expect(metrics.snap).toContain("x");
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    const box = await grid.boundingBox();
    expect(box).toBeTruthy();
    const touchY = Math.round(box.y + Math.min(38, box.height / 2));
    const startX = Math.round(box.x + box.width - 18);
    const endX = Math.round(box.x + 18);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 9, x: startX, y: touchY }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 9, x: endX, y: touchY }] });
    await page.waitForTimeout(100);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => grid.evaluate(el => el.scrollLeft), { timeout: 4000 }).toBeGreaterThan(80);
    await cdp.detach();
  } finally {
    await context.close();
  }
});

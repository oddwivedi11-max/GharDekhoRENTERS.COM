const { test, expect } = require("@playwright/test");

test("owner command center keeps dashboard sections in separate modules", async ({ page }) => {
  await page.goto("/");
  const dashboard = page.locator("#ownerDashboard");
  await expect(dashboard).toHaveCount(1);
  await expect(page.locator("#gdrOwnerCommandCenterHome")).toHaveCount(1);
  await expect(page.locator("#gdrOwnerCommandCenterHome [data-gdr-module]")).toHaveCount(6);
  await expect(page.locator("#gdrOwnerCommandCenterHome [data-gdr-module=analytics]")).toContainText("Owner Analytics");
  await expect(page.locator("#gdrOwnerCommandCenterHome [data-gdr-module=notifications]")).toContainText("Notifications");
  await expect(page.locator("#gdrOwnerCommandCenterHome [data-gdr-module=nearby]")).toHaveCount(0);
  await expect(page.locator("#gdrOwnerNearbyCard")).toHaveCount(1);

  const mode = async value => dashboard.evaluate((el, v) => {
    el.classList.remove("gdr-owner-mode-home", "gdr-owner-mode-properties", "gdr-owner-mode-visits", "gdr-owner-mode-analytics", "gdr-owner-mode-notifications");
    el.classList.add("gdr-owner-mode-" + v);
    const home = el.querySelector("#gdrOwnerCommandCenterHome");
    const header = el.querySelector("#gdrOwnerModuleHeader");
    const insights = el.querySelector("#gdrOwnerInsightsPanel");
    if (home) home.hidden = v !== "home";
    if (header) header.hidden = v === "home";
    if (insights) insights.hidden = v !== "analytics" && v !== "notifications";
  }, value);

  await mode("home");
  expect(await page.locator("#ownerDashboard > .owner-profile-card").evaluate(el => getComputedStyle(el).display)).toBe("block");
  expect(await page.locator("#gdrOwnerNearbyCard").evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  await mode("properties");
  expect(await page.locator("#gdrOwnerNearbyCard").evaluate(el => getComputedStyle(el).display)).toBe("none");
  await expect(page.locator("#gdrOwnerCommandCenterHome")).toBeHidden();
  await expect(page.locator("#gdrOwnerCommandCenterHome [data-gdr-module=payments]")).toHaveCount(1);
  expect(await page.locator("#ownerDashboard > .owner-add-property-card").evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  expect(await page.locator("#ownerDashboard > .owner-inventory-card").evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  expect(await page.locator("#ownerDashboard > .owner-visits-card").evaluate(el => getComputedStyle(el).display)).toBe("none");
  await mode("visits");
  expect(await page.locator("#ownerDashboard > .owner-visits-card").evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  expect(await page.locator("#ownerDashboard > .owner-inventory-card").evaluate(el => getComputedStyle(el).display)).toBe("none");
  await mode("analytics");
  await expect(page.locator("#gdrOwnerInsightsPanel")).toBeVisible();
  expect(await page.locator("#ownerDashboard > .owner-visits-card").evaluate(el => getComputedStyle(el).display)).toBe("none");
  await mode("notifications");
  await expect(page.locator("#gdrOwnerInsightsPanel")).toBeVisible();
});

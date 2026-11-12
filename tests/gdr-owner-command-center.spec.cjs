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
  await expect(page.locator("#ownerDashboard .owner-profile-card .dashboard-card-heading #ownerEditProfileBtn")).toHaveCount(1);
  const nearbyEntry = page.locator("#ownerDashboard .gdr-owner-nearby-entry");
  await expect(nearbyEntry.locator("#gdrOwnerNearbyOpen")).toHaveCount(1);
  await expect(page.locator("#ownerDashboard .owner-profile-card #gdrOwnerNearbyOpen")).toHaveCount(0);
  await expect(page.locator("#gdrOwnerNearbyCard")).toHaveCount(0);
  await page.waitForFunction(() => {
    const link = document.getElementById("gdrOwnerCommandCenterStyle");
    if (!link || !link.sheet) return false;
    try {
      return Array.from(link.sheet.cssRules || []).some(rule =>
        rule.selectorText && rule.selectorText.includes("gdr-owner-mode-properties") &&
        rule.cssText.includes("display: block")
      );
    } catch (_) { return false; }
  }, null, { timeout: 15000 });

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
  await mode("properties");
  await expect(page.locator("#gdrOwnerNearbyCard")).toHaveCount(0);
  await expect(page.locator("#gdrOwnerCommandCenterHome")).toBeHidden();
  await expect(page.locator("#gdrOwnerCommandCenterHome [data-gdr-module=payments]")).toHaveCount(1);
  // The property editor is deliberately a modal and must stay closed until
  // the owner presses Start Listing; the properties workspace exposes the
  // listing hero and inventory instead of opening the editor automatically.
  expect(await page.locator("#ownerAddPropertyCard").evaluate(el => getComputedStyle(el).display)).toBe("none");
  await expect(page.locator("#gdrListPropertyStart")).toHaveCount(1);
  expect(await page.locator("#ownerDashboard > .owner-inventory-card").evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  expect(await page.locator("#ownerDashboard > .owner-visits-card").evaluate(el => getComputedStyle(el).display)).toBe("none");
  await mode("visits");
  expect(await page.locator("#ownerDashboard > .owner-visits-card").evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  expect(await page.locator("#ownerDashboard > .owner-inventory-card").evaluate(el => getComputedStyle(el).display)).toBe("none");
  await mode("analytics");
  expect(await page.locator("#gdrOwnerInsightsPanel").evaluate(el => el.hidden)).toBe(false);
  expect(await page.locator("#ownerDashboard > .owner-visits-card").evaluate(el => getComputedStyle(el).display)).toBe("none");
  await mode("notifications");
  expect(await page.locator("#gdrOwnerInsightsPanel").evaluate(el => el.hidden)).toBe(false);
});

test("Owner My Properties status filters show the correct status subset and counts",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>{
  const shell=document.getElementById("dashboardSection");
  if(shell){shell.hidden=false;shell.style.display="block";}
  const dash=document.getElementById("ownerDashboard");
  if(dash){
   dash.hidden=false;dash.classList.add("active","gdr-owner-mode-properties");dash.style.display="block";
   dash.classList.remove("gdr-owner-mode-home","gdr-owner-mode-visits","gdr-owner-mode-analytics","gdr-owner-mode-notifications");
   const home=dash.querySelector("#gdrOwnerCommandCenterHome");if(home)home.hidden=true;
   const header=dash.querySelector("#gdrOwnerModuleHeader");if(header)header.hidden=false;
  }
  const container=document.getElementById("ownerPropertiesContainer");
  if(!container)return;
  container.innerHTML=
   '<article id="qaAvailable" class="owner-property-premium-card"><div class="owner-property-photo"><span class="owner-property-photo-badge available">Vacant</span></div></article>'+
   '<article id="qaOccupied" class="owner-property-premium-card"><div class="owner-property-photo"><span class="owner-property-photo-badge occupied">Occupied</span></div></article>'+
   '<article id="qaPending" class="owner-property-premium-card"><div class="owner-property-photo"><span class="owner-property-photo-badge pending">Pending verification</span></div></article>';
 });
 const filters=page.locator("#ownerDashboard .gdr-owner-property-filters");
 await expect(filters).toHaveCount(1);
 await expect(filters.locator('[data-gdr-owner-property-filter="all"] [data-filter-count]')).toHaveText("3");
 await expect(filters.locator('[data-gdr-owner-property-filter="available"] [data-filter-count]')).toHaveText("1");
 await expect(filters.locator('[data-gdr-owner-property-filter="occupied"] [data-filter-count]')).toHaveText("1");
 await filters.locator('[data-gdr-owner-property-filter="available"]').click();
 await expect(page.locator("#qaAvailable")).toBeVisible();
 await expect(page.locator("#qaOccupied")).toBeHidden();
 await expect(page.locator("#qaPending")).toBeHidden();
 await expect(filters.locator('[data-gdr-owner-property-filter="available"]')).toHaveAttribute("aria-pressed","true");
 await filters.locator('[data-gdr-owner-property-filter="occupied"]').click();
 await expect(page.locator("#qaAvailable")).toBeHidden();
 await expect(page.locator("#qaOccupied")).toBeVisible();
 await filters.locator('[data-gdr-owner-property-filter="all"]').click();
 await expect(page.locator("#qaAvailable")).toBeVisible();
 await expect(page.locator("#qaOccupied")).toBeVisible();
 await expect(page.locator("#qaPending")).toBeVisible();
});

const { test, expect } = require("@playwright/test");

async function openStudio(page) {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => window.GDRPropertyStudio && typeof window.GDRPropertyStudio.open === "function");
  await page.evaluate(() => {
    const dashboard = document.getElementById("ownerDashboard");
    if (dashboard) {
      // The page may start with the portal shell hidden. Expose the entire
      // dashboard ancestor chain in this isolated browser fixture.
      for (let node = dashboard; node && node !== document.body; node = node.parentElement) {
        node.hidden = false;
        node.style.setProperty("display", "block", "important");
        node.style.setProperty("visibility", "visible", "important");
      }
      dashboard.classList.add("active");
    }
    window.__gdrSupabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: "gdr-property-identity-test-user" } }, error: null }) },
      from: table => ({
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: table === "owners" ? { id: "gdr-property-identity-test-owner", name: "QA Owner" } : null,
          error: null
        })
      })
    };
  });
  // This suite validates the identity/preview form, not the dashboard launcher's
  // click hit-area. Open the same public Studio API directly to avoid coupling
  // four data-preview tests to the dashboard's responsive visibility animation.
  const opened = await page.evaluate(async () => {
    const result = await window.GDRPropertyStudio.open(false);
    return {
      result,
      error: document.querySelector("#gdrStudioMessage")?.textContent
        || document.querySelector("#gdrListPropertyFeedback")?.textContent
        || ""
    };
  });
  expect(opened.result, "Property Studio did not open: " + opened.error).toBe(true);
  await expect(page.locator("#gdrPropertyStudio")).toBeVisible();
}

test.describe("GharDekho premium property identity", () => {
  test("home listing requires a custom name and previews home details live", async ({ page }) => {
    await openStudio(page);
    await page.locator('[data-gdr-property-category="home"]').click();
    await expect(page.locator("#gdrStudioHomeSubtypes")).toBeVisible();
    await page.locator('[data-gdr-property-type="apartment"]').click();
    await expect(page.locator("#gdrStudioIdentityWrap")).toBeVisible();
    await expect(page.locator("#gdrStudioIdentityTitle")).toHaveText("Name your home");
    await expect(page.locator("#gdrStudioNameExamples")).toContainText("The Green Villa");

    await page.locator("#gdrStudioPropertyName").fill("The Urban Nest");
    await page.locator("#gdrStudioLocation").fill("MP Nagar, Bhopal");
    await page.locator("#gdrStudioRent").fill("7500");
    await page.locator('[data-gdr-configuration="2 BHK"]').click();
    await page.locator("#gdrStudioFurnishing").selectOption("Furnished");

    const preview = page.locator("#gdrStudioIdentityPreview");
    await expect(preview).toContainText("The Urban Nest");
    await expect(preview).toContainText("Independent Home");
    await expect(preview).toContainText("MP Nagar, Bhopal");
    await expect(preview).toContainText("₹7,500");
    await expect(preview).toContainText("2 BHK");
    await expect(preview).toContainText("Furnished");
    await expect(page.locator("#gdrStudioNameCount")).toHaveText("14 / 50");
  });

  test("PG category switches naming guidance and previews room and bed information", async ({ page }) => {
    await openStudio(page);
    await page.locator('[data-gdr-property-category="pg"]').click();
    await expect(page.locator("#gdrStudioIdentityTitle")).toHaveText("Give your PG a memorable name");
    await expect(page.locator("#gdrStudioNameExamples")).toContainText("Urban Nest PG");
    await page.locator("#gdrStudioPropertyName").fill("Scholar's Stay");
    await page.locator("#gdrStudioRoomType").selectOption("Double");
    await page.locator("#gdrStudioTotalBeds").fill("10");
    await page.locator("#gdrStudioAvailableBeds").fill("4");
    await page.locator("#gdrStudioLocation").fill("MP Nagar, Bhopal");
    await page.locator("#gdrStudioRent").fill("7500");
    const preview = page.locator("#gdrStudioIdentityPreview");
    await expect(preview).toContainText("Scholar's Stay");
    await expect(preview).toContainText("PG Accommodation");
    await expect(preview).toContainText("Double");
    await expect(preview).toContainText("4 of 10 beds available");
  });

  test("hostel category uses hostel-specific identity and previews room and bed information", async ({ page }) => {
    await openStudio(page);
    await page.locator('[data-gdr-property-category="hostel"]').click();
    await expect(page.locator("#gdrStudioIdentityTitle")).toHaveText("Name your hostel");
    await expect(page.locator("#gdrStudioNameExamples")).toContainText("Campus Living Hostel");
    await page.locator("#gdrStudioPropertyName").fill("Sunrise Boys Hostel");
    await page.locator("#gdrStudioRoomType").selectOption("Shared");
    await page.locator("#gdrStudioTotalBeds").fill("40");
    await page.locator("#gdrStudioAvailableBeds").fill("12");
    const preview = page.locator("#gdrStudioIdentityPreview");
    await expect(preview).toContainText("Sunrise Boys Hostel");
    await expect(preview).toContainText("Hostel");
    await expect(preview).toContainText("Shared");
    await expect(preview).toContainText("12 of 40 beds available");
  });

  test("short property names block progression with an accessible validation state", async ({ page }) => {
    await openStudio(page);
    await page.locator('[data-gdr-property-category="pg"]').click();
    const name = page.locator("#gdrStudioPropertyName");
    await name.fill("AB");
    await page.locator("#gdrStudioNext").click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
  });
});

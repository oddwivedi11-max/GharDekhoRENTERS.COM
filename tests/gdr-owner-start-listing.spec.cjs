const { test, expect } = require("@playwright/test");

async function exposeOwnerDashboard(page, ownerExists = true) {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => window.GDRPropertyStudio && typeof window.GDRPropertyStudio.open === "function");
  await page.waitForFunction(() => document.getElementById("gdrPropertyStudio"));

  await page.evaluate((hasOwner) => {
    const shell = document.getElementById("dashboardSection");
    if (shell) {
      shell.hidden = false;
      shell.style.display = "block";
      shell.setAttribute("aria-hidden", "false");
    }
    const dashboard = document.getElementById("ownerDashboard");
    if (dashboard) {
      dashboard.hidden = false;
      dashboard.classList.add("active");
      dashboard.style.display = "block";
      // Reproduce the stale accessibility flag left by the dashboard role
      // transition. It must not block a dashboard that is visibly on screen.
      dashboard.setAttribute("aria-hidden", "true");
    }
    window.__gdrSupabaseClient = {
      auth: {
        getUser: async () => ({
          data: { user: { id: "gdr-owner-launcher-test-user" } },
          error: null
        })
      },
      from: (table) => ({
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: table === "owners" && hasOwner
            ? { id: "gdr-owner-launcher-test-owner", name: "QA Owner" }
            : null,
          error: null
        })
      })
    };
  }, ownerExists);
}

test.describe("GDR owner Start Listing launcher", () => {
  test("opens Property Studio from a visible Owner Dashboard even when aria-hidden is stale", async ({ page }) => {
    await exposeOwnerDashboard(page, true);
    const trigger = page.locator("#gdrListPropertyStart");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("type", "button");
    await trigger.click();

    await expect(page.locator("#gdrPropertyStudio")).toBeVisible();
    await expect(page.locator("#gdrStudioStepTitle")).toHaveText("Property type");
    await expect(page.locator("body")).toHaveClass(/gdr-property-studio-open/);
  });

  test("shows a visible explanation when the signed-in account has no Owner profile", async ({ page }) => {
    await exposeOwnerDashboard(page, false);
    await page.locator("#gdrListPropertyStart").click();

    const feedback = page.locator("#gdrListPropertyFeedback");
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText("does not have an Owner profile");
    await expect(page.locator("#gdrPropertyStudio")).toBeHidden();
  });
});

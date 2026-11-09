const { test, expect } = require("@playwright/test");

test.describe("GDR owner Start Listing launcher", () => {
  test("visible Start Listing button reaches the Property Studio action before dashboard click guards", async ({ page }) => {
    await page.goto("/index.html", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction(() =>
      window.GDRPropertyStudio &&
      typeof window.GDRPropertyStudio.open === "function" &&
      window.__gdrListPropertyLauncherBound === true,
      { timeout: 15000 }
    );

    await page.evaluate(() => {
      const shell = document.getElementById("dashboardSection");
      if (shell) {
        shell.hidden = false;
        shell.style.display = "block";
        shell.setAttribute("aria-hidden", "false");
      }
      const dashboard = document.getElementById("ownerDashboard");
      if (dashboard) {
        dashboard.hidden = false;
        dashboard.style.display = "block";
        dashboard.style.visibility = "visible";
        dashboard.classList.add("active");
      }
      window.__gdrStartListingCalls = [];
      window.GDRPropertyStudio.open = async voice => {
        window.__gdrStartListingCalls.push(voice);
        return true;
      };
    });

    const button = page.locator("#gdrListPropertyStart");
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
    await expect.poll(() => page.evaluate(() => window.__gdrStartListingCalls)).toEqual([false]);
    await expect(button).toBeEnabled();
    await expect(button).not.toHaveAttribute("aria-busy", "true");
  });
});

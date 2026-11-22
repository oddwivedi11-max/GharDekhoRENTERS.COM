const { test, expect } = require("@playwright/test");

async function openAuth(page, role) {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => typeof window.openLoginAs === "function");
  await page.evaluate(async selected => {
    await window.openLoginAs(selected);
  }, role || "renter");
  await expect(page.locator("#gdAuthFormShell")).toBeVisible();
}

test.describe("GharDekho Owner/Renter authentication", () => {
  test("Owner and Renter password login use email and password without a phone field", async ({ page }) => {
    for (const role of ["renter", "owner"]) {
      await openAuth(page, role);
      await expect(page.locator("#loginSubmitBtn")).toBeVisible();
      await expect(page.locator("#signupBtn")).toBeHidden();
      await expect(page.locator("#userEmail")).toBeVisible();
      await expect(page.locator("#userPassword")).toBeVisible();
      await expect(page.locator("#gdLoginPhoneField")).toBeHidden();
      expect(await page.locator("#userPhone").isRequired()).toBe(false);
    }
  });

  test("selecting Owner on Sign Up keeps the Create Account form open", async ({ page }) => {
    await openAuth(page, "owner");
    await page.locator("#authSignUpTab").click();
    await expect(page.locator("#userName")).toBeVisible();
    await expect(page.locator("#signupTermsField")).toBeVisible();
    await expect(page.locator("#gdLoginPhoneField")).toBeVisible();
    expect(await page.locator("#userPhone").isRequired()).toBe(true);

    await page.locator("#roleOwner").check();
    await expect(page.locator("#premiumAuthTitle")).toHaveText("Create your Owner account");
    await expect(page.locator("#signupBtn")).toBeVisible();
    await expect(page.locator("#loginSubmitBtn")).toBeHidden();
    await expect(page.locator("#userName")).toBeVisible();
    await expect(page.locator("#signupTermsField")).toBeVisible();
  });

  test("selecting Renter on Sign Up also keeps Create Account active", async ({ page }) => {
    await openAuth(page, "renter");
    await page.locator("#authSignUpTab").click();
    await page.locator("#roleOwner").check();
    await page.locator("#roleRenter").check();
    await expect(page.locator("#premiumAuthTitle")).toHaveText("Create your Renter account");
    await expect(page.locator("#signupBtn")).toBeVisible();
    await expect(page.locator("#loginSubmitBtn")).toBeHidden();
    await expect(page.locator("#gdLoginPhoneField")).toBeVisible();
  });

  test("switching from Sign Up back to Login hides phone and removes its requirement", async ({ page }) => {
    await openAuth(page, "owner");
    await page.locator("#authSignUpTab").click();
    await page.locator("#authSignInTab").click();
    await expect(page.locator("#loginSubmitBtn")).toBeVisible();
    await expect(page.locator("#signupBtn")).toBeHidden();
    await expect(page.locator("#userName")).toBeHidden();
    await expect(page.locator("#signupTermsField")).toBeHidden();
    await expect(page.locator("#gdLoginPhoneField")).toBeHidden();
    expect(await page.locator("#userPhone").isRequired()).toBe(false);
  });
});

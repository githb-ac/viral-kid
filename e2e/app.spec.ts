import { test, expect } from "@playwright/test";

test.describe("App", () => {
  test("homepage redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders form elements", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Verify form elements are in the DOM
    await expect(page.getByPlaceholder(/email/i)).toBeAttached();
    await expect(page.getByPlaceholder(/password/i)).toBeAttached();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeAttached();
  });

  test("login form accepts input", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Fill form fields (force bypasses shader overlay)
    const emailInput = page.getByPlaceholder(/email/i);
    const passwordInput = page.getByPlaceholder(/password/i);

    await emailInput.fill("test@example.com", { force: true });
    await passwordInput.fill("testpassword", { force: true });

    // Verify values were entered
    await expect(emailInput).toHaveValue("test@example.com");
    await expect(passwordInput).toHaveValue("testpassword");
  });

  test("signup page shows token error without invite", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");

    // Page should indicate invite token is required
    const pageContent = await page.textContent("body");
    expect(
      pageContent?.toLowerCase().includes("invite") ||
        pageContent?.toLowerCase().includes("token")
    ).toBeTruthy();
  });

  test("direct dashboard access requires auth", async ({ page }) => {
    // Try to access protected route
    await page.goto("/admin");
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

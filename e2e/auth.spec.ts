import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Login Flow", () => {
    test("shows login page with all required elements", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      await expect(page.getByPlaceholder(/email/i)).toBeAttached();
      await expect(page.getByPlaceholder(/password/i)).toBeAttached();
      await expect(
        page.getByRole("button", { name: /sign in/i })
      ).toBeAttached();
    });

    test("shows error for empty form submission", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      await page
        .getByRole("button", { name: /sign in/i })
        .click({ force: true });

      // Toast should appear
      await expect(page.getByText(/please fill in all fields/i)).toBeVisible({
        timeout: 5000,
      });
    });

    test("shows error for invalid credentials", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      await page
        .getByPlaceholder(/email/i)
        .fill("nonexistent@example.com", { force: true });
      await page
        .getByPlaceholder(/password/i)
        .fill("wrongpassword123", { force: true });
      await page
        .getByRole("button", { name: /sign in/i })
        .click({ force: true });

      await expect(page.getByText(/invalid email or password/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test("validates email format", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      await page.getByPlaceholder(/email/i).fill("notanemail", { force: true });
      await page
        .getByPlaceholder(/password/i)
        .fill("password123", { force: true });
      await page
        .getByRole("button", { name: /sign in/i })
        .click({ force: true });

      // Should show validation error or invalid credentials
      const errorVisible = await page
        .getByText(/invalid|email/i)
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(errorVisible).toBeTruthy();
    });
  });

  test.describe("Signup Flow", () => {
    test("requires invite token", async ({ page }) => {
      await page.goto("/signup");
      await page.waitForLoadState("domcontentloaded");

      // Should show error about missing token
      await expect(page.getByText(/no invite token/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test("validates invalid invite token", async ({ page }) => {
      await page.goto("/signup?token=invalid-token-12345");
      await page.waitForLoadState("domcontentloaded");

      // Should show error about invalid token
      await expect(page.getByText(/invalid|expired|not found/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test("has link back to login", async ({ page }) => {
      await page.goto("/signup");
      await page.waitForLoadState("domcontentloaded");

      const loginLink = page.getByRole("link", { name: /sign in|login|back/i });
      await expect(loginLink).toBeAttached();
    });
  });

  test.describe("Protected Routes", () => {
    test("redirects unauthenticated users from homepage to login", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/login/);
    });

    test("redirects unauthenticated users from admin to login", async ({
      page,
    }) => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/login/);
    });
  });
});

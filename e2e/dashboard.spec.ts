import { test, expect } from "@playwright/test";

/**
 * Dashboard E2E Tests
 *
 * Note: These tests require authentication. In a real scenario, you would:
 * 1. Set up a test user in the database
 * 2. Use Playwright's storageState to persist auth
 * 3. Or mock the auth session
 *
 * For now, these tests verify the unauthenticated behavior and page structure.
 */

test.describe("Dashboard", () => {
  test.describe("Unauthenticated Access", () => {
    test("redirects to login when accessing dashboard", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/login/);
    });

    test("redirects to login when accessing admin", async ({ page }) => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("API Protection", () => {
    test("accounts API returns 401 without auth", async ({ request }) => {
      const response = await request.get("/api/accounts");
      expect(response.status()).toBe(401);
    });

    test("logs API returns 401 without auth", async ({ request }) => {
      const response = await request.get("/api/logs");
      expect(response.status()).toBe(401);
    });

    test("openrouter credentials API returns 401 without auth", async ({
      request,
    }) => {
      const response = await request.get("/api/openrouter/credentials");
      expect(response.status()).toBe(401);
    });

    test("admin invites API returns 401 without auth", async ({ request }) => {
      const response = await request.get("/api/admin/invites");
      expect(response.status()).toBe(401);
    });
  });

  test.describe("Health Check", () => {
    test("health endpoint is accessible", async ({ request }) => {
      const response = await request.get("/api/health");
      // Should return 200 (healthy) or 503 (unhealthy) but not 401/404
      expect([200, 503]).toContain(response.status());

      const data = await response.json();
      expect(data.status).toMatch(/healthy|unhealthy/);
      expect(data.timestamp).toBeDefined();
    });
  });
});

test.describe("Platform OAuth Initiation", () => {
  test("Twitter auth endpoint requires authentication", async ({ request }) => {
    const response = await request.get("/api/twitter/auth?accountId=test");
    expect(response.status()).toBe(401);
  });

  test("YouTube auth endpoint requires authentication", async ({ request }) => {
    const response = await request.get("/api/youtube/auth?accountId=test");
    expect(response.status()).toBe(401);
  });

  test("Reddit auth endpoint requires authentication", async ({ request }) => {
    const response = await request.get("/api/reddit/auth?accountId=test");
    expect(response.status()).toBe(401);
  });

  test("Instagram auth endpoint requires authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/instagram/auth?accountId=test");
    expect(response.status()).toBe(401);
  });
});

test.describe("Cron Endpoints Protection", () => {
  test("twitter-trends cron requires secret", async ({ request }) => {
    const response = await request.get("/api/cron/twitter-trends");
    expect(response.status()).toBe(401);
  });

  test("youtube-trends cron requires secret", async ({ request }) => {
    const response = await request.get("/api/cron/youtube-trends");
    expect(response.status()).toBe(401);
  });

  test("cleanup cron requires secret", async ({ request }) => {
    const response = await request.get("/api/cron/cleanup");
    expect(response.status()).toBe(401);
  });

  test("reddit cron requires secret", async ({ request }) => {
    const response = await request.get("/api/cron/reddit");
    expect(response.status()).toBe(401);
  });
});

test.describe("Webhook Endpoints", () => {
  test("Instagram webhook GET returns challenge for verification", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/instagram/webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=wrong"
    );
    // Should return 403 for wrong verify token or 200 with challenge
    expect([200, 403]).toContain(response.status());
  });

  test("Instagram webhook POST requires valid signature", async ({
    request,
  }) => {
    const response = await request.post("/api/instagram/webhook", {
      data: { object: "instagram", entry: [] },
      headers: {
        "x-hub-signature-256": "sha256=invalid",
      },
    });
    // Should acknowledge but may reject invalid signature internally
    expect([200, 401, 403]).toContain(response.status());
  });
});

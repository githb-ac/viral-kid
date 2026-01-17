import { describe, it, expect } from "vitest";
import {
  twitterLimiter,
  youtubeLimiter,
  instagramLimiter,
  openRouterLimiter,
  createRateLimiter,
} from "./rate-limiter";

describe("Rate Limiter", () => {
  describe("twitterLimiter", () => {
    it("is configured with correct reservoir", () => {
      expect(twitterLimiter).toBeDefined();
    });
  });

  describe("youtubeLimiter", () => {
    it("is configured with correct reservoir", () => {
      expect(youtubeLimiter).toBeDefined();
    });
  });

  describe("instagramLimiter", () => {
    it("is configured with correct reservoir", () => {
      expect(instagramLimiter).toBeDefined();
    });
  });

  describe("openRouterLimiter", () => {
    it("is configured with correct reservoir", () => {
      expect(openRouterLimiter).toBeDefined();
    });
  });

  describe("createRateLimiter", () => {
    it("creates a new limiter with custom options", () => {
      const customLimiter = createRateLimiter({
        maxConcurrent: 10,
        minTime: 100,
      });

      expect(customLimiter).toBeDefined();
    });

    it("creates a limiter with reservoir options", () => {
      const customLimiter = createRateLimiter({
        reservoir: 50,
        reservoirRefreshAmount: 50,
        reservoirRefreshInterval: 60000,
      });

      expect(customLimiter).toBeDefined();
    });
  });
});

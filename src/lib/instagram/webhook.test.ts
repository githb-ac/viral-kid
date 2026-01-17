import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyWebhookSignature,
  parseWebhookPayload,
  extractCommentEvents,
} from "./webhook";
import type { WebhookPayload } from "./types";

describe("Instagram Webhook", () => {
  describe("verifyWebhookSignature", () => {
    const appSecret = "test-app-secret";

    it("returns false for missing signature", () => {
      const result = verifyWebhookSignature("payload", "", appSecret);
      expect(result).toBe(false);
    });

    it("returns false for invalid signature format", () => {
      const result = verifyWebhookSignature(
        "payload",
        "invalid-signature",
        appSecret
      );
      expect(result).toBe(false);
    });

    it("returns false for mismatched signature", () => {
      const result = verifyWebhookSignature(
        "payload",
        "sha256=wronghash",
        appSecret
      );
      expect(result).toBe(false);
    });

    it("verifies valid signature", () => {
      // Create a valid signature using the same algorithm
      const payload = '{"test":"data"}';
      const expectedSignature = crypto
        .createHmac("sha256", appSecret)
        .update(payload)
        .digest("hex");

      const result = verifyWebhookSignature(
        payload,
        `sha256=${expectedSignature}`,
        appSecret
      );
      expect(result).toBe(true);
    });

    it("uses timing-safe comparison", () => {
      // This test verifies the function doesn't throw on different length inputs
      const result = verifyWebhookSignature("short", "sha256=abc", appSecret);
      expect(result).toBe(false);
    });
  });

  describe("parseWebhookPayload", () => {
    it("returns null for non-instagram object", () => {
      const payload = {
        object: "page",
        entry: [],
      };
      const result = parseWebhookPayload(payload);
      expect(result).toBeNull();
    });

    it("returns null for missing entry array", () => {
      const payload = {
        object: "instagram",
      };
      const result = parseWebhookPayload(payload);
      expect(result).toBeNull();
    });

    it("returns payload for valid instagram webhook", () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "ig-user-123",
            time: Date.now(),
            changes: [],
          },
        ],
      };
      const result = parseWebhookPayload(payload);
      expect(result).not.toBeNull();
      expect(result?.object).toBe("instagram");
      expect(result?.entry).toHaveLength(1);
    });
  });

  describe("extractCommentEvents", () => {
    it("extracts valid comment events", () => {
      const payload: WebhookPayload = {
        object: "instagram",
        entry: [
          {
            id: "ig-user-123",
            time: Date.now(),
            changes: [
              {
                field: "comments",
                value: {
                  id: "comment-123",
                  text: "Test comment",
                  from: {
                    id: "user-456",
                    username: "testuser",
                  },
                  media: {
                    id: "media-789",
                  },
                },
              },
            ],
          },
        ],
      };

      const events = extractCommentEvents(payload);

      expect(events).toHaveLength(1);
      expect(events[0].accountId).toBe("ig-user-123");
      expect(events[0].change.value.id).toBe("comment-123");
    });

    it("filters out non-comment changes", () => {
      const payload: WebhookPayload = {
        object: "instagram",
        entry: [
          {
            id: "ig-user-123",
            time: Date.now(),
            changes: [
              {
                field: "mentions",
                value: {
                  id: "mention-123",
                  text: "Mentioned",
                },
              },
            ],
          },
        ],
      };

      const events = extractCommentEvents(payload);
      expect(events).toHaveLength(0);
    });

    it("filters out incomplete comment changes", () => {
      const payload: WebhookPayload = {
        object: "instagram",
        entry: [
          {
            id: "ig-user-123",
            time: Date.now(),
            changes: [
              {
                field: "comments",
                value: {
                  id: "comment-123",
                  text: "Test comment",
                  // Missing from and media
                },
              },
            ],
          },
        ],
      };

      const events = extractCommentEvents(payload);
      expect(events).toHaveLength(0);
    });
  });
});

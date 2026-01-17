import { describe, it, expect } from "vitest";
import {
  platformSchema,
  scheduleSchema,
  accountIdSchema,
  parseBody,
  parseQueryParam,
  platformOptions,
  scheduleOptions,
} from "./validation";
import { z } from "zod";

describe("Validation Schemas", () => {
  describe("platformSchema", () => {
    it("accepts valid platforms", () => {
      for (const platform of platformOptions) {
        const result = platformSchema.safeParse(platform);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid platforms", () => {
      const result = platformSchema.safeParse("invalid_platform");
      expect(result.success).toBe(false);
    });

    it("is case-sensitive (lowercase)", () => {
      // Platform options are lowercase
      const result = platformSchema.safeParse("TWITTER");
      expect(result.success).toBe(false);

      const lowerResult = platformSchema.safeParse("twitter");
      expect(lowerResult.success).toBe(true);
    });
  });

  describe("scheduleSchema", () => {
    it("accepts valid schedules", () => {
      for (const schedule of scheduleOptions) {
        const result = scheduleSchema.safeParse(schedule);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid schedules", () => {
      const result = scheduleSchema.safeParse("every_1_min");
      expect(result.success).toBe(false);
    });
  });

  describe("accountIdSchema", () => {
    it("accepts valid CUID", () => {
      // CUIDs follow a specific pattern
      const result = accountIdSchema.safeParse("clh1234567890abcdefghij");
      expect(result.success).toBe(true);
    });

    it("rejects empty string", () => {
      const result = accountIdSchema.safeParse("");
      expect(result.success).toBe(false);
    });

    it("rejects invalid format", () => {
      const result = accountIdSchema.safeParse("not-a-cuid");
      expect(result.success).toBe(false);
    });
  });

  describe("parseBody", () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    it("parses valid JSON body", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "Test", age: 25 }),
      });

      const result = await parseBody(request, testSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test");
        expect(result.data.age).toBe(25);
      }
    });

    it("returns error for invalid data", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "", age: -5 }),
      });

      const result = await parseBody(request, testSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it("returns error for invalid JSON", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: "not json",
      });

      const result = await parseBody(request, testSchema);

      expect(result.success).toBe(false);
    });
  });

  describe("parseQueryParam", () => {
    it("parses valid query parameter value", () => {
      const result = parseQueryParam("twitter", platformSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("twitter");
      }
    });

    it("returns error for null parameter", () => {
      const result = parseQueryParam(null, platformSchema);

      expect(result.success).toBe(false);
    });

    it("returns error for invalid parameter value", () => {
      const result = parseQueryParam("INVALID", platformSchema);

      expect(result.success).toBe(false);
    });
  });
});

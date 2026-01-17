import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("Health API", () => {
  describe("GET /api/health", () => {
    it("returns ok status", async () => {
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("ok");
    });
  });
});

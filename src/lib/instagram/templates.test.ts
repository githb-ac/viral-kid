import { describe, it, expect } from "vitest";
import {
  parseTemplates,
  serializeTemplates,
  selectTemplate,
  interpolateTemplate,
  matchKeyword,
  validateTemplates,
} from "./templates";

describe("Instagram Templates", () => {
  describe("parseTemplates", () => {
    it("returns array from valid JSON", () => {
      const templates = parseTemplates('["Template 1", "Template 2"]');
      expect(templates).toEqual(["Template 1", "Template 2"]);
    });

    it("returns empty array for empty string", () => {
      const templates = parseTemplates("");
      expect(templates).toEqual([]);
    });

    it("returns empty array for invalid JSON", () => {
      const templates = parseTemplates("not json");
      expect(templates).toEqual([]);
    });

    it("returns empty array for non-array JSON", () => {
      const templates = parseTemplates('{"not": "array"}');
      expect(templates).toEqual([]);
    });

    it("filters out non-string and empty values", () => {
      const templates = parseTemplates(
        '["Valid", "", 123, "Also Valid", "  "]'
      );
      expect(templates).toEqual(["Valid", "Also Valid"]);
    });
  });

  describe("serializeTemplates", () => {
    it("serializes templates to JSON string", () => {
      const json = serializeTemplates(["Template 1", "Template 2"]);
      expect(json).toBe('["Template 1","Template 2"]');
    });

    it("filters out empty templates", () => {
      const json = serializeTemplates(["Valid", "", "Also Valid", "  "]);
      expect(json).toBe('["Valid","Also Valid"]');
    });

    it("handles empty array", () => {
      const json = serializeTemplates([]);
      expect(json).toBe("[]");
    });
  });

  describe("selectTemplate", () => {
    it("returns template at index (modulo)", () => {
      const templates = ["A", "B", "C"];
      expect(selectTemplate(templates, 0)).toBe("A");
      expect(selectTemplate(templates, 1)).toBe("B");
      expect(selectTemplate(templates, 2)).toBe("C");
      expect(selectTemplate(templates, 3)).toBe("A"); // Wraps around
    });

    it("returns empty string for empty array", () => {
      const selected = selectTemplate([], 0);
      expect(selected).toBe("");
    });

    it("returns the only template for single-element array", () => {
      const templates = ["Only Template"];
      expect(selectTemplate(templates, 0)).toBe("Only Template");
      expect(selectTemplate(templates, 5)).toBe("Only Template");
    });

    it("handles negative index", () => {
      const templates = ["A", "B", "C"];
      const selected = selectTemplate(templates, -1);
      expect(templates).toContain(selected);
    });
  });

  describe("interpolateTemplate", () => {
    it("replaces username variable", () => {
      const result = interpolateTemplate("Hi {{username}}!", {
        username: "john",
      });
      expect(result).toBe("Hi john!");
    });

    it("replaces keyword variable", () => {
      const result = interpolateTemplate("You said {{keyword}}!", {
        keyword: "hello",
      });
      expect(result).toBe("You said hello!");
    });

    it("replaces comment variable", () => {
      const result = interpolateTemplate("Re: {{comment}}", {
        comment: "your message",
      });
      expect(result).toBe("Re: your message");
    });

    it("replaces multiple variables", () => {
      const result = interpolateTemplate(
        "Hi {{username}}, you mentioned {{keyword}}!",
        { username: "jane", keyword: "discount" }
      );
      expect(result).toBe("Hi jane, you mentioned discount!");
    });

    it("leaves unknown variables unchanged", () => {
      const result = interpolateTemplate("Hello {{unknown}}!", {
        username: "test",
      });
      expect(result).toBe("Hello {{unknown}}!");
    });
  });

  describe("matchKeyword", () => {
    it("returns matching keyword (case insensitive)", () => {
      const result = matchKeyword(
        "I want the DISCOUNT please",
        "discount,sale"
      );
      expect(result).toBe("discount");
    });

    it("returns null for no match", () => {
      const result = matchKeyword("Hello there", "discount,sale");
      expect(result).toBeNull();
    });

    it("matches whole words only", () => {
      // "boom" should not match "boomerang"
      const result = matchKeyword("I love boomerangs", "boom");
      expect(result).toBeNull();
    });

    it("matches whole word correctly", () => {
      const result = matchKeyword("Boom! That's great", "boom");
      expect(result).toBe("boom");
    });

    it("returns null for empty keywords string", () => {
      const result = matchKeyword("Some comment", "");
      expect(result).toBeNull();
    });

    it("handles comma-separated keywords", () => {
      const result = matchKeyword("I want more info", "price,info,details");
      expect(result).toBe("info");
    });
  });

  describe("validateTemplates", () => {
    it("returns true for valid string array", () => {
      expect(validateTemplates(["A", "B", "C"])).toBe(true);
    });

    it("returns false for non-array", () => {
      expect(validateTemplates("not an array")).toBe(false);
      expect(validateTemplates(123)).toBe(false);
      expect(validateTemplates(null)).toBe(false);
    });

    it("returns false for array with non-strings", () => {
      expect(validateTemplates(["Valid", 123])).toBe(false);
    });

    it("returns false for array with empty strings", () => {
      expect(validateTemplates(["Valid", ""])).toBe(false);
      expect(validateTemplates(["Valid", "  "])).toBe(false);
    });

    it("returns true for empty array", () => {
      expect(validateTemplates([])).toBe(true);
    });
  });
});

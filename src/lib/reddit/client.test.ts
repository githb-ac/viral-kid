import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  refreshTokenIfNeeded,
  searchPosts,
  postComment,
  generateReply,
} from "./client";
import type {
  RedditCredentialsForRefresh,
  GenerateReplyOptions,
} from "./types";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Reddit Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("refreshTokenIfNeeded", () => {
    it("returns null when accessToken is missing", async () => {
      const credentials: RedditCredentialsForRefresh = {
        clientId: "client123",
        clientSecret: "secret456",
        accessToken: "",
        refreshToken: "refresh789",
        tokenExpiresAt: new Date("2024-01-15T13:00:00Z"),
      };

      const result = await refreshTokenIfNeeded(credentials);
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns null when refreshToken is missing", async () => {
      const credentials: RedditCredentialsForRefresh = {
        clientId: "client123",
        clientSecret: "secret456",
        accessToken: "access123",
        refreshToken: null,
        tokenExpiresAt: new Date("2024-01-15T13:00:00Z"),
      };

      const result = await refreshTokenIfNeeded(credentials);
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns existing token when not expired", async () => {
      const expiresAt = new Date("2024-01-15T13:00:00Z"); // 1 hour from now
      const credentials: RedditCredentialsForRefresh = {
        clientId: "client123",
        clientSecret: "secret456",
        accessToken: "access123",
        refreshToken: "refresh789",
        tokenExpiresAt: expiresAt,
      };

      const result = await refreshTokenIfNeeded(credentials);

      expect(result).toEqual({
        accessToken: "access123",
        expiresAt: expiresAt,
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("refreshes token when expiring within 5 minutes", async () => {
      const credentials: RedditCredentialsForRefresh = {
        clientId: "client123",
        clientSecret: "secret456",
        accessToken: "old_access",
        refreshToken: "refresh789",
        tokenExpiresAt: new Date("2024-01-15T12:03:00Z"), // 3 mins from now
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new_access_token",
          expires_in: 3600,
        }),
      });

      const result = await refreshTokenIfNeeded(credentials);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.reddit.com/api/v1/access_token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "ViralKid/1.0.0",
          }),
        })
      );
      expect(result).toEqual({
        accessToken: "new_access_token",
        expiresAt: new Date("2024-01-15T13:00:00Z"),
      });
    });

    it("throws error when refresh fails", async () => {
      const credentials: RedditCredentialsForRefresh = {
        clientId: "client123",
        clientSecret: "secret456",
        accessToken: "old_access",
        refreshToken: "refresh789",
        tokenExpiresAt: new Date("2024-01-15T12:03:00Z"),
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid refresh token",
      });

      await expect(refreshTokenIfNeeded(credentials)).rejects.toThrow(
        "Failed to refresh Reddit token"
      );
    });
  });

  describe("searchPosts", () => {
    it("returns empty array when no keywords provided", async () => {
      const result = await searchPosts("access123", {
        keywords: "",
        timeRange: "day",
      });

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns empty array when only whitespace keywords", async () => {
      const result = await searchPosts("access123", {
        keywords: "   ,  ,   ",
        timeRange: "day",
      });

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("searches with single keyword", async () => {
      const mockPosts = [
        {
          id: "post1",
          name: "t3_post1",
          title: "Test Post",
          selftext: "Post body",
          author: "user1",
          subreddit: "test",
          url: "https://reddit.com/r/test/post1",
          permalink: "/r/test/comments/post1",
          ups: 100,
          num_comments: 10,
          created_utc: 1705320000,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: mockPosts.map((p) => ({ data: p })),
          },
        }),
      });

      const result = await searchPosts("access123", {
        keywords: "protein",
        timeRange: "day",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("q=protein"),
        expect.objectContaining({
          headers: {
            Authorization: "Bearer access123",
            "User-Agent": "ViralKid/1.0.0",
          },
        })
      );
      expect(result).toEqual(mockPosts);
    });

    it("joins multiple keywords with OR", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { children: [] },
        }),
      });

      await searchPosts("access123", {
        keywords: "protein, supplements, fitness",
        timeRange: "week",
        limit: 50,
      });

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("q=protein+OR+supplements+OR+fitness");
      expect(calledUrl).toContain("t=week");
      expect(calledUrl).toContain("limit=50");
    });

    it("throws error when search fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(
        searchPosts("access123", { keywords: "test", timeRange: "day" })
      ).rejects.toThrow("Failed to search posts: 403");
    });
  });

  describe("postComment", () => {
    it("posts comment and returns comment ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          json: {
            data: {
              things: [{ data: { name: "t1_comment123" } }],
            },
          },
        }),
      });

      const result = await postComment(
        "access123",
        "t3_post456",
        "Great post!"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth.reddit.com/api/comment",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer access123",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "ViralKid/1.0.0",
          },
        })
      );

      // Verify body contains correct params
      const callArgs = mockFetch.mock.calls[0]?.[1] as {
        body: URLSearchParams;
      };
      const callBody = callArgs?.body;
      expect(callBody.get("thing_id")).toBe("t3_post456");
      expect(callBody.get("text")).toBe("Great post!");

      expect(result).toBe("t1_comment123");
    });

    it("returns 'unknown' when response structure is unexpected", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          json: { data: {} },
        }),
      });

      const result = await postComment("access123", "t3_post456", "Comment");
      expect(result).toBe("unknown");
    });

    it("throws error when posting fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Rate limited",
      });

      await expect(
        postComment("access123", "t3_post456", "Comment")
      ).rejects.toThrow("Failed to post comment: Rate limited");
    });
  });

  describe("generateReply", () => {
    const baseOptions: GenerateReplyOptions = {
      apiKey: "openrouter_key",
      model: "anthropic/claude-3-haiku",
      systemPrompt: "You are helpful",
      postTitle: "Best protein powder?",
      postBody: "Looking for recommendations",
      postAuthor: "fitness_fan",
      subreddit: "fitness",
      styleOptions: {
        noHashtags: false,
        noEmojis: false,
        noCapitalization: false,
        badGrammar: false,
      },
    };

    it("generates reply successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "I recommend whey protein for beginners!",
              },
            },
          ],
        }),
      });

      const result = await generateReply(baseOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer openrouter_key",
            "Content-Type": "application/json",
          }),
        })
      );

      expect(result).toBe("I recommend whey protein for beginners!");
    });

    it("applies style options to system prompt", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "reply text" } }],
        }),
      });

      await generateReply({
        ...baseOptions,
        styleOptions: {
          noHashtags: true,
          noEmojis: true,
          noCapitalization: true,
          badGrammar: true,
        },
      });

      const callArgs = mockFetch.mock.calls[0]?.[1] as { body: string };
      const callBody = JSON.parse(callArgs?.body ?? "{}");
      const systemContent = callBody.messages[0].content;

      expect(systemContent).toContain("Do not use hashtags");
      expect(systemContent).toContain("Do not use emojis");
      expect(systemContent).toContain("Use all lowercase letters");
      expect(systemContent).toContain("Use casual grammar with minor typos");
    });

    it("truncates long post body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "reply" } }],
        }),
      });

      const longBody = "x".repeat(600);
      await generateReply({
        ...baseOptions,
        postBody: longBody,
      });

      const callArgs = mockFetch.mock.calls[0]?.[1] as { body: string };
      const callBody = JSON.parse(callArgs?.body ?? "{}");
      const userContent = callBody.messages[1].content;

      expect(userContent).toContain("x".repeat(500) + "...");
      expect(userContent).not.toContain("x".repeat(600));
    });

    it("truncates reply to 500 characters", async () => {
      const longReply = "y".repeat(600);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: longReply } }],
        }),
      });

      const result = await generateReply(baseOptions);

      expect(result).toHaveLength(500);
      expect(result).toBe("y".repeat(500));
    });

    it("throws error on empty LLM response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "" } }],
        }),
      });

      await expect(generateReply(baseOptions)).rejects.toThrow(
        "Empty response from LLM"
      );
    });

    it("throws error when OpenRouter fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "API quota exceeded",
      });

      await expect(generateReply(baseOptions)).rejects.toThrow(
        "OpenRouter error: API quota exceeded"
      );
    });
  });
});

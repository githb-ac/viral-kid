import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  refreshTokenIfNeeded,
  fetchChannelVideos,
  fetchVideoComments,
  hasReplyFromChannel,
  postCommentReply,
} from "./client";

// Mock fetch
global.fetch = vi.fn();

describe("YouTube Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("refreshTokenIfNeeded", () => {
    it("returns null when access token is missing", async () => {
      const credentials = {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: null,
        refreshToken: "refresh-token",
        tokenExpiresAt: new Date(Date.now() + 3600000),
      };

      const result = await refreshTokenIfNeeded(credentials);
      expect(result).toBeNull();
    });

    it("returns null when refresh token is missing", async () => {
      const credentials = {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "access-token",
        refreshToken: null,
        tokenExpiresAt: new Date(Date.now() + 3600000),
      };

      const result = await refreshTokenIfNeeded(credentials);
      expect(result).toBeNull();
    });

    it("returns existing token if not expired", async () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const credentials = {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenExpiresAt: expiresAt,
      };

      const result = await refreshTokenIfNeeded(credentials);

      expect(result).not.toBeNull();
      expect(result?.accessToken).toBe("access-token");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("refreshes token when expired", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          }),
      } as Response);

      const credentials = {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "old-token",
        refreshToken: "refresh-token",
        tokenExpiresAt: new Date(Date.now() - 1000), // Expired
      };

      const result = await refreshTokenIfNeeded(credentials);

      expect(result?.accessToken).toBe("new-access-token");
      expect(fetch).toHaveBeenCalled();
    });

    it("returns null on failed refresh", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Invalid refresh token"),
      } as Response);

      const credentials = {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "old-token",
        refreshToken: "refresh-token",
        tokenExpiresAt: new Date(Date.now() - 1000),
      };

      const result = await refreshTokenIfNeeded(credentials);
      expect(result).toBeNull();
    });

    it("handles network errors", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      const credentials = {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "old-token",
        refreshToken: "refresh-token",
        tokenExpiresAt: new Date(Date.now() - 1000),
      };

      const result = await refreshTokenIfNeeded(credentials);
      expect(result).toBeNull();
    });
  });

  describe("fetchChannelVideos", () => {
    it("fetches videos from channel", async () => {
      // First call: get channel details
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                {
                  contentDetails: {
                    relatedPlaylists: {
                      uploads: "UU123",
                    },
                  },
                },
              ],
            }),
        } as Response)
        // Second call: get playlist items
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                {
                  snippet: {
                    resourceId: { videoId: "video-1" },
                    title: "Test Video",
                  },
                },
              ],
            }),
        } as Response);

      const videos = await fetchChannelVideos("access-token", 10);

      expect(videos).toHaveLength(1);
      expect(videos[0].videoId).toBe("video-1");
      expect(videos[0].title).toBe("Test Video");
    });

    it("throws error when channel fetch fails", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(fetchChannelVideos("bad-token", 10)).rejects.toThrow();
    });
  });

  describe("fetchVideoComments", () => {
    it("fetches comments for video", async () => {
      const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                snippet: {
                  topLevelComment: {
                    id: "comment-1",
                    snippet: {
                      textDisplay: "Great video!",
                      authorDisplayName: "User1",
                      authorChannelId: { value: "channel-1" },
                      likeCount: 5,
                      publishedAt: recentDate.toISOString(),
                    },
                  },
                },
              },
            ],
          }),
      } as Response);

      const comments = await fetchVideoComments(
        "access-token",
        "video-id",
        "Video Title",
        20
      );

      expect(comments).toHaveLength(1);
      expect(comments[0].userComment).toBe("Great video!");
    });

    it("returns empty array when comments disabled", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response);

      const comments = await fetchVideoComments(
        "access-token",
        "video-id",
        "Title",
        20
      );

      expect(comments).toEqual([]);
    });

    it("filters out old comments", async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                snippet: {
                  topLevelComment: {
                    id: "comment-1",
                    snippet: {
                      textDisplay: "Old comment",
                      authorDisplayName: "User1",
                      authorChannelId: { value: "channel-1" },
                      likeCount: 0,
                      publishedAt: oldDate.toISOString(),
                    },
                  },
                },
              },
            ],
          }),
      } as Response);

      const comments = await fetchVideoComments(
        "access-token",
        "video-id",
        "Title",
        20
      );

      expect(comments).toHaveLength(0);
    });
  });

  describe("hasReplyFromChannel", () => {
    it("returns true if channel has replied", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                snippet: {
                  authorChannelId: { value: "my-channel" },
                },
              },
            ],
          }),
      } as Response);

      const hasReply = await hasReplyFromChannel(
        "access-token",
        "comment-id",
        "my-channel"
      );

      expect(hasReply).toBe(true);
    });

    it("returns false if channel has not replied", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                snippet: {
                  authorChannelId: { value: "other-channel" },
                },
              },
            ],
          }),
      } as Response);

      const hasReply = await hasReplyFromChannel(
        "access-token",
        "comment-id",
        "my-channel"
      );

      expect(hasReply).toBe(false);
    });

    it("returns false on error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const hasReply = await hasReplyFromChannel(
        "access-token",
        "comment-id",
        "my-channel"
      );

      expect(hasReply).toBe(false);
    });
  });

  describe("postCommentReply", () => {
    it("posts reply successfully", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "new-reply-id",
          }),
      } as Response);

      const replyId = await postCommentReply(
        "access-token",
        "parent-comment-id",
        "My reply"
      );

      expect(replyId).toBe("new-reply-id");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("comments"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer access-token",
          }),
        })
      );
    });

    it("throws error on failed post", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Comments disabled"),
      } as Response);

      await expect(
        postCommentReply("access-token", "parent-id", "Reply")
      ).rejects.toThrow();
    });
  });
});

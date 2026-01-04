/**
 * Reddit API modules
 *
 * This module provides organized access to Reddit API functionality.
 *
 * @example
 * ```ts
 * import { searchPosts, postComment, generateReply } from "@/lib/reddit";
 *
 * // Search for posts
 * const posts = await searchPosts(accessToken, {
 *   keywords: "protein powder, supplements",
 *   timeRange: "day",
 * });
 *
 * // Generate and post a reply
 * const reply = await generateReply({ ... });
 * const commentId = await postComment(accessToken, post.name, reply);
 * ```
 */

// Client utilities
export {
  refreshTokenIfNeeded,
  searchPosts,
  postComment,
  generateReply,
} from "./client";

// Types
export type {
  RedditPost,
  RedditCredentialsForRefresh,
  RedditTokenResult,
  StyleOptions,
  GenerateReplyOptions,
  CommentResult,
  SearchOptions,
} from "./types";

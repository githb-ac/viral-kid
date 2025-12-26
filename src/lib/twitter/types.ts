import type { TweetV2PostTweetResult } from "twitter-api-v2";

/**
 * Reply options for creating a tweet reply
 * Based on X API v2 POST /2/tweets reply object
 * @see https://docs.x.com/x-api/posts/creation-of-a-post
 */
export interface ReplyOptions {
  /** The text content of the reply (required, max 280 characters) */
  text: string;

  /** The tweet ID to reply to */
  inReplyToTweetId: string;

  /**
   * Automatically include @mentions from the parent tweet
   * When true, the reply will mention users from the original tweet
   */
  autoPopulateReplyMetadata?: boolean;

  /**
   * User IDs to exclude from auto-populated mentions
   * Only applies when autoPopulateReplyMetadata is true
   */
  excludeReplyUserIds?: string[];
}

/**
 * Options for replying with media attachments
 */
export interface ReplyWithMediaOptions extends ReplyOptions {
  /** Array of media IDs to attach to the reply */
  mediaIds: string[];
}

/**
 * Result of a successful reply operation
 */
export interface ReplyResult {
  success: true;
  tweet: {
    id: string;
    text: string;
  };
  raw: TweetV2PostTweetResult;
}

/**
 * Result of a failed reply operation
 */
export interface ReplyError {
  success: false;
  error: string;
  code?: string;
}

/**
 * Union type for reply operation results
 */
export type ReplyResponse = ReplyResult | ReplyError;

/**
 * Batch reply item for processing multiple replies
 */
export interface BatchReplyItem {
  /** Unique identifier for this reply in the batch */
  id: string;
  /** The tweet ID to reply to */
  tweetId: string;
  /** The reply text */
  text: string;
}

/**
 * Result of a batch reply operation
 */
export interface BatchReplyResult {
  /** Total number of replies attempted */
  total: number;
  /** Number of successful replies */
  successful: number;
  /** Number of failed replies */
  failed: number;
  /** Individual results for each reply */
  results: Array<{
    id: string;
    tweetId: string;
    response: ReplyResponse;
  }>;
}

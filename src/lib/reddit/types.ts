/**
 * Reddit API type definitions
 */

export interface RedditPost {
  id: string;
  name: string; // fullname like "t3_xxxxx"
  title: string;
  selftext: string; // post body text
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  ups: number;
  num_comments: number;
  created_utc: number;
}

export interface RedditCredentialsForRefresh {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}

export interface RedditTokenResult {
  accessToken: string;
  expiresAt: Date;
}

export interface StyleOptions {
  noHashtags: boolean;
  noEmojis: boolean;
  noCapitalization: boolean;
  badGrammar: boolean;
}

export interface GenerateReplyOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  postTitle: string;
  postBody: string;
  postAuthor: string;
  subreddit: string;
  styleOptions: StyleOptions;
}

export interface CommentResult {
  commentId: string;
  success: boolean;
}

export interface SearchOptions {
  keywords: string;
  timeRange: string;
  limit?: number;
}

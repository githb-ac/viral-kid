import Bottleneck from "bottleneck";

// Twitter API rate limits (per 15 minutes)
// https://developer.twitter.com/en/docs/twitter-api/rate-limits
export const twitterLimiter = new Bottleneck({
  reservoir: 15, // requests per window
  reservoirRefreshAmount: 15,
  reservoirRefreshInterval: 15 * 60 * 1000, // 15 minutes
  maxConcurrent: 1,
  minTime: 1000, // minimum 1 second between requests
});

// YouTube API rate limits (quota based, ~10,000 units/day)
// Search costs 100 units, so ~100 searches/day
export const youtubeLimiter = new Bottleneck({
  reservoir: 100,
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 24 * 60 * 60 * 1000, // 24 hours
  maxConcurrent: 2,
  minTime: 500,
});

// Instagram API rate limits
export const instagramLimiter = new Bottleneck({
  reservoir: 200,
  reservoirRefreshAmount: 200,
  reservoirRefreshInterval: 60 * 60 * 1000, // 1 hour
  maxConcurrent: 1,
  minTime: 500,
});

// OpenRouter rate limits (adjust based on your plan)
export const openRouterLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200, // 5 requests per second max
});

// Generic limiter factory for custom use cases
export function createRateLimiter(options: Bottleneck.ConstructorOptions) {
  return new Bottleneck(options);
}

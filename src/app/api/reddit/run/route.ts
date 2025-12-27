import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_API_BASE = "https://oauth.reddit.com";

async function createLog(
  accountId: string,
  level: "info" | "warning" | "error" | "success",
  message: string
) {
  await db.log.create({
    data: { accountId, level, message },
  });
}

interface RedditPost {
  id: string;
  name: string; // fullname like "t3_xxxxx"
  title: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  ups: number;
  num_comments: number;
  created_utc: number;
}

async function refreshTokenIfNeeded(
  accountId: string,
  credentials: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
  }
): Promise<string> {
  // Check if token expires within 5 minutes
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (
    credentials.tokenExpiresAt &&
    credentials.tokenExpiresAt > fiveMinutesFromNow
  ) {
    return credentials.accessToken;
  }

  if (!credentials.refreshToken) {
    throw new Error("No refresh token available");
  }

  const basicAuth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString("base64");

  const response = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      "User-Agent": "ViralKid/1.0.0",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  const data = await response.json();
  const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update tokens in database
  await db.redditCredentials.update({
    where: { accountId },
    data: {
      accessToken: data.access_token,
      tokenExpiresAt,
    },
  });

  return data.access_token;
}

async function fetchHotPosts(
  accessToken: string,
  subreddit: string,
  limit: number = 25
): Promise<RedditPost[]> {
  const response = await fetch(
    `${REDDIT_API_BASE}/r/${subreddit}/hot?limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "ViralKid/1.0.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status}`);
  }

  const data = await response.json();
  return data.data.children.map((child: { data: RedditPost }) => child.data);
}

async function postComment(
  accessToken: string,
  postFullname: string,
  text: string
): Promise<string> {
  const response = await fetch(`${REDDIT_API_BASE}/api/comment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ViralKid/1.0.0",
    },
    body: new URLSearchParams({
      thing_id: postFullname,
      text: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post comment: ${errorText}`);
  }

  const data = await response.json();
  // Reddit returns the comment in a nested structure
  const commentData = data?.json?.data?.things?.[0]?.data;
  return commentData?.name || "unknown";
}

async function generateReplyWithLLM(
  apiKey: string,
  model: string,
  systemPrompt: string,
  postTitle: string,
  postAuthor: string,
  subreddit: string,
  styleOptions: {
    noHashtags: boolean;
    noEmojis: boolean;
    noCapitalization: boolean;
    badGrammar: boolean;
  }
): Promise<string> {
  // Build style instructions
  const styleInstructions: string[] = [];
  if (styleOptions.noHashtags) styleInstructions.push("Do not use hashtags.");
  if (styleOptions.noEmojis) styleInstructions.push("Do not use emojis.");
  if (styleOptions.noCapitalization)
    styleInstructions.push("Use all lowercase letters.");
  if (styleOptions.badGrammar)
    styleInstructions.push("Use casual grammar with minor typos.");

  const fullSystemPrompt = [
    systemPrompt ||
      "You are a helpful Reddit user who provides thoughtful comments on posts.",
    "Keep your reply concise and relevant (under 500 characters).",
    "Be genuine and add value to the discussion.",
    "Match the tone of the subreddit - some are casual, some are more serious.",
    ...styleInstructions,
  ].join(" ");

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://viral-kid.app",
        "X-Title": "Viral Kid",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: fullSystemPrompt },
          {
            role: "user",
            content: `Write a comment for this Reddit post in r/${subreddit} by u/${postAuthor}:\n\nTitle: "${postTitle}"`,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${error}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error(
      `Empty response from LLM. Response: ${JSON.stringify(data)}`
    );
  }

  return reply.slice(0, 500);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Get account with all related data
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        redditCredentials: true,
        redditConfig: true,
        openRouterCredentials: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { redditCredentials, redditConfig, openRouterCredentials } = account;

    // Validate credentials
    if (!redditCredentials?.accessToken) {
      await createLog(accountId, "error", "Reddit OAuth not connected");
      return NextResponse.json(
        { error: "Reddit OAuth not connected" },
        { status: 400 }
      );
    }

    if (!redditConfig?.subreddit) {
      await createLog(accountId, "error", "No subreddit configured");
      return NextResponse.json(
        { error: "No subreddit configured" },
        { status: 400 }
      );
    }

    if (!openRouterCredentials?.apiKey) {
      await createLog(accountId, "error", "OpenRouter API key not configured");
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 400 }
      );
    }

    if (!openRouterCredentials?.selectedModel) {
      await createLog(accountId, "error", "No LLM model selected");
      return NextResponse.json(
        { error: "No LLM model selected" },
        { status: 400 }
      );
    }

    await createLog(accountId, "info", "Starting Reddit pipeline");

    // Refresh token if needed
    let accessToken: string;
    try {
      accessToken = await refreshTokenIfNeeded(accountId, {
        clientId: redditCredentials.clientId,
        clientSecret: redditCredentials.clientSecret,
        accessToken: redditCredentials.accessToken,
        refreshToken: redditCredentials.refreshToken,
        tokenExpiresAt: redditCredentials.tokenExpiresAt,
      });
    } catch (error) {
      await createLog(
        accountId,
        "error",
        `Token refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return NextResponse.json(
        { error: "Failed to refresh token" },
        { status: 401 }
      );
    }

    // Fetch hot posts from subreddit
    let posts: RedditPost[];
    try {
      posts = await fetchHotPosts(accessToken, redditConfig.subreddit);
      await createLog(
        accountId,
        "info",
        `Fetched ${posts.length} posts from r/${redditConfig.subreddit}`
      );
    } catch (error) {
      await createLog(
        accountId,
        "error",
        `Failed to fetch posts: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    // Get already replied posts
    const existingInteractions = await db.redditInteraction.findMany({
      where: { accountId },
      select: { postId: true },
    });
    const repliedPostIds = new Set(existingInteractions.map((i) => i.postId));

    // Filter posts: not already replied, minimum upvotes, not own posts
    const eligiblePosts = posts.filter(
      (post) =>
        !repliedPostIds.has(post.id) &&
        post.ups >= (redditConfig.minimumUpvotes || 10) &&
        post.author !== redditCredentials.username &&
        post.author !== "[deleted]"
    );

    if (eligiblePosts.length === 0) {
      await createLog(
        accountId,
        "info",
        "No eligible posts found (all already replied or below threshold)"
      );
      return NextResponse.json({
        replied: false,
        message: "No eligible posts found",
      });
    }

    // Pick the top post (highest upvotes)
    const sortedPosts = eligiblePosts.sort((a, b) => b.ups - a.ups);
    const targetPost = sortedPosts[0];

    if (!targetPost) {
      await createLog(accountId, "info", "No eligible posts after sorting");
      return NextResponse.json({
        replied: false,
        message: "No eligible posts found",
      });
    }

    await createLog(
      accountId,
      "info",
      `Selected post: "${targetPost.title.slice(0, 50)}..." by u/${targetPost.author} (${targetPost.ups} upvotes)`
    );

    // Generate reply using LLM
    let generatedReply: string;
    try {
      generatedReply = await generateReplyWithLLM(
        openRouterCredentials.apiKey,
        openRouterCredentials.selectedModel,
        openRouterCredentials.systemPrompt || "",
        targetPost.title,
        targetPost.author,
        targetPost.subreddit,
        {
          noHashtags: openRouterCredentials.noHashtags,
          noEmojis: openRouterCredentials.noEmojis,
          noCapitalization: openRouterCredentials.noCapitalization,
          badGrammar: openRouterCredentials.badGrammar,
        }
      );
      await createLog(
        accountId,
        "info",
        `Generated reply: "${generatedReply.slice(0, 50)}..."`
      );
    } catch (error) {
      await createLog(
        accountId,
        "error",
        `LLM generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return NextResponse.json(
        { error: "Failed to generate reply" },
        { status: 500 }
      );
    }

    // Post comment to Reddit
    let commentId: string;
    try {
      commentId = await postComment(
        accessToken,
        targetPost.name,
        generatedReply
      );
      await createLog(
        accountId,
        "success",
        `Posted comment on "${targetPost.title.slice(0, 30)}..."`
      );
    } catch (error) {
      await createLog(
        accountId,
        "error",
        `Failed to post comment: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return NextResponse.json(
        { error: "Failed to post comment" },
        { status: 500 }
      );
    }

    // Store interaction
    await db.redditInteraction.upsert({
      where: {
        accountId_postId: {
          accountId,
          postId: targetPost.id,
        },
      },
      create: {
        accountId,
        postId: targetPost.id,
        subreddit: targetPost.subreddit,
        postTitle: targetPost.title,
        postAuthor: targetPost.author,
        postUrl: `https://reddit.com${targetPost.permalink}`,
        upvotes: targetPost.ups,
        commentCount: targetPost.num_comments,
        ourComment: generatedReply,
        ourCommentId: commentId,
        repliedAt: new Date(),
      },
      update: {
        ourComment: generatedReply,
        ourCommentId: commentId,
        repliedAt: new Date(),
      },
    });

    // Cleanup old interactions (keep last 100)
    const oldInteractions = await db.redditInteraction.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      skip: 100,
      select: { id: true },
    });

    if (oldInteractions.length > 0) {
      await db.redditInteraction.deleteMany({
        where: {
          id: { in: oldInteractions.map((i) => i.id) },
        },
      });
    }

    return NextResponse.json({
      replied: true,
      repliedTo: targetPost.author,
      postTitle: targetPost.title,
      comment: generatedReply,
    });
  } catch (error) {
    console.error("Reddit pipeline error:", error);
    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }
}

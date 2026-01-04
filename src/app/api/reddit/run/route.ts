import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  refreshTokenIfNeeded,
  searchPosts,
  postComment,
  generateReply,
  type RedditPost,
} from "@/lib/reddit";

async function createLog(
  accountId: string,
  level: "info" | "warning" | "error" | "success",
  message: string
) {
  await db.log.create({
    data: { accountId, level, message },
  });
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

    // Check for cron secret (internal calls) or user session
    const cronSecret = request.headers.get("x-cron-secret");
    const isCronCall =
      cronSecret &&
      cronSecret === process.env.CRON_SECRET &&
      process.env.CRON_SECRET;

    let account;
    if (isCronCall) {
      // Cron job call - just get the account directly
      account = await db.account.findUnique({
        where: { id: accountId },
        include: {
          redditCredentials: true,
          redditConfig: true,
          openRouterCredentials: true,
        },
      });
    } else {
      // User call - verify session and ownership
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      account = await db.account.findFirst({
        where: { id: accountId, userId: session.user.id },
        include: {
          redditCredentials: true,
          redditConfig: true,
          openRouterCredentials: true,
        },
      });
    }

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

    if (!redditConfig?.keywords || redditConfig.keywords.trim() === "") {
      await createLog(accountId, "error", "No keywords configured");
      return NextResponse.json(
        { error: "No keywords configured" },
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
      const tokenResult = await refreshTokenIfNeeded({
        clientId: redditCredentials.clientId,
        clientSecret: redditCredentials.clientSecret,
        accessToken: redditCredentials.accessToken,
        refreshToken: redditCredentials.refreshToken,
        tokenExpiresAt: redditCredentials.tokenExpiresAt,
      });

      if (!tokenResult) {
        throw new Error("No refresh token available");
      }

      accessToken = tokenResult.accessToken;

      // Update token in database if refreshed
      if (tokenResult.expiresAt !== redditCredentials.tokenExpiresAt) {
        await db.redditCredentials.update({
          where: { accountId },
          data: {
            accessToken: tokenResult.accessToken,
            tokenExpiresAt: tokenResult.expiresAt,
          },
        });
      }
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

    // Search for posts by keywords
    const keywords = redditConfig.keywords;
    const timeRange = redditConfig.timeRange || "day";

    let posts: RedditPost[];
    try {
      posts = await searchPosts(accessToken, { keywords, timeRange });
      await createLog(
        accountId,
        "info",
        `Found ${posts.length} posts for keywords: "${keywords}" (${timeRange})`
      );
    } catch (error) {
      await createLog(
        accountId,
        "error",
        `Failed to search posts: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return NextResponse.json(
        { error: "Failed to search posts" },
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
      generatedReply = await generateReply({
        apiKey: openRouterCredentials.apiKey,
        model: openRouterCredentials.selectedModel,
        systemPrompt: openRouterCredentials.systemPrompt || "",
        postTitle: targetPost.title,
        postBody: targetPost.selftext || "",
        postAuthor: targetPost.author,
        subreddit: targetPost.subreddit,
        styleOptions: {
          noHashtags: openRouterCredentials.noHashtags,
          noEmojis: openRouterCredentials.noEmojis,
          noCapitalization: openRouterCredentials.noCapitalization,
          badGrammar: openRouterCredentials.badGrammar,
        },
      });
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
    try {
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
    } catch (dbError) {
      console.error("Failed to store interaction:", dbError);
      // Comment was posted successfully, just log the DB error
      await createLog(
        accountId,
        "warning",
        "Comment posted but failed to record in database"
      );
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

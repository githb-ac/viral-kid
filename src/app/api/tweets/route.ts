import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: getEffectiveUserId(session)! },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const tweets = await db.tweetInteraction.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(tweets);
  } catch (error) {
    console.error("Failed to fetch tweets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tweets" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      accountId,
      tweetId,
      userTweet,
      username,
      views,
      hearts,
      ourReply,
      ourReplyId,
    } = body;

    if (!accountId || !tweetId || !userTweet || !username) {
      return NextResponse.json(
        { error: "accountId, tweetId, userTweet, and username are required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: getEffectiveUserId(session)! },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const tweet = await db.tweetInteraction.upsert({
      where: {
        accountId_tweetId: { accountId, tweetId },
      },
      update: {
        userTweet,
        username,
        views: views ?? 0,
        hearts: hearts ?? 0,
        ourReply,
        ourReplyId,
        repliedAt: ourReply ? new Date() : undefined,
      },
      create: {
        accountId,
        tweetId,
        userTweet,
        username,
        views: views ?? 0,
        hearts: hearts ?? 0,
        ourReply,
        ourReplyId,
        repliedAt: ourReply ? new Date() : null,
      },
    });

    return NextResponse.json(tweet);
  } catch (error) {
    console.error("Failed to save tweet:", error);
    return NextResponse.json(
      { error: "Failed to save tweet" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const tweetId = searchParams.get("id");

    if (tweetId) {
      // Delete single tweet - verify ownership through account
      const tweet = await db.tweetInteraction.findUnique({
        where: { id: tweetId },
        include: { account: true },
      });
      if (!tweet || tweet.account.userId !== session.user.id) {
        return NextResponse.json({ error: "Tweet not found" }, { status: 404 });
      }
      await db.tweetInteraction.delete({
        where: { id: tweetId },
      });
    } else if (accountId) {
      // Verify account belongs to user
      const account = await db.account.findFirst({
        where: { id: accountId, userId: getEffectiveUserId(session)! },
      });
      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
      // Delete all tweets for account
      await db.tweetInteraction.deleteMany({
        where: { accountId },
      });
    } else {
      return NextResponse.json(
        { error: "accountId or id is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tweet(s):", error);
    return NextResponse.json(
      { error: "Failed to delete tweet(s)" },
      { status: 500 }
    );
  }
}

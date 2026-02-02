import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, getEffectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRecentPosts } from "@/lib/instagram";

/**
 * GET /api/instagram/posts?accountId=...
 * Fetch recent posts from Instagram account for post selector dropdown
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  // Verify account belongs to user and get credentials
  const account = await db.account.findFirst({
    where: { id: accountId, userId: getEffectiveUserId(session)! },
    include: { instagramCredentials: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const credentials = account.instagramCredentials;
  if (!credentials?.accessToken || !credentials?.instagramAccountId) {
    return NextResponse.json(
      { error: "Instagram not connected" },
      { status: 400 }
    );
  }

  try {
    const posts = await getRecentPosts(
      credentials.accessToken,
      credentials.instagramAccountId,
      25 // Fetch last 25 posts
    );

    // Get existing automations to mark which posts already have automations
    const existingAutomations = await db.instagramAutomation.findMany({
      where: { accountId },
      select: { postId: true },
    });

    const automatedPostIds = new Set(existingAutomations.map((a) => a.postId));

    // Add hasAutomation flag to each post
    const postsWithStatus = posts.map((post) => ({
      ...post,
      hasAutomation: automatedPostIds.has(post.id),
    }));

    return NextResponse.json(postsWithStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch posts: ${message}` },
      { status: 500 }
    );
  }
}

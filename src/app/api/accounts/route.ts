import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

interface AccountWithCredentials {
  id: string;
  platform: string;
  name: string;
  order: number;
  twitterCredentials: {
    username: string | null;
    accessToken: string | null;
    rapidApiKey: string | null;
  } | null;
  twitterConfig: {
    enabled: boolean;
    searchTerm: string | null;
  } | null;
  youtubeCredentials: {
    channelTitle: string | null;
    accessToken: string | null;
  } | null;
  youtubeConfig: {
    enabled: boolean;
  } | null;
  instagramCredentials: {
    instagramUsername: string | null;
    accessToken: string | null;
  } | null;
  redditCredentials: {
    username: string | null;
    accessToken: string | null;
  } | null;
  redditConfig: {
    enabled: boolean;
    subreddit: string | null;
  } | null;
  openRouterCredentials: {
    apiKey: string | null;
    selectedModel: string | null;
  } | null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await db.account.findMany({
      where: { userId: session.user.id },
      orderBy: { order: "asc" },
      include: {
        twitterCredentials: {
          select: {
            username: true,
            accessToken: true,
            rapidApiKey: true,
          },
        },
        twitterConfig: {
          select: {
            enabled: true,
            searchTerm: true,
          },
        },
        youtubeCredentials: {
          select: {
            channelTitle: true,
            accessToken: true,
          },
        },
        youtubeConfig: {
          select: {
            enabled: true,
          },
        },
        instagramCredentials: {
          select: {
            instagramUsername: true,
            accessToken: true,
          },
        },
        redditCredentials: {
          select: {
            username: true,
            accessToken: true,
          },
        },
        redditConfig: {
          select: {
            enabled: true,
            subreddit: true,
          },
        },
        openRouterCredentials: {
          select: {
            apiKey: true,
            selectedModel: true,
          },
        },
      },
    });

    // Transform to a simpler format for the frontend
    const formattedAccounts = accounts.map(
      (account: AccountWithCredentials) => {
        let isConnected = false;
        let displayName: string | null = null;
        let hasApiKey = false; // Platform-specific API (RapidAPI for Twitter)
        let hasSearchTerm = false; // Twitter-specific search term
        let isAutomationEnabled = false; // Whether scheduled automation is active

        if (account.platform === "twitter") {
          isConnected = !!account.twitterCredentials?.accessToken;
          displayName = account.twitterCredentials?.username
            ? `@${account.twitterCredentials.username}`
            : null;
          hasApiKey = !!account.twitterCredentials?.rapidApiKey;
          hasSearchTerm = !!account.twitterConfig?.searchTerm?.trim();
          isAutomationEnabled = account.twitterConfig?.enabled ?? false;
        } else if (account.platform === "youtube") {
          isConnected = !!account.youtubeCredentials?.accessToken;
          displayName = account.youtubeCredentials?.channelTitle || null;
          hasApiKey = true; // YouTube doesn't need extra API key for now
          hasSearchTerm = true; // YouTube doesn't need search term
          isAutomationEnabled = account.youtubeConfig?.enabled ?? false;
        } else if (account.platform === "instagram") {
          isConnected = !!account.instagramCredentials?.accessToken;
          displayName = account.instagramCredentials?.instagramUsername
            ? `@${account.instagramCredentials.instagramUsername}`
            : null;
          hasApiKey = true; // Instagram doesn't need extra API key for now
          hasSearchTerm = true; // Instagram doesn't need search term
          isAutomationEnabled = false; // TODO: Add when Instagram config has enabled field
        } else if (account.platform === "reddit") {
          isConnected = !!account.redditCredentials?.accessToken;
          displayName = account.redditCredentials?.username
            ? `u/${account.redditCredentials.username}`
            : null;
          hasApiKey = true; // Reddit doesn't need extra API key
          hasSearchTerm = !!account.redditConfig?.subreddit?.trim(); // Subreddit is like search term
          isAutomationEnabled = account.redditConfig?.enabled ?? false;
        }

        // OpenRouter credentials (shared across platforms)
        const hasOpenRouterKey = !!account.openRouterCredentials?.apiKey;
        const hasLlmModel = !!account.openRouterCredentials?.selectedModel;

        // Ready to run = all required credentials configured
        const isReady =
          isConnected &&
          hasApiKey &&
          hasSearchTerm &&
          hasOpenRouterKey &&
          hasLlmModel;

        return {
          id: account.id,
          platform: account.platform,
          name: account.name,
          order: account.order,
          isConnected,
          displayName,
          setup: {
            oauth: isConnected,
            apiKey: hasApiKey,
            searchTerm: hasSearchTerm,
            openRouter: hasOpenRouterKey,
            llmModel: hasLlmModel,
          },
          isReady,
          isAutomationEnabled,
        };
      }
    );

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
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
    const { platform } = body;

    if (
      !platform ||
      !["twitter", "youtube", "instagram", "reddit"].includes(platform)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid platform. Must be 'twitter', 'youtube', 'instagram', or 'reddit'",
        },
        { status: 400 }
      );
    }

    // Get the highest order value for this user
    const lastAccount = await db.account.findFirst({
      where: { userId: session.user.id },
      orderBy: { order: "desc" },
    });
    const newOrder = (lastAccount?.order ?? -1) + 1;

    // Create the account with its related credentials and config
    const platformData =
      platform === "twitter"
        ? {
            twitterCredentials: { create: {} },
            twitterConfig: { create: {} },
          }
        : platform === "youtube"
          ? {
              youtubeCredentials: { create: {} },
              youtubeConfig: { create: {} },
            }
          : platform === "instagram"
            ? {
                instagramCredentials: { create: {} },
                instagramConfig: { create: {} },
              }
            : {
                redditCredentials: { create: {} },
                redditConfig: { create: {} },
              };

    const account = await db.account.create({
      data: {
        platform,
        order: newOrder,
        userId: session.user.id,
        ...platformData,
      },
      include: {
        twitterCredentials: true,
        twitterConfig: true,
        youtubeCredentials: true,
        youtubeConfig: true,
        instagramCredentials: true,
        instagramConfig: true,
        redditCredentials: true,
        redditConfig: true,
      },
    });

    return NextResponse.json({
      id: account.id,
      platform: account.platform,
      name: account.name,
      order: account.order,
      isConnected: false,
      displayName: null,
    });
  } catch (error) {
    console.error("Failed to create account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

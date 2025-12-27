import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Reddit OAuth 2.0 endpoints
const REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/authorize";

// Reddit API scopes for reading posts and posting comments
const REDDIT_SCOPES = "identity read submit";

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export async function GET(request: Request) {
  try {
    const reqUrl = new URL(request.url);
    const accountId = reqUrl.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const credentials = await db.redditCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials?.clientId) {
      return NextResponse.json(
        { error: "Reddit OAuth credentials not configured" },
        { status: 400 }
      );
    }

    const callbackUrl = `${reqUrl.origin}/api/reddit/callback`;

    // Generate state for CSRF protection
    const state = generateState();

    // Build the authorization URL
    const authParams = new URLSearchParams({
      client_id: credentials.clientId,
      response_type: "code",
      state: state,
      redirect_uri: callbackUrl,
      duration: "permanent", // Request refresh token
      scope: REDDIT_SCOPES,
    });

    const authUrl = `${REDDIT_AUTH_URL}?${authParams.toString()}`;

    // Return the auth URL and store state in cookies
    const response = NextResponse.json({ authUrl });

    response.cookies.set("reddit_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Store accountId in cookie so callback knows which account to update
    response.cookies.set("reddit_account_id", accountId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Reddit OAuth init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize OAuth" },
      { status: 500 }
    );
  }
}

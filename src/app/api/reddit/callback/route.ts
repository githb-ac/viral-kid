import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

// Timing-safe state comparison to prevent timing attacks
function isValidState(
  state: string | null,
  storedState: string | undefined
): boolean {
  if (!state || !storedState) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(state), Buffer.from(storedState));
  } catch {
    return false;
  }
}

// Reddit OAuth 2.0 token endpoint
const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_ME_URL = "https://oauth.reddit.com/api/v1/me";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Reddit OAuth error:", error);
      return NextResponse.redirect(
        new URL("/?error=reddit_oauth_denied", url.origin)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/?error=reddit_missing_params", url.origin)
      );
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get("reddit_oauth_state")?.value;
    const accountId = cookieStore.get("reddit_account_id")?.value;

    if (!isValidState(state, storedState)) {
      return NextResponse.redirect(
        new URL("/?error=reddit_state_mismatch", url.origin)
      );
    }

    if (!accountId) {
      return NextResponse.redirect(
        new URL("/?error=reddit_missing_account", url.origin)
      );
    }

    const credentials = await db.redditCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials?.clientId || !credentials?.clientSecret) {
      return NextResponse.redirect(
        new URL("/?error=reddit_no_credentials", url.origin)
      );
    }

    const callbackUrl = `${url.origin}/api/reddit/callback`;

    // Reddit requires Basic Auth for token exchange
    const basicAuth = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`
    ).toString("base64");

    // Exchange code for tokens
    const tokenResponse = await fetch(REDDIT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
        "User-Agent": "ViralKid/1.0.0",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        new URL("/?error=reddit_token_exchange_failed", url.origin)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get the user's Reddit info
    const meResponse = await fetch(REDDIT_ME_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "ViralKid/1.0.0",
      },
    });

    if (!meResponse.ok) {
      console.error("Failed to fetch Reddit user info");
      return NextResponse.redirect(
        new URL("/?error=reddit_user_fetch_failed", url.origin)
      );
    }

    const userData = await meResponse.json();

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Save tokens and user info
    await db.redditCredentials.update({
      where: { accountId },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
        redditUserId: userData.id,
        username: userData.name,
      },
    });

    // Clear the OAuth cookies
    const response = NextResponse.redirect(
      new URL("/?success=reddit_connected", url.origin)
    );

    response.cookies.delete("reddit_oauth_state");
    response.cookies.delete("reddit_account_id");

    return response;
  } catch (error) {
    console.error("Reddit OAuth callback error:", error);
    const url = new URL(request.url);
    return NextResponse.redirect(
      new URL("/?error=reddit_oauth_failed", url.origin)
    );
  }
}

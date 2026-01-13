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

// Google OAuth 2.0 token endpoint
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("YouTube OAuth error:", error);
      return NextResponse.redirect(
        new URL("/?error=youtube_oauth_denied", url.origin)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/?error=youtube_missing_params", url.origin)
      );
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get("youtube_oauth_state")?.value;
    const accountId = cookieStore.get("youtube_account_id")?.value;

    if (!isValidState(state, storedState)) {
      return NextResponse.redirect(
        new URL("/?error=youtube_state_mismatch", url.origin)
      );
    }

    if (!accountId) {
      return NextResponse.redirect(
        new URL("/?error=youtube_missing_account", url.origin)
      );
    }

    const credentials = await db.youTubeCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials?.clientId || !credentials?.clientSecret) {
      return NextResponse.redirect(
        new URL("/?error=youtube_no_credentials", url.origin)
      );
    }

    const callbackUrl = `${url.origin}/api/youtube/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        new URL("/?error=youtube_token_exchange_failed", url.origin)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get the user's channel info
    const channelResponse = await fetch(YOUTUBE_CHANNELS_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!channelResponse.ok) {
      console.error("Failed to fetch channel info");
      return NextResponse.redirect(
        new URL("/?error=youtube_channel_fetch_failed", url.origin)
      );
    }

    const channelData = await channelResponse.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      return NextResponse.redirect(
        new URL("/?error=youtube_no_channel", url.origin)
      );
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Save tokens and channel info
    await db.youTubeCredentials.update({
      where: { accountId },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
        channelId: channel.id,
        channelTitle: channel.snippet?.title,
      },
    });

    // Clear the OAuth cookies
    const response = NextResponse.redirect(
      new URL("/?success=youtube_connected", url.origin)
    );

    response.cookies.delete("youtube_oauth_state");
    response.cookies.delete("youtube_account_id");

    return response;
  } catch (error) {
    console.error("YouTube OAuth callback error:", error);
    const url = new URL(request.url);
    return NextResponse.redirect(
      new URL("/?error=youtube_oauth_failed", url.origin)
    );
  }
}

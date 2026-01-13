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

// Facebook/Instagram Graph API endpoints
const FACEBOOK_TOKEN_URL =
  "https://graph.facebook.com/v21.0/oauth/access_token";
const FACEBOOK_PAGES_URL = "https://graph.facebook.com/v21.0/me/accounts";

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username: string;
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Instagram OAuth error:", error);
      return NextResponse.redirect(
        new URL("/?error=instagram_oauth_denied", url.origin)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/?error=instagram_missing_params", url.origin)
      );
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get("instagram_oauth_state")?.value;
    const accountId = cookieStore.get("instagram_account_id")?.value;

    if (!isValidState(state, storedState)) {
      return NextResponse.redirect(
        new URL("/?error=instagram_state_mismatch", url.origin)
      );
    }

    if (!accountId) {
      return NextResponse.redirect(
        new URL("/?error=instagram_missing_account", url.origin)
      );
    }

    const credentials = await db.instagramCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials?.appId || !credentials?.appSecret) {
      return NextResponse.redirect(
        new URL("/?error=instagram_no_credentials", url.origin)
      );
    }

    const callbackUrl = `${url.origin}/api/instagram/callback`;

    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      client_id: credentials.appId,
      client_secret: credentials.appSecret,
      code: code,
      redirect_uri: callbackUrl,
    });

    const tokenResponse = await fetch(
      `${FACEBOOK_TOKEN_URL}?${tokenParams.toString()}`
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        new URL("/?error=instagram_token_exchange_failed", url.origin)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    // Get user's Facebook Pages with Instagram accounts
    const pagesResponse = await fetch(
      `${FACEBOOK_PAGES_URL}?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${access_token}`
    );

    if (!pagesResponse.ok) {
      console.error("Failed to fetch Facebook Pages");
      return NextResponse.redirect(
        new URL("/?error=instagram_pages_fetch_failed", url.origin)
      );
    }

    const pagesData = await pagesResponse.json();
    const pages: FacebookPage[] = pagesData.data || [];

    // Find the first page with an Instagram Business Account
    const pageWithInstagram = pages.find(
      (page) => page.instagram_business_account
    );

    if (!pageWithInstagram || !pageWithInstagram.instagram_business_account) {
      return NextResponse.redirect(
        new URL("/?error=instagram_no_business_account", url.origin)
      );
    }

    // Calculate token expiration (Facebook tokens typically last 60 days)
    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // Default 60 days

    // Save tokens and Instagram account info
    await db.instagramCredentials.update({
      where: { accountId },
      data: {
        accessToken: pageWithInstagram.access_token, // Use Page access token for Instagram API
        tokenExpiresAt,
        instagramAccountId: pageWithInstagram.instagram_business_account.id,
        instagramUsername:
          pageWithInstagram.instagram_business_account.username,
        facebookPageId: pageWithInstagram.id,
        facebookPageName: pageWithInstagram.name,
      },
    });

    // Clear the OAuth cookies
    const response = NextResponse.redirect(
      new URL("/?success=instagram_connected", url.origin)
    );

    response.cookies.delete("instagram_oauth_state");
    response.cookies.delete("instagram_account_id");

    return response;
  } catch (error) {
    console.error("Instagram OAuth callback error:", error);
    const url = new URL(request.url);
    return NextResponse.redirect(
      new URL("/?error=instagram_oauth_failed", url.origin)
    );
  }
}

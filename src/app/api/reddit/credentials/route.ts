import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const credentials = await db.redditCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials) {
      return NextResponse.json(
        { error: "Credentials not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: credentials.id,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret ? "••••••••" : "",
      redditUsername: credentials.username,
      isConnected: !!credentials.accessToken,
    });
  } catch (error) {
    console.error("Failed to fetch Reddit credentials:", error);
    return NextResponse.json(
      { error: "Failed to fetch credentials" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { clientId, clientSecret } = body;

    const updateData: Record<string, string> = {};

    if (clientId !== undefined) updateData.clientId = clientId;
    if (clientSecret && clientSecret !== "••••••••")
      updateData.clientSecret = clientSecret;

    const credentials = await db.redditCredentials.update({
      where: { accountId },
      data: updateData,
    });

    return NextResponse.json({
      id: credentials.id,
      clientId: credentials.clientId,
      redditUsername: credentials.username,
      isConnected: !!credentials.accessToken,
    });
  } catch (error) {
    console.error("Failed to save Reddit credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, enabled } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    // Update the configuration
    const config = await db.twitterConfiguration.update({
      where: { accountId },
      data: { enabled },
    });

    // Log the action
    await db.log.create({
      data: {
        accountId,
        level: "info",
        message: enabled ? "Automation enabled" : "Automation disabled",
      },
    });

    return NextResponse.json({
      success: true,
      enabled: config.enabled,
    });
  } catch (error) {
    console.error("Failed to toggle automation:", error);
    return NextResponse.json(
      { error: "Failed to toggle automation" },
      { status: 500 }
    );
  }
}

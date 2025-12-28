import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_RETENTION_DAYS = 14;
const INTERACTION_RETENTION_DAYS = 30;

export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Running cleanup cron job...");

    const logCutoff = new Date();
    logCutoff.setDate(logCutoff.getDate() - LOG_RETENTION_DAYS);

    const interactionCutoff = new Date();
    interactionCutoff.setDate(
      interactionCutoff.getDate() - INTERACTION_RETENTION_DAYS
    );

    // Clean up old logs
    const deletedLogs = await db.log.deleteMany({
      where: { createdAt: { lt: logCutoff } },
    });

    // Clean up old tweet interactions (unreplied only - keep replied ones longer)
    const deletedTweets = await db.tweetInteraction.deleteMany({
      where: {
        createdAt: { lt: interactionCutoff },
        ourReply: null,
      },
    });

    // Clean up old YouTube interactions (unreplied only)
    const deletedYouTube = await db.youTubeCommentInteraction.deleteMany({
      where: {
        createdAt: { lt: interactionCutoff },
        ourReply: null,
      },
    });

    // Clean up old Reddit interactions (unreplied only)
    const deletedReddit = await db.redditInteraction.deleteMany({
      where: {
        createdAt: { lt: interactionCutoff },
        ourComment: null,
      },
    });

    const summary = {
      logs: deletedLogs.count,
      tweetInteractions: deletedTweets.count,
      youtubeInteractions: deletedYouTube.count,
      redditInteractions: deletedReddit.count,
    };

    console.log("Cleanup completed:", summary);

    return NextResponse.json({
      success: true,
      deleted: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup data" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * YouTube Trends Cron Job
 *
 * Note: YouTube automation is handled by /api/cron/youtube-comments which runs every 5 minutes.
 * This endpoint is kept for backwards compatibility but performs no action.
 * Consider removing this from vercel.json if not needed.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // YouTube automation is handled by youtube-comments cron
  // This endpoint is a no-op kept for backwards compatibility
  return NextResponse.json({
    success: true,
    message: "No-op: YouTube automation handled by youtube-comments cron",
    timestamp: new Date().toISOString(),
  });
}

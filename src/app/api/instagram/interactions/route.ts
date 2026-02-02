import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, getEffectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/instagram/interactions?accountId=...&automationId=...
 * List interactions for an account or specific automation
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  const automationId = request.nextUrl.searchParams.get("automationId");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

  if (!accountId) {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  // Verify account belongs to user
  const account = await db.account.findFirst({
    where: { id: accountId, userId: getEffectiveUserId(session)! },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const interactions = await db.instagramInteraction.findMany({
    where: {
      accountId,
      ...(automationId ? { automationId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    include: {
      automation: {
        select: {
          postId: true,
          postCaption: true,
        },
      },
    },
  });

  return NextResponse.json(interactions);
}

/**
 * DELETE /api/instagram/interactions?accountId=...&automationId=...
 * Clear interactions for an account or specific automation
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  const automationId = request.nextUrl.searchParams.get("automationId");

  if (!accountId) {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  // Verify account belongs to user
  const account = await db.account.findFirst({
    where: { id: accountId, userId: getEffectiveUserId(session)! },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const deleteResult = await db.instagramInteraction.deleteMany({
    where: {
      accountId,
      ...(automationId ? { automationId } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    deleted: deleteResult.count,
  });
}

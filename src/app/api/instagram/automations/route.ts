import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, getEffectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateTemplates, serializeTemplates } from "@/lib/instagram";

/**
 * GET /api/instagram/automations?accountId=...
 * List all automations for an account
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
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

  const automations = await db.instagramAutomation.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { interactions: true },
      },
    },
  });

  return NextResponse.json(automations);
}

/**
 * POST /api/instagram/automations?accountId=...
 * Create a new automation
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
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

  const body = await request.json();
  const {
    postId,
    postUrl,
    postCaption,
    keywords,
    commentTemplates,
    dmTemplates,
    dmDelay,
    enabled,
  } = body;

  // Validate required fields
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  // Check if automation already exists for this post
  const existing = await db.instagramAutomation.findUnique({
    where: {
      accountId_postId: { accountId, postId },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Automation already exists for this post" },
      { status: 409 }
    );
  }

  // Validate templates if provided
  if (commentTemplates && !validateTemplates(commentTemplates)) {
    return NextResponse.json(
      { error: "Invalid comment templates format" },
      { status: 400 }
    );
  }

  if (dmTemplates && !validateTemplates(dmTemplates)) {
    return NextResponse.json(
      { error: "Invalid DM templates format" },
      { status: 400 }
    );
  }

  // Create automation
  const automation = await db.instagramAutomation.create({
    data: {
      accountId,
      postId,
      postUrl: postUrl || "",
      postCaption: postCaption || "",
      keywords: keywords || "",
      commentTemplates: commentTemplates
        ? serializeTemplates(commentTemplates)
        : "[]",
      dmTemplates: dmTemplates ? serializeTemplates(dmTemplates) : "[]",
      dmDelay: typeof dmDelay === "number" ? dmDelay : 60,
      enabled: enabled !== false,
    },
  });

  return NextResponse.json(automation, { status: 201 });
}

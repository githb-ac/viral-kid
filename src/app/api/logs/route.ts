import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const logs = await db.log.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, level, message, metadata } = body;

    if (!accountId || !level || !message) {
      return NextResponse.json(
        { error: "accountId, level, and message are required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!["info", "warning", "error", "success"].includes(level)) {
      return NextResponse.json(
        { error: "level must be one of: info, warning, error, success" },
        { status: 400 }
      );
    }

    const log = await db.log.create({
      data: {
        accountId,
        level,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error("Failed to create log:", error);
    return NextResponse.json(
      { error: "Failed to create log" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await db.log.deleteMany({
      where: { accountId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear logs:", error);
    return NextResponse.json(
      { error: "Failed to clear logs" },
      { status: 500 }
    );
  }
}

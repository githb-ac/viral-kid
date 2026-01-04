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

    const interactions = await db.redditInteraction.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(interactions);
  } catch (error) {
    console.error("Failed to fetch Reddit interactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch interactions" },
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
    const interactionId = searchParams.get("id");

    if (interactionId) {
      // Delete single interaction - verify ownership through account
      const interaction = await db.redditInteraction.findUnique({
        where: { id: interactionId },
        include: { account: true },
      });
      if (!interaction || interaction.account.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Interaction not found" },
          { status: 404 }
        );
      }
      await db.redditInteraction.delete({
        where: { id: interactionId },
      });
    } else if (accountId) {
      // Verify account belongs to user
      const account = await db.account.findFirst({
        where: { id: accountId, userId: session.user.id },
      });
      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
      // Delete all interactions for account
      await db.redditInteraction.deleteMany({
        where: { accountId },
      });
    } else {
      return NextResponse.json(
        { error: "accountId or id is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete Reddit interaction(s):", error);
    return NextResponse.json(
      { error: "Failed to delete interaction(s)" },
      { status: 500 }
    );
  }
}

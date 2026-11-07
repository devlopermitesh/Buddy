import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [workspaces, users, posts] = await Promise.all([
      db.workspace.count({ where: { deletedAt: null } }),
      db.user.count({ where: { isActive: true } }),
      db.post.count({ where: { deletedAt: null } }),
    ]);
    return NextResponse.json({
      status: "ok",
      service: "socialflow",
      time: new Date().toISOString(),
      counts: { workspaces, users, posts },
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

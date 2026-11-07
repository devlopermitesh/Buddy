import { NextRequest, NextResponse } from "next/server";
import { processDuePublishJobs } from "@/lib/publishing";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const processed = await processDuePublishJobs(50);
  return NextResponse.json({ ok: true, processed, time: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

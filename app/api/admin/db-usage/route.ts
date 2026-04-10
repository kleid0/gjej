import { NextRequest, NextResponse } from "next/server";
import { getQueryCount } from "@/src/infrastructure/db/client";

export const dynamic = "force-dynamic";

// GET /api/admin/db-usage
// Returns the current query counter for monitoring DB operation usage.
// Helps track whether we're approaching provider quota limits.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count, since } = getQueryCount();

  return NextResponse.json({
    queries: count,
    since,
    timestamp: new Date().toISOString(),
  });
}

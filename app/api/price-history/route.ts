import { NextRequest, NextResponse } from "next/server";
import { getPriceHistory } from "@/src/infrastructure/db/PriceHistoryRepository";
import { createLogger } from "@/src/infrastructure/logging/logger";
import { withRequestLog } from "@/src/infrastructure/logging/withRequestLog";

const log = createLogger("api/price-history");

export const GET = withRequestLog("price-history", async (req: NextRequest) => {
  const productId = req.nextUrl.searchParams.get("product");
  if (!productId) {
    return NextResponse.json({ error: "Missing product" }, { status: 400 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = Math.min(365, Math.max(30, parseInt(daysParam ?? "365", 10) || 365));

  try {
    const { rows, daysOldest } = await getPriceHistory(productId, days);
    return NextResponse.json({
      history: rows,
      hasEnoughData: daysOldest >= 30,
      daysOldest,
    });
  } catch (err) {
    log.error("query failed", { productId, days, err });
    return NextResponse.json({ history: [], hasEnoughData: false, daysOldest: 0 });
  }
});

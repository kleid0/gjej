import { NextRequest, NextResponse } from "next/server";
import { productCatalog, productRepo } from "@/src/infrastructure/container";
import { guessCategory } from "@/src/infrastructure/scrapers/ProductDiscovery";
import { takeDirtyFiles } from "@/src/infrastructure/persistence/JsonStore";
import { commitDirtyFiles } from "@/src/infrastructure/git/commitDataFiles";

// Allow up to 5 minutes for the bulk update
export const maxDuration = 300;

// POST /api/admin/recategorize
// Re-runs guessCategory on every product using the stored product name
// (family field) and writes the corrected category + subcategory back to
// data/discovered-products.json (committed via the GitHub helper).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { key?: string };
  if (!process.env.CRON_SECRET || body.key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await productCatalog.getAllProducts();
  if (!products.length) {
    return NextResponse.json({ ok: true, updated: 0, total: 0 });
  }

  let updated = 0;
  const dist: Record<string, number> = {};
  const next = products.map((p) => {
    const { category, subcategory } = guessCategory(p.family ?? "");
    if (category !== p.category || subcategory !== p.subcategory) updated++;
    dist[category] = (dist[category] ?? 0) + 1;
    return { ...p, category, subcategory };
  });

  await productRepo.saveAll(next);

  const commitSha = await commitDirtyFiles(
    takeDirtyFiles(),
    `chore(data): recategorize ${updated} products`,
  ).catch((err) => {
    console.error("[recategorize] commit failed:", err);
    return null;
  });

  return NextResponse.json({
    ok: true,
    total: products.length,
    updated,
    distribution: dist,
    commitSha,
    timestamp: new Date().toISOString(),
  });
}

import type { Metadata } from "next";
import Link from "next/link";
import { productCatalog, priceQuery } from "@/src/infrastructure/container";
import { getProductLowestPrices } from "@/src/infrastructure/db/PriceHistoryRepository";
import { STORE_MAP } from "@/src/infrastructure/stores/registry";
import { readTrendsCache } from "@/src/infrastructure/trends/TrendsService";
import ProductCard from "@/components/ProductCard";
import FlipBoard from "@/components/FlipBoard";
import SearchAutocomplete from "@/components/SearchAutocomplete";

export const metadata: Metadata = {
  title: "Gjej.al – Krahasimi i Çmimeve në Shqipëri",
  description:
    "Gjej çmimin më të mirë për produktet tuaja. Krahaso çmimet nga Foleja, Shpresa, Neptun, Globe Albania dhe AlbaGame.",
  alternates: { canonical: "https://gjej.al" },
};

// Revalidate homepage every 30 minutes — cached prices refresh daily
export const revalidate = 1800;

export default async function Home() {
  const [allProducts, allPrices, dbPrices] = await Promise.all([
    productCatalog.getAllProducts(),
    priceQuery.getAllCachedPrices(),
    getProductLowestPrices(),
  ]);

  // Score each product by store coverage and stock as a baseline
  const scoredProducts = allProducts.map((product) => {
    const record = allPrices[product.id];
    let storeCount = 0;
    let hasStock = false;
    if (record) {
      const valid = record.prices.filter(
        (p) => p.price !== null && !p.suspicious && !p.overpriced && !p.stale,
      );
      storeCount = valid.length;
      hasStock = valid.some((p) => p.inStock === true);
    } else if (dbPrices[product.id]) {
      storeCount = 1;
    }
    return { product, storeCount, hasStock };
  });

  // Use Google Trends scores if a fresh cache exists; otherwise fall back to
  // store-coverage ranking with a daily rotation so the set changes each day.
  const trendsCache = readTrendsCache();
  const trendsScores = trendsCache?.scores ?? {};
  const hasTrendsData = Object.values(trendsScores).some((s) => s > 0);

  let featured;
  if (hasTrendsData) {
    featured = scoredProducts
      .sort((a, b) => (trendsScores[b.product.id] ?? 0) - (trendsScores[a.product.id] ?? 0))
      .slice(0, 8)
      .map((s) => s.product);
  } else {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    const POOL = 24;
    const PAGE = 8;
    const windowIdx = dayOfYear % (POOL / PAGE);
    featured = scoredProducts
      .sort((a, b) => {
        if (a.hasStock !== b.hasStock) return a.hasStock ? -1 : 1;
        return b.storeCount - a.storeCount;
      })
      .slice(0, POOL)
      .slice(windowIdx * PAGE, (windowIdx + 1) * PAGE)
      .map((s) => s.product);
  }

  // Build lowest-price map: prefer fresh file cache, fall back to DB lowest_price
  const lowestPriceMap: Record<string, { price: number; storeName: string } | null> = {};
  for (const product of allProducts) {
    const record = allPrices[product.id];
    if (record) {
      const valid = record.prices.filter(
        (p) => p.price !== null && !p.suspicious && !p.overpriced,
      );
      if (valid.length) {
        const best = valid.reduce((a, b) => a.price! < b.price! ? a : b);
        const store = STORE_MAP[best.storeId];
        lowestPriceMap[product.id] = { price: best.price!, storeName: store?.name ?? best.storeId };
      } else {
        // File cache has no valid prices — fall back to DB last-known price
        const price = dbPrices[product.id] ?? null;
        lowestPriceMap[product.id] = price !== null ? { price, storeName: "" } : null;
      }
    } else {
      const price = dbPrices[product.id] ?? null;
      lowestPriceMap[product.id] = price !== null ? { price, storeName: "" } : null;
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white py-16 sm:py-20 px-4">
        <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 w-[500px] h-[500px] rounded-full bg-orange-400/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[400px] h-[400px] rounded-full bg-orange-800/20 blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left: headline + search */}
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                Gjej çmimin më të mirë
              </h1>
              <p className="text-orange-100/80 text-lg mb-8 max-w-md">
                Krahaso çmimet nga dyqanet kryesore shqiptare në një vend
              </p>
              <SearchAutocomplete variant="hero" />
            </div>
            {/* Right: flip board */}
            <div className="flex justify-center lg:justify-end">
              <div className="inline-flex flex-col items-center gap-2 bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6">
                <p className="text-orange-100/90 text-sm font-medium tracking-wider uppercase">
                  Çmimet me të ulëta në
                </p>
                <FlipBoard productCount={allProducts.length} />
                <p className="text-orange-100/90 text-sm font-medium tracking-wider uppercase">
                  produkte
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Store badges */}
      <section className="bg-white border-b border-gray-100 py-5 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm text-gray-400 mr-1">Krahasojmë çmimet nga:</span>
          {["Foleja.al", "Shpresa Group", "Neptun", "Globe Albania", "AlbaGame"].map((s) => (
            <span key={s} className="text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Produktet më të kërkuara</h2>
          <Link
            href="/kerko"
            className="text-sm font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1 transition-colors"
          >
            Shiko të gjitha
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {featured.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              lowestPrice={lowestPriceMap[p.id]?.price ?? null}
              lowestPriceStore={lowestPriceMap[p.id]?.storeName ?? null}
            />
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-6 px-4">
        <p className="max-w-4xl mx-auto text-center text-xs text-gray-400">
          Çmimet dhe disponueshmëria e stokut janë siç reklamohen nga secili dyqan.
          Gjej.al nuk garanton saktësinë e këtyre të dhënave dhe nuk verifikon stokun fizik.
        </p>
      </section>
    </div>
  );
}

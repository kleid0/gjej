import Link from "next/link";
import { productCatalog, priceQuery } from "@/src/infrastructure/container";
import { getProductLowestPrices } from "@/src/infrastructure/db/PriceHistoryRepository";
import { STORE_MAP } from "@/src/infrastructure/stores/registry";
import { readTrendsCache } from "@/src/infrastructure/trends/TrendsService";
import ProductCard from "@/components/ProductCard";
import CategoryCard from "@/components/CategoryCard";
import FlipBoard from "@/components/FlipBoard";

// Revalidate homepage every 30 minutes — cached prices refresh daily
export const revalidate = 1800;

export default async function Home() {
  const [allProducts, allPrices, dbPrices] = await Promise.all([
    productCatalog.getAllProducts(),
    priceQuery.getAllCachedPrices(),
    getProductLowestPrices(),
  ]);

  const categories = productCatalog.getCategories();

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
      <section className="bg-gradient-to-br from-orange-600 to-orange-700 text-white py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-3">Gjej çmimin më të mirë</h1>
          <p className="text-orange-100 text-lg mb-8">
            Krahaso çmimet nga dyqanet kryesore shqiptare në një vend
          </p>
          <div className="flex flex-col items-center gap-3">
            <p className="text-orange-100 text-base font-medium tracking-wide uppercase">
              Çmimet me të ulëta në
            </p>
            <FlipBoard productCount={allProducts.length} />
            <p className="text-orange-100 text-base font-medium tracking-wide uppercase">
              produkte
            </p>
          </div>
        </div>
      </section>

      {/* Store badges */}
      <section className="bg-white border-b border-gray-100 py-4 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
          <span className="font-medium text-gray-400 mr-2">Krahasojmë çmimet nga:</span>
          {["Foleja.al", "Shpresa Group", "Neptun", "PC Store", "Globe Albania"].map((s) => (
            <span key={s} className="font-semibold text-gray-700">{s}</span>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-xl font-bold text-gray-800 mb-5">Shfleto sipas kategorisë</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-800">Produktet më të kërkuara</h2>
          <Link href="/kerko" className="text-orange-600 hover:text-orange-700 text-sm font-medium">
            Shiko të gjitha →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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

      {/* Disclaimer banner */}
      <section className="bg-blue-50 border-t border-blue-100 py-4 px-4">
        <p className="max-w-4xl mx-auto text-center text-xs text-blue-600">
          ℹ️ Çmimet dhe disponueshmëria e stokut janë siç reklamohen nga secili dyqan.
          Gjej.al nuk garanton saktësinë e këtyre të dhënave dhe nuk verifikon stokun fizik.
        </p>
      </section>
    </div>
  );
}

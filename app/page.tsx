import Link from "next/link";
import { productCatalog, priceQuery } from "@/src/infrastructure/container";
import ProductCard from "@/components/ProductCard";
import CategoryCard from "@/components/CategoryCard";
import SearchAutocomplete from "@/components/SearchAutocomplete";

// Revalidate homepage every 30 minutes — cached prices refresh daily
export const revalidate = 1800;

export default async function Home() {
  const [allProducts, allPrices] = await Promise.all([
    productCatalog.getAllProducts(),
    priceQuery.getAllCachedPrices(),
  ]);

  const featured = allProducts.slice(0, 8);
  const categories = productCatalog.getCategories();

  // Build lowest-price map from cached prices (exclude suspicious matches)
  const lowestPriceMap: Record<string, number | null> = {};
  for (const product of allProducts) {
    const record = allPrices[product.id];
    if (record) {
      const valid = record.prices.filter(
        (p) => p.price !== null && !p.suspicious && !p.overpriced,
      );
      lowestPriceMap[product.id] = valid.length
        ? Math.min(...valid.map((p) => p.price!))
        : null;
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
          <SearchAutocomplete variant="hero" />
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
          <h2 className="text-xl font-bold text-gray-800">Produkte të Njohura</h2>
          <Link href="/kerko" className="text-orange-600 hover:text-orange-700 text-sm font-medium">
            Shiko të gjitha →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {featured.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              lowestPrice={lowestPriceMap[p.id] ?? null}
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

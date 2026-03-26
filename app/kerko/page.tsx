import { CATEGORIES } from "@/lib/products";
import { searchAllProducts, getAllProducts } from "@/lib/product-store";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { q?: string; kat?: string };
}

export default async function KerkoPage({ searchParams }: Props) {
  const query = searchParams.q ?? "";
  const kat = searchParams.kat ?? "";

  let results = query
    ? await searchAllProducts(query)
    : await getAllProducts();
  if (kat) results = results.filter((p) => p.category === kat);

  const category = kat ? CATEGORIES.find((c) => c.id === kat) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        {query ? (
          <>
            <h1 className="text-2xl font-bold text-gray-800">
              Rezultate për &quot;{query}&quot;
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {results.length} produkte u gjetën
              {category && <> në {category.name}</>}
            </p>
          </>
        ) : (
          <h1 className="text-2xl font-bold text-gray-800">Të gjitha produktet</h1>
        )}
      </div>

      {/* Category filter pills */}
      {query && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={`/kerko?q=${encodeURIComponent(query)}`}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              !kat
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
            }`}
          >
            Të gjitha
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/kerko?q=${encodeURIComponent(query)}&kat=${c.id}`}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                kat === c.id
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
              }`}
            >
              {c.icon} {c.name}
            </Link>
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          {query ? (
            <>
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-lg font-medium text-gray-600">Nuk u gjet asnjë produkt</p>
              <p className="text-sm mt-2">
                Provo me numrin e modelit (p.sh. <code className="font-mono bg-gray-100 px-1 rounded">SM-G930F</code>) ose emrin e produktit
              </p>
            </>
          ) : (
            <>
              <p className="text-5xl mb-4">🛒</p>
              <p className="text-lg font-medium text-gray-600">Kërko një produkt për të filluar</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

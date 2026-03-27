import { productCatalog } from "@/src/infrastructure/container";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { q?: string; kat?: string; nënkat?: string; rendit?: string };
}

export default async function KerkoPage({ searchParams }: Props) {
  const query = searchParams.q ?? "";
  const kat = searchParams.kat ?? "";
  const nënkat = searchParams["nënkat"] ?? "";
  const rendit = searchParams.rendit ?? "relevance";

  let results = query
    ? await productCatalog.searchProducts(query)
    : await productCatalog.getAllProducts();

  if (kat) results = results.filter((p) => p.category === kat);
  if (nënkat) results = results.filter((p) => p.subcategory === nënkat);

  if (rendit === "az") results = [...results].sort((a, b) => a.family.localeCompare(b.family));
  if (rendit === "za") results = [...results].sort((a, b) => b.family.localeCompare(a.family));

  const categories = productCatalog.getCategories();
  const category = kat ? categories.find((c) => c.id === kat) : null;

  // Subcategories available in current filtered results
  const subcategories = kat
    ? Array.from(new Set(results.map((p) => p.subcategory))).filter(Boolean).sort()
    : [];

  function filterHref(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (kat) params.set("kat", kat);
    if (nënkat) params.set("nënkat", nënkat);
    if (rendit !== "relevance") params.set("rendit", rendit);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `/kerko?${params.toString()}`;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-4">
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={filterHref({ kat: "", "nënkat": "" })}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              !kat ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
            }`}
          >
            Të gjitha
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={filterHref({ kat: c.id, "nënkat": "" })}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                kat === c.id ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
              }`}
            >
              {c.icon} {c.name}
            </Link>
          ))}
        </div>

        {/* Sort */}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <span>Rendit:</span>
          {[
            { value: "relevance", label: "Relevanca" },
            { value: "az", label: "A–Z" },
            { value: "za", label: "Z–A" },
          ].map((opt) => (
            <Link
              key={opt.value}
              href={filterHref({ rendit: opt.value === "relevance" ? "" : opt.value })}
              className={`px-2 py-1 rounded border transition-colors ${
                rendit === opt.value
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Subcategory pills (only when a category is selected) */}
      {subcategories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={filterHref({ "nënkat": "" })}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              !nënkat ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            Të gjitha
          </Link>
          {subcategories.map((sub) => (
            <Link
              key={sub}
              href={filterHref({ "nënkat": sub })}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                nënkat === sub ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {sub}
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
                Provo me numrin e modelit (p.sh.{" "}
                <code className="font-mono bg-gray-100 px-1 rounded">SM-G930F</code>) ose emrin e produktit
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

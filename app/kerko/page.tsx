import Link from "next/link";
import { productCatalog, priceQuery } from "@/src/infrastructure/container";
import { STORES } from "@/src/infrastructure/stores/registry";
import SearchResultsClient from "@/components/SearchResultsClient";
import type { ProductSummary, StoreInfo } from "@/components/SearchResultsClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { q?: string; kat?: string; "nenkat"?: string };
}

export default async function KerkoPage({ searchParams }: Props) {
  const query = searchParams.q ?? "";
  const kat = searchParams.kat ?? "";
  const nenkat = searchParams["nenkat"] ?? "";

  let products = query
    ? await productCatalog.searchProducts(query)
    : kat
      ? await productCatalog.getProductsByCategory(kat)
      : await productCatalog.getAllProducts();

  if (kat && query) products = products.filter((p) => p.category === kat);

  const allPrices = await priceQuery.getAllCachedPrices();

  const summaries: ProductSummary[] = products.map((p) => {
    const record = allPrices[p.id];
    const valid = record?.prices.filter((pr) => pr.price !== null) ?? [];
    const bestPrice = valid.length
      ? Math.min(...valid.map((pr) => pr.price!))
      : null;
    return {
      id: p.id,
      family: p.family,
      brand: p.brand,
      category: p.category,
      subcategory: p.subcategory,
      imageUrl: p.imageUrl,
      modelNumber: p.modelNumber,
      bestPrice,
      storeCount: valid.length,
      storeIds: valid.map((pr) => pr.storeId),
      hasStock: record?.prices.some((pr) => pr.inStock === true) ?? false,
      refreshedAt: record?.refreshedAt ?? null,
    };
  });

  const subcategories = Array.from(
    new Set(products.map((p) => p.subcategory).filter(Boolean))
  ).sort();

  const storeInfos: StoreInfo[] = STORES.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
  }));

  const categories = productCatalog.getCategories();
  const category = kat ? categories.find((c) => c.id === kat) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-3 flex items-center gap-1 flex-wrap">
        <Link href="/" className="hover:text-orange-600">
          Kryefaqja
        </Link>
        {category && (
          <>
            <span>/</span>
            <Link
              href={`/kerko?kat=${category.id}`}
              className="hover:text-orange-600"
            >
              {category.name}
            </Link>
          </>
        )}
        {query && (
          <>
            <span>/</span>
            <span className="text-gray-600">&quot;{query}&quot;</span>
          </>
        )}
      </nav>

      {/* Title */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">
          {query ? (
            <>Rezultate per &quot;{query}&quot;</>
          ) : category ? (
            <>
              {category.icon} {category.name}
            </>
          ) : (
            <>Te gjitha produktet</>
          )}
        </h1>
      </div>

      {/* Category tabs */}
      {!kat && (
        <div className="flex flex-wrap gap-2 mb-5">
          <Link
            href="/kerko"
            className="text-xs px-3 py-1.5 rounded-full border font-medium bg-orange-600 text-white border-orange-600"
          >
            Te gjitha
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={
                query
                  ? `/kerko?q=${encodeURIComponent(query)}&kat=${c.id}`
                  : `/kerko?kat=${c.id}`
              }
              className="text-xs px-3 py-1.5 rounded-full border font-medium bg-white text-gray-600 border-gray-200 hover:border-orange-300 transition-colors"
            >
              {c.icon} {c.name}
            </Link>
          ))}
        </div>
      )}

      <SearchResultsClient
        products={summaries}
        stores={storeInfos}
        subcategories={subcategories}
        query={query}
        category={kat}
        categoryName={category?.name ?? ""}
        subcategory={nenkat}
      />
    </div>
  );
}

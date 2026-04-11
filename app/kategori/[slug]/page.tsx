import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { productCatalog, priceQuery } from "@/src/infrastructure/container";
import { getProductLowestPrices } from "@/src/infrastructure/db/PriceHistoryRepository";
import SearchResultsClient from "@/components/SearchResultsClient";
import type { ProductSummary } from "@/components/SearchResultsClient";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return productCatalog.getCategories().map((c) => ({ slug: c.id }));
}

export function generateMetadata({ params }: Props): Metadata {
  const category = productCatalog.getCategoryById(params.slug);
  if (!category) return {};
  return {
    title: `${category.name} – Gjej.al`,
    description: `Krahaso çmimet për ${category.name.toLowerCase()} nga dyqanet kryesore shqiptare.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const category = productCatalog.getCategoryById(params.slug);
  if (!category) notFound();

  const [products, allPrices, dbPrices] = await Promise.all([
    productCatalog.getProductsByCategory(params.slug),
    priceQuery.getAllCachedPrices(),
    getProductLowestPrices(),
  ]);

  const summaries: ProductSummary[] = products.map((p) => {
    const record = allPrices[p.id];
    const valid = record?.prices.filter((pr) => pr.price !== null) ?? [];
    const bestPrice = valid.length
      ? Math.min(...valid.map((pr) => pr.price!))
      : (dbPrices[p.id] ?? null);
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="text-xs text-gray-400 mb-3 flex items-center gap-1">
        <Link href="/" className="hover:text-orange-600">
          Kryefaqja
        </Link>
        <span>/</span>
        <span className="text-gray-600">{category.name}</span>
      </nav>

      <div className="flex items-center gap-3 mb-5">
        <span className="text-4xl">{category.icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
          <p className="text-sm text-gray-500">{summaries.length} produkte</p>
        </div>
      </div>

      <SearchResultsClient
        products={summaries}
        subcategories={subcategories}
        query=""
        category={params.slug}
        categoryName={category.name}
        subcategory=""
      />
    </div>
  );
}

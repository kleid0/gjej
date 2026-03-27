import { notFound } from "next/navigation";
import Link from "next/link";
import { productCatalog } from "@/src/infrastructure/container";
import PriceComparison from "@/components/PriceComparison";
import ProductEnrichmentPanel from "@/components/ProductEnrichmentPanel";
import { CATEGORIES } from "@/src/domain/catalog/Product";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export default async function ProductPage({ params }: Props) {
  const product = await productCatalog.getProductById(params.slug);
  if (!product) notFound();

  const siblings = await productCatalog.getFamilySiblings(product);
  const category = CATEGORIES.find((c) => c.id === product.category);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1 flex-wrap">
        <Link href="/" className="hover:text-orange-600">Kryefaqja</Link>
        <span>/</span>
        <Link href={`/kategori/${product.category}`} className="hover:text-orange-600">
          {category?.name ?? product.category}
        </Link>
        {product.subcategory && (
          <>
            <span>/</span>
            <Link
              href={`/kerko?kat=${product.category}&nënkat=${encodeURIComponent(product.subcategory)}`}
              className="hover:text-orange-600"
            >
              {product.subcategory}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-gray-600 truncate max-w-xs">{product.family}</span>
      </nav>

      {/* Product header */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-1">
          {product.brand}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-1">
          {product.family}
        </h1>
        {product.modelNumber && (
          <p className="text-xs font-mono text-gray-400">
            Model: {product.modelNumber}
          </p>
        )}
      </div>

      {/* Storage options */}
      {product.storageOptions.length > 1 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">
            Kapaciteti / RAM — zgjidh variantin
          </p>
          <div className="flex flex-wrap gap-2">
            {product.storageOptions.map((opt, i) => (
              <span
                key={opt.label}
                className={`text-sm border rounded-lg px-3 py-1.5 font-medium ${
                  i === 0
                    ? "border-orange-500 text-orange-600 bg-orange-50"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                {opt.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">
            * Çmimet tregojnë variantin bazë. Çmimi ndryshon sipas kapacitetit.
          </p>
        </div>
      )}

      {/* Enrichment panel: images, variant badge, specs — loaded lazily on client */}
      <ProductEnrichmentPanel
        productId={product.id}
        fallbackImage={product.imageUrl}
        productFamily={product.family}
      />

      {/* Family siblings (same product, different model numbers) */}
      {siblings.length > 0 && (
        <div className="mb-8 p-4 border border-gray-100 rounded-xl bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            Produkte të ngjashme në familjen {product.brand}
          </p>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/produkt/${s.id}`}
                className="text-xs border border-gray-200 bg-white rounded-lg px-3 py-1.5 hover:border-orange-400 hover:text-orange-600 font-medium transition-colors"
              >
                {s.family}
                {s.modelNumber && (
                  <span className="font-mono text-gray-400 ml-1">({s.modelNumber})</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Price comparison */}
      <PriceComparison productId={product.id} />

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-6 text-center">
        Çmimet janë siç reklamohen nga secili dyqan. Gjej.al nuk garanton saktësinë e çmimeve apo stokut.
      </p>
    </div>
  );
}

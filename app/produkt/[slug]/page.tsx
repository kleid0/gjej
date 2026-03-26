import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductById, getFamilySiblings, PRODUCTS } from "@/lib/products";
import PriceComparison from "@/components/PriceComparison";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.id }));
}

export default function ProductPage({ params }: Props) {
  const product = getProductById(params.slug);
  if (!product) notFound();

  const siblings = getFamilySiblings(product);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-orange-600">Kryefaqja</Link>
        <span>/</span>
        <Link href={`/kategori/${product.category}`} className="hover:text-orange-600">
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-gray-600 font-mono">{product.modelNumber}</span>
      </nav>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Image + info */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex items-center justify-center h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt={product.family}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Model number siblings (same family) */}
          {siblings.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 font-medium mb-2">
                Modele të tjera në familjen {product.family}:
              </p>
              <div className="flex flex-wrap gap-2">
                {siblings.map((s) => (
                  <Link
                    key={s.id}
                    href={`/produkt/${s.id}`}
                    className="text-xs border border-gray-200 rounded px-2 py-1 hover:border-orange-400 hover:text-orange-600 font-mono"
                  >
                    {s.modelNumber}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="md:col-span-3">
          <div className="mb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">{product.brand}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{product.family}</h1>
          <p className="text-sm font-mono text-gray-500 mb-4">Model: {product.modelNumber}</p>

          {/* Storage / RAM selector */}
          {product.storageOptions.length > 1 && (
            <div className="mb-5">
              <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">
                Kapaciteti / RAM
              </p>
              <div className="flex flex-wrap gap-2" id="storage-selector">
                {product.storageOptions.map((opt, i) => (
                  <button
                    key={opt.label}
                    data-index={i}
                    className={`text-sm border rounded-lg px-3 py-1.5 font-medium transition-colors ${
                      i === 0
                        ? "border-orange-500 text-orange-600 bg-orange-50"
                        : "border-gray-200 text-gray-600 hover:border-orange-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                * Çmimet e mëposhtme janë për modelin bazë. Çmimi mund të ndryshojë sipas kapacitetit.
              </p>
            </div>
          )}

          {product.storageOptions.length === 1 && (
            <p className="text-sm text-gray-600 mb-4">Kapaciteti: <strong>{product.storageOptions[0].label}</strong></p>
          )}

          <p className="text-xs text-gray-400 mb-2">
            Kategoria: <Link href={`/kategori/${product.category}`} className="text-orange-600 hover:underline">{product.subcategory}</Link>
          </p>
        </div>
      </div>

      {/* Live price comparison */}
      <PriceComparison productId={product.id} />
    </div>
  );
}

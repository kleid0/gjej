import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { productCatalog, priceQuery } from "@/src/infrastructure/container";
import ProductVariantSection from "@/components/ProductVariantSection";
import ComboSelector from "@/components/ComboSelector";
import { CATEGORIES } from "@/src/domain/catalog/Product";
import { getVariantConfig, extractStorageFromFamily } from "@/src/domain/catalog/variants";
import { groupCombos } from "@/src/application/catalog/comboVariants";

// ISR: revalidate product pages every hour
// Specs never change; prices are fetched client-side from /api/prices
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gjej.al";
const STORE_COUNT = 5;

interface Props {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const product = await productCatalog.getProductById(params.slug);
  if (!product) return {};

  const storage =
    typeof searchParams?.hapesire === "string" ? searchParams.hapesire : null;
  const colour =
    typeof searchParams?.ngjyre === "string" ? searchParams.ngjyre : null;

  const displayName = `${product.family}${storage ? ` ${storage}` : ""}`;
  const title = `${displayName} çmimi në Shqipëri - Gjej.al`;

  // Pull lowest known price from cache for the meta description
  let lowestPrice: number | null = null;
  try {
    const allPrices = await priceQuery.getAllCachedPrices();
    const record = allPrices[product.id];
    if (record) {
      const valid = record.prices.filter(
        (p) => p.price !== null && !p.suspicious && !p.overpriced,
      );
      lowestPrice = valid.length ? Math.min(...valid.map((p) => p.price!)) : null;
    }
  } catch { /* non-fatal */ }

  const description = lowestPrice
    ? `Krahaso çmimin e ${product.family} nga ${STORE_COUNT} dyqane shqiptare. Çmimi më i mirë sot: ${lowestPrice.toLocaleString("sq-AL")} Lekë`
    : `Krahaso çmimin e ${product.family} nga ${STORE_COUNT} dyqane shqiptare. Gjej ofertën më të mirë në Gjej.al`;

  // Canonical URL always points to base product — variant querystrings are supplemental
  const canonical = `${SITE_URL}/produkt/${product.id}`;

  const ogImage = product.imageUrl || `${SITE_URL}/og-default.png`;

  const variantQs: Record<string, string> = {};
  if (colour) variantQs["ngjyre"] = colour;
  if (storage) variantQs["hapesire"] = storage;
  const variantQsStr = new URLSearchParams(variantQs).toString();

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: variantQsStr ? `${canonical}?${variantQsStr}` : canonical,
      siteName: "Gjej.al",
      images: [{ url: ogImage, width: 1200, height: 630, alt: displayName }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const product = await productCatalog.getProductById(params.slug);
  if (!product) notFound();

  // One catalogue read powers both family siblings and combo grouping.
  const allProducts = await productCatalog.getAllProducts();
  const siblings = allProducts.filter(
    (p) => p.family === product.family && p.id !== product.id,
  );
  const combos = groupCombos(product, allProducts);
  const category = CATEGORIES.find((c) => c.id === product.category);

  const variantConfig = getVariantConfig(product);
  const rawNgjyre = searchParams?.ngjyre;
  const rawHapesire = searchParams?.hapesire;
  // No colour in the URL → default to "all colours" (handled in
  // ProductVariantSection) so the headline price is the cheapest across every
  // colour, not a forced default colour.
  const initialColour = typeof rawNgjyre === "string" ? rawNgjyre : undefined;
  const initialStorage =
    (typeof rawHapesire === "string" ? rawHapesire : undefined) ??
    extractStorageFromFamily(product.family) ??
    variantConfig?.defaultStorage;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1 flex-wrap">
        <Link href="/" className="hover:text-tomato">Kryefaqja</Link>
        <span>/</span>
        <Link href={`/kategori/${product.category}`} className="hover:text-tomato">
          {category?.name ?? product.category}
        </Link>
        {product.subcategory && (
          <>
            <span>/</span>
            <Link
              href={`/kerko?kat=${product.category}&nënkat=${encodeURIComponent(product.subcategory)}`}
              className="hover:text-tomato"
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
        <p className="text-xs font-semibold text-tomato uppercase tracking-widest mb-1">
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

      {/* Bundle / combo selector (e.g. console vs console + game) */}
      {combos.length > 1 && <ComboSelector variants={combos} activeId={product.id} />}

      {/* Storage options (fallback for products without variant config) */}
      {!variantConfig && product.storageOptions.length > 1 && (
        <div className="mb-6 p-4 bg-paper-deep border border-ink rounded-xl">
          <p className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">
            Kapaciteti / RAM — zgjidh variantin
          </p>
          <div className="flex flex-wrap gap-2">
            {product.storageOptions.map((opt, i) => (
              <span
                key={opt.label}
                className={`text-sm border rounded-lg px-3 py-1.5 font-medium ${
                  i === 0
                    ? "border-ink text-ink bg-sun/50"
                    : "border-ink/30 text-ink"
                }`}
              >
                {opt.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-clay mt-2">
            * Çmimet tregojnë variantin bazë. Çmimi ndryshon sipas kapacitetit.
          </p>
        </div>
      )}

      {/* Family siblings */}
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
                className="text-xs border border-gray-200 bg-white rounded-lg px-3 py-1.5 hover:border-ink hover:text-tomato font-medium transition-colors"
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

      {/* Image + Variant selectors + Specs + Price comparison */}
      <ProductVariantSection
        productId={product.id}
        variantConfig={variantConfig}
        initialColour={initialColour}
        initialStorage={initialStorage}
        fallbackImage={product.imageUrl}
        productFamily={product.family}
      />

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-6 text-center">
        Çmimet janë siç reklamohen nga secili dyqan. Gjej.al nuk garanton saktësinë e çmimeve apo stokut.
      </p>
    </div>
  );
}

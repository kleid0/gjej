import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategoryById, getProductsByCategory, CATEGORIES } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.id }));
}

export default function CategoryPage({ params }: Props) {
  const category = getCategoryById(params.slug);
  if (!category) notFound();

  const products = getProductsByCategory(params.slug);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-orange-600">Kryefaqja</Link>
        <span>/</span>
        <span className="text-gray-600">{category.name}</span>
      </nav>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">{category.icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
          <p className="text-sm text-gray-500">{products.length} produkte</p>
        </div>
      </div>

      {/* Subcategory pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {category.subcategories.map((sub) => (
          <span
            key={sub}
            className="text-xs bg-orange-50 text-orange-700 border border-orange-100 rounded-full px-3 py-1 font-medium"
          >
            {sub}
          </span>
        ))}
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">{category.icon}</p>
          <p className="text-lg font-medium text-gray-600">
            Nuk ka produkte akoma në këtë kategori
          </p>
        </div>
      )}
    </div>
  );
}

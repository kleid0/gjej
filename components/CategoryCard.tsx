import Link from "next/link";
import { Category } from "@/lib/products";

export default function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/kategori/${category.id}`}
      className="card p-3 flex flex-col items-center text-center gap-1 hover:border-orange-200 hover:bg-orange-50 transition-colors"
    >
      <span className="text-2xl">{category.icon}</span>
      <span className="text-xs font-semibold text-gray-700 leading-tight">{category.name}</span>
    </Link>
  );
}

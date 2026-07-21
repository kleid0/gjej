import Link from "next/link";
import { Category } from "@/src/domain/catalog/Product";

export default function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/kategori/${category.id}`}
      className="card p-3 flex flex-col items-center text-center gap-1 hover:bg-sun/40"
    >
      <span className="text-2xl">{category.icon}</span>
      <span className="text-xs font-semibold text-ink leading-tight">{category.name}</span>
    </Link>
  );
}

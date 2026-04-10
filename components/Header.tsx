"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES } from "@/src/domain/catalog/Product";
import SearchAutocomplete from "./SearchAutocomplete";

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="bg-orange-600 text-white shadow-md sticky top-0 z-50">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-2xl font-black tracking-tight shrink-0">
          gjej<span className="text-orange-200">.al</span>
        </Link>
        {!isHome && (
          <div className="flex-1">
            <SearchAutocomplete variant="header" />
          </div>
        )}
      </div>

      {/* Category nav */}
      <nav className="bg-orange-700 border-t border-orange-500 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 py-1 text-sm">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/kategori/${cat.id}`}
              className="whitespace-nowrap px-3 py-1.5 rounded hover:bg-orange-600 transition-colors"
            >
              {cat.icon} {cat.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

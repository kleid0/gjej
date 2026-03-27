"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/src/domain/catalog/Product";

export default function Header() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/kerko?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="bg-orange-600 text-white shadow-md sticky top-0 z-50">
      {/* Top bar */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-2xl font-black tracking-tight shrink-0">
          gjej<span className="text-orange-200">.al</span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 flex">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kërko produkt ose numër modeli…"
            className="flex-1 rounded-l-lg px-4 py-2 text-gray-900 text-sm outline-none"
          />
          <button
            type="submit"
            className="bg-orange-800 hover:bg-orange-900 px-4 py-2 rounded-r-lg text-sm font-semibold transition-colors"
          >
            Kërko
          </button>
        </form>
      </div>

      {/* Category nav */}
      <nav className="bg-orange-700 border-t border-orange-500">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 overflow-x-auto py-1 text-sm">
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

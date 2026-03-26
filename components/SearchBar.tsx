"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/kerko?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <form onSubmit={handleSearch} className={`flex w-full ${large ? "max-w-2xl mx-auto" : ""}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Kërko produkt ose numër modeli (p.sh. SM-G930F, iPhone 15)…"
        className={`flex-1 border border-gray-200 rounded-l-lg px-4 outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 ${
          large ? "py-3 text-base" : "py-2 text-sm"
        }`}
      />
      <button
        type="submit"
        className={`bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-r-lg transition-colors ${
          large ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"
        }`}
      >
        Kërko
      </button>
    </form>
  );
}

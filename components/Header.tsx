"use client";

import Link from "next/link";
import SearchAutocomplete from "./SearchAutocomplete";

export default function Header() {
  return (
    <header className="bg-orange-600 text-white shadow-md sticky top-0 z-50">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-2xl font-black tracking-tight shrink-0">
          gjej<span className="text-orange-200">.al</span>
        </Link>
        <div className="flex-1">
          <SearchAutocomplete variant="header" />
        </div>
      </div>

    </header>
  );
}

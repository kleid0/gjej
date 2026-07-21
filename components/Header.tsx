"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavCategoryData } from "@/src/application/catalog/NavMenu";
import SearchAutocomplete from "./SearchAutocomplete";

// END.-style navigation: the category strip never scrolls sideways — it wraps
// on desktop, and each item opens a full-width mega panel on hover with
// subcategory links, top brands, and featured product tiles. On mobile the
// strip collapses into a "Kategoritë" disclosure with a tap-friendly grid.
export default function Header({ nav }: { nav: NavCategoryData[] }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close everything on navigation and on Escape.
  useEffect(() => {
    setOpen(null);
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openCat = nav.find((c) => c.id === open) ?? null;

  return (
    <header
      className="bg-orange-600 text-white shadow-md sticky top-0 z-50"
      onMouseLeave={() => setOpen(null)}
    >
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

      {/* Category nav — wraps, never scrolls */}
      <nav className="bg-orange-700 border-t border-orange-500 relative">
        {/* Desktop strip */}
        <div className="hidden lg:flex max-w-7xl mx-auto px-4 flex-wrap items-center justify-center gap-x-0.5 py-1 text-sm">
          {nav.map((cat) => (
            <Link
              key={cat.id}
              href={`/kategori/${cat.id}`}
              onMouseEnter={() => setOpen(cat.id)}
              onFocus={() => setOpen(cat.id)}
              onClick={() => setOpen(null)}
              className={`whitespace-nowrap px-2.5 py-1.5 rounded transition-colors ${
                open === cat.id ? "bg-orange-600" : "hover:bg-orange-600"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Mobile: disclosure instead of a swipe strip */}
        <div className="lg:hidden max-w-7xl mx-auto px-4 py-1">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded hover:bg-orange-600 transition-colors"
            aria-expanded={mobileOpen}
          >
            <span>Kategoritë</span>
            <span className={`transition-transform ${mobileOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
          {mobileOpen && (
            <div className="grid grid-cols-2 gap-1 pb-2">
              {nav.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/kategori/${cat.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-orange-600 transition-colors"
                >
                  <span>{cat.icon}</span>
                  <span className="leading-tight">{cat.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Mega panel (desktop) */}
        {openCat && (
          <div className="hidden lg:block absolute left-0 right-0 top-full bg-white text-gray-800 shadow-2xl border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-8">
              {/* Subcategories */}
              <div className="col-span-3">
                <h3 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">
                  Shiko të gjitha
                </h3>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <Link
                      href={`/kategori/${openCat.id}`}
                      className="font-semibold text-gray-900 hover:text-orange-600"
                    >
                      Të gjitha — {openCat.name}
                    </Link>
                  </li>
                  {openCat.subcategories.map((sub) => (
                    <li key={sub}>
                      <Link
                        href={`/kategori/${openCat.id}?nen=${encodeURIComponent(sub)}`}
                        className="text-gray-600 hover:text-orange-600"
                      >
                        {sub}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Brands */}
              <div className="col-span-3">
                <h3 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">
                  Markat
                </h3>
                <ul className="space-y-2.5 text-sm">
                  {openCat.topBrands.map((brand) => (
                    <li key={brand}>
                      <Link
                        href={`/kerko?q=${encodeURIComponent(brand)}`}
                        className="text-gray-600 hover:text-orange-600"
                      >
                        {brand}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Featured product tiles */}
              <div className="col-span-6">
                <h3 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">
                  Të zgjedhura
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {openCat.featured.map((p) => (
                    <Link key={p.id} href={`/produkt/${p.id}`} className="group">
                      <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-700 group-hover:text-orange-600 line-clamp-2">
                        {p.name}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

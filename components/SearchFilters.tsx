"use client";

import { useState } from "react";

export interface FilterState {
  priceMin: number | null;
  priceMax: number | null;
  brands: string[];
  inStockOnly: boolean;
}

interface BrandCount {
  name: string;
  count: number;
}

interface Props {
  brands: BrandCount[];
  priceRange: { min: number; max: number };
  filters: FilterState;
  onChange: (f: FilterState) => void;
  resultCount: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function SearchFilters({
  brands,
  filters,
  onChange,
  resultCount,
  mobileOpen,
  onMobileClose,
}: Props) {
  const [minInput, setMinInput] = useState(filters.priceMin?.toString() ?? "");
  const [maxInput, setMaxInput] = useState(filters.priceMax?.toString() ?? "");
  const [brandSearch, setBrandSearch] = useState("");

  function toggleBrand(b: string) {
    const next = filters.brands.includes(b)
      ? filters.brands.filter((x) => x !== b)
      : [...filters.brands, b];
    onChange({ ...filters, brands: next });
  }

  function applyPrice() {
    onChange({
      ...filters,
      priceMin: minInput ? parseInt(minInput, 10) || null : null,
      priceMax: maxInput ? parseInt(maxInput, 10) || null : null,
    });
  }

  function clearAll() {
    setMinInput("");
    setMaxInput("");
    setBrandSearch("");
    onChange({
      priceMin: null,
      priceMax: null,
      brands: [],
      inStockOnly: false,
    });
  }

  const hasActive =
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.brands.length > 0 ||
    filters.inStockOnly;

  const visibleBrands = brandSearch
    ? brands.filter((b) =>
        b.name.toLowerCase().includes(brandSearch.toLowerCase())
      )
    : brands.slice(0, 15);

  const content = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-sm">Filtrat</h3>
        {hasActive && (
          <button
            onClick={clearAll}
            className="text-xs text-orange-600 hover:underline font-medium"
          >
            Pastro
          </button>
        )}
      </div>

      {/* Price range */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Cmimi (ALL)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
          />
          <span className="text-gray-300 text-sm shrink-0">–</span>
          <input
            type="number"
            placeholder="Max"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[5000, 10000, 25000, 50000, 100000].map((v) => (
            <button
              key={v}
              onClick={() => {
                setMaxInput(v.toString());
                onChange({ ...filters, priceMax: v });
              }}
              className={`text-xs border rounded-full px-2.5 py-1 transition-colors ${
                filters.priceMax === v
                  ? "border-orange-500 text-orange-600 bg-orange-50"
                  : "border-gray-200 text-gray-500 hover:border-orange-300"
              }`}
            >
              deri {v >= 1000 ? `${v / 1000}k` : v}
            </button>
          ))}
        </div>
      </div>

      {/* Brands */}
      {brands.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Marka
          </p>
          {brands.length > 10 && (
            <input
              type="text"
              placeholder="Kerko marke..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2 outline-none focus:ring-2 focus:ring-orange-300"
            />
          )}
          <div className="space-y-0.5 max-h-44 overflow-y-auto">
            {visibleBrands.map((b) => (
              <label
                key={b.name}
                className="flex items-center gap-2 px-1.5 py-1 hover:bg-gray-50 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.brands.includes(b.name)}
                  onChange={() => toggleBrand(b.name)}
                  className="rounded border-gray-300 w-3.5 h-3.5"
                />
                <span className="text-sm text-gray-700 flex-1 truncate">
                  {b.name}
                </span>
                <span className="text-[11px] text-gray-400">{b.count}</span>
              </label>
            ))}
            {!brandSearch && brands.length > 15 && (
              <button
                onClick={() => setBrandSearch(" ")}
                className="text-xs text-orange-600 hover:underline px-1.5 py-1 font-medium"
              >
                +{brands.length - 15} te tjera
              </button>
            )}
          </div>
        </div>
      )}

      {/* In stock */}
      <label className="flex items-center gap-3 cursor-pointer px-1.5">
        <button
          type="button"
          role="switch"
          aria-checked={filters.inStockOnly}
          onClick={() =>
            onChange({ ...filters, inStockOnly: !filters.inStockOnly })
          }
          className={`relative w-10 h-5 rounded-full transition-colors ${
            filters.inStockOnly ? "bg-orange-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              filters.inStockOnly ? "translate-x-5" : ""
            }`}
          />
        </button>
        <span className="text-sm text-gray-700">Vetem ne stok</span>
      </label>

      {/* Mobile: show results button */}
      <div className="lg:hidden pt-3 border-t border-gray-100">
        <button
          onClick={onMobileClose}
          className="w-full bg-orange-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-orange-700 transition-colors"
        >
          Shiko {resultCount} rezultate
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-20 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          {content}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white z-50 lg:hidden overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Filtrat</h2>
              <button
                onClick={onMobileClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4">{content}</div>
          </aside>
        </>
      )}
    </>
  );
}

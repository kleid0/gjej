"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import SearchFilters, { type FilterState } from "./SearchFilters";

export interface ProductSummary {
  id: string;
  family: string;
  brand: string;
  category: string;
  subcategory: string;
  imageUrl: string;
  modelNumber: string;
  bestPrice: number | null;
  storeCount: number;
  storeIds: string[];
  hasStock: boolean;
  refreshedAt: string | null;
}

export interface StoreInfo {
  id: string;
  name: string;
  color: string;
}

interface Props {
  products: ProductSummary[];
  stores: StoreInfo[];
  subcategories: string[];
  query: string;
  category: string;
  categoryName: string;
  subcategory: string;
}

type Sort = "relevance" | "price-asc" | "price-desc" | "stores" | "az";
type View = "grid" | "list";

const SORTS: { value: Sort; label: string }[] = [
  { value: "relevance", label: "Relevanca" },
  { value: "price-asc", label: "Cmimi: me i uleti" },
  { value: "price-desc", label: "Cmimi: me i larti" },
  { value: "stores", label: "Me shume dyqane" },
  { value: "az", label: "Emri A-Z" },
];

const PER_PAGE = 40;

export default function SearchResultsClient({
  products,
  stores,
  subcategories,
  subcategory,
}: Props) {
  const [sort, setSort] = useState<Sort>("relevance");
  const [view, setView] = useState<View>("grid");
  const [page, setPage] = useState(1);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [activeSub, setActiveSub] = useState(subcategory);
  const [filters, setFilters] = useState<FilterState>({
    priceMin: null,
    priceMax: null,
    brands: [],
    stores: [],
    inStockOnly: false,
  });

  const brandCounts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.brand, (m.get(p.brand) || 0) + 1));
    return Array.from(m, ([name, count]) => ({ name, count })).sort(
      (a, b) => b.count - a.count
    );
  }, [products]);

  const storeCounts = useMemo(
    () =>
      stores.map((s) => ({
        ...s,
        count: products.filter((p) => p.storeIds.includes(s.id)).length,
      })),
    [products, stores]
  );

  const priceRange = useMemo(() => {
    const ps = products
      .map((p) => p.bestPrice)
      .filter((p): p is number => p !== null);
    return ps.length
      ? { min: Math.min(...ps), max: Math.max(...ps) }
      : { min: 0, max: 0 };
  }, [products]);

  const filtered = useMemo(() => {
    let r = products;
    if (activeSub) r = r.filter((p) => p.subcategory === activeSub);
    if (filters.brands.length)
      r = r.filter((p) => filters.brands.includes(p.brand));
    if (filters.stores.length)
      r = r.filter((p) =>
        p.storeIds.some((s) => filters.stores.includes(s))
      );
    if (filters.priceMin !== null)
      r = r.filter(
        (p) => p.bestPrice !== null && p.bestPrice >= filters.priceMin!
      );
    if (filters.priceMax !== null)
      r = r.filter(
        (p) => p.bestPrice !== null && p.bestPrice <= filters.priceMax!
      );
    if (filters.inStockOnly) r = r.filter((p) => p.hasStock);
    return r;
  }, [products, filters, activeSub]);

  const sorted = useMemo(() => {
    const a = [...filtered];
    switch (sort) {
      case "price-asc":
        return a.sort(
          (x, y) => (x.bestPrice ?? Infinity) - (y.bestPrice ?? Infinity)
        );
      case "price-desc":
        return a.sort(
          (x, y) => (y.bestPrice ?? -1) - (x.bestPrice ?? -1)
        );
      case "stores":
        return a.sort((x, y) => y.storeCount - x.storeCount);
      case "az":
        return a.sort((x, y) => x.family.localeCompare(y.family));
      default:
        return a;
    }
  }, [filtered, sort]);

  const shown = sorted.slice(0, page * PER_PAGE);
  const hasMore = shown.length < sorted.length;

  const activeFilterCount =
    filters.brands.length +
    filters.stores.length +
    (filters.priceMin !== null ? 1 : 0) +
    (filters.priceMax !== null ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0);

  return (
    <div className="flex gap-6 items-start">
      <SearchFilters
        brands={brandCounts}
        stores={storeCounts}
        priceRange={priceRange}
        filters={filters}
        onChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        resultCount={filtered.length}
        mobileOpen={mobileFilters}
        onMobileClose={() => setMobileFilters(false)}
      />

      <div className="flex-1 min-w-0">
        {/* Subcategory pills */}
        {subcategories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => {
                setActiveSub("");
                setPage(1);
              }}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                !activeSub
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
              }`}
            >
              Te gjitha
            </button>
            {subcategories.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setActiveSub(s === activeSub ? "" : s);
                  setPage(1);
                }}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  activeSub === s
                    ? "bg-orange-600 text-white border-orange-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button
            onClick={() => setMobileFilters(true)}
            className="lg:hidden flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:border-orange-300 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filtrat
            {activeFilterCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          <span className="text-sm text-gray-500">
            {filtered.length} produkte
          </span>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as Sort);
                setPage(1);
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-orange-300 bg-white cursor-pointer"
            >
              {SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <div className="hidden sm:flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`p-2 transition-colors ${
                  view === "grid"
                    ? "bg-orange-600 text-white"
                    : "text-gray-400 hover:text-gray-600 bg-white"
                }`}
                title="Rrjete"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-2 transition-colors ${
                  view === "list"
                    ? "bg-orange-600 text-white"
                    : "text-gray-400 hover:text-gray-600 bg-white"
                }`}
                title="Liste"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <rect x="1" y="1" width="14" height="3" rx="1" />
                  <rect x="1" y="6.5" width="14" height="3" rx="1" />
                  <rect x="1" y="12" width="14" height="3" rx="1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {shown.length > 0 ? (
          <>
            {view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {shown.map((p) => (
                  <GridCard key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {shown.map((p) => (
                  <ListCard key={p.id} p={p} />
                ))}
              </div>
            )}
            {hasMore && (
              <div className="text-center mt-8 mb-4">
                <button
                  onClick={() => setPage((n) => n + 1)}
                  className="bg-white border border-gray-200 text-gray-700 text-sm font-medium px-8 py-2.5 rounded-lg hover:border-orange-400 hover:text-orange-600 transition-colors"
                >
                  Ngarko me shume ({sorted.length - shown.length} te tjera)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-3 opacity-40">🔍</p>
            <p className="text-base font-semibold text-gray-600">
              Nuk u gjet asnje produkt
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Provo te ndryshosh filtrat ose kerko dicka tjeter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Grid card ---- */
function GridCard({ p }: { p: ProductSummary }) {
  return (
    <Link
      href={`/produkt/${p.id}`}
      className="card p-3 flex flex-col gap-2 group hover:shadow-md transition-all"
    >
      <div className="bg-gray-50 rounded-lg aspect-square flex items-center justify-center overflow-hidden relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.imageUrl}
          alt={p.family}
          className="max-h-[80%] max-w-[80%] object-contain group-hover:scale-105 transition-transform"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.png";
          }}
        />
        {p.storeCount > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm text-[11px] text-gray-600 px-2 py-0.5 rounded-full border border-gray-100 font-medium">
            {p.storeCount} {p.storeCount === 1 ? "dyqan" : "dyqane"}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-orange-600 font-semibold uppercase tracking-wide">
          {p.brand}
        </p>
        <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
          {p.family}
        </h3>
      </div>
      <div className="pt-2 border-t border-gray-100 mt-auto">
        {p.bestPrice !== null ? (
          <div>
            <p className="text-[11px] text-gray-400 leading-none">Nga</p>
            <p className="text-lg font-bold text-orange-600 leading-tight">
              {Math.round(p.bestPrice).toLocaleString("sq-AL")}{" "}
              <span className="text-xs font-medium text-gray-400">Lekë</span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-orange-500 font-medium">
            Krahaso cmimet →
          </p>
        )}
      </div>
    </Link>
  );
}

/* ---- List card ---- */
function ListCard({ p }: { p: ProductSummary }) {
  return (
    <Link
      href={`/produkt/${p.id}`}
      className="card flex items-center gap-4 p-4 group hover:shadow-md transition-all"
    >
      <div className="bg-gray-50 rounded-lg w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.imageUrl}
          alt={p.family}
          className="max-h-[80%] max-w-[80%] object-contain group-hover:scale-105 transition-transform"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.png";
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-orange-600 font-semibold uppercase tracking-wide">
          {p.brand}
        </p>
        <h3 className="text-sm font-semibold text-gray-800 group-hover:text-orange-600 transition-colors">
          {p.family}
        </h3>
        {p.modelNumber && (
          <p className="text-[11px] font-mono text-gray-400 mt-0.5">
            {p.modelNumber}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {p.storeCount > 0 && (
            <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
              {p.storeCount} {p.storeCount === 1 ? "dyqan" : "dyqane"}
            </span>
          )}
          {p.hasStock && (
            <span className="text-[11px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
              Ne stok
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right pl-2">
        {p.bestPrice !== null ? (
          <>
            <p className="text-[11px] text-gray-400">Nga</p>
            <p className="text-xl font-bold text-orange-600">
              {Math.round(p.bestPrice).toLocaleString("sq-AL")}
            </p>
            <p className="text-[11px] text-gray-400">Lekë</p>
          </>
        ) : (
          <span className="text-xs text-orange-500 font-medium">
            Krahaso →
          </span>
        )}
      </div>
    </Link>
  );
}

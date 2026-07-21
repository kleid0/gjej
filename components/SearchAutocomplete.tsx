"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Suggestion {
  id: string;
  family: string;
  brand: string;
  imageUrl: string;
  category: string;
  subcategory: string;
}

interface SuggestedCategory {
  id: string;
  name: string;
  icon: string;
}

const POPULAR = [
  "iPhone 16",
  "Samsung Galaxy S25",
  "MacBook Air",
  "PlayStation 5",
  "Nintendo Switch 2",
  "AirPods Pro",
  "iPad Air",
  "Galaxy Watch",
];

const STORAGE_KEY = "gjej-recent";
const MAX_RECENT = 5;

function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").slice(
      0,
      MAX_RECENT
    );
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  const list = getRecent().filter(
    (r) => r.toLowerCase() !== q.toLowerCase()
  );
  list.unshift(q);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(list.slice(0, MAX_RECENT))
    );
  } catch {}
}

export default function SearchAutocomplete({
  variant = "default",
}: {
  variant?: "default" | "hero" | "header";
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [cats, setCats] = useState<SuggestedCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setCats([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal }
        );
        const data = await res.json();
        setResults(data.products ?? []);
        setCats(data.categories ?? []);
      } catch {
        /* aborted */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function go(q: string) {
    const t = q.trim();
    if (!t) return;
    saveRecent(t);
    setOpen(false);
    router.push(`/kerko?q=${encodeURIComponent(t)}`);
  }

  const isHero = variant === "hero";
  const isHeader = variant === "header";

  const inputCls = isHeader
    ? "w-full rounded-l-lg px-4 py-2 text-sm text-gray-900 outline-none"
    : `w-full border border-gray-200 rounded-l-lg px-4 outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 ${
        isHero ? "py-3.5 text-base" : "py-2.5 text-sm"
      }`;

  const btnCls = isHeader
    ? "bg-orange-800 hover:bg-orange-900 px-4 py-2 rounded-r-lg text-sm text-white font-semibold transition-colors"
    : `bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-r-lg transition-colors ${
        isHero ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm"
      }`;

  const showEmpty = open && query.length < 2;
  const showResults =
    open && query.length >= 2 && (results.length > 0 || cats.length > 0);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full ${isHero ? "max-w-2xl mx-auto" : ""}`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(query);
        }}
        className="flex w-full"
      >
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder="Kerko produkt ose numer modeli..."
            className={inputCls}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Pastro"
            >
              ×
            </button>
          )}
        </div>
        <button type="submit" className={btnCls}>
          Kerko
        </button>
      </form>

      {(showEmpty || showResults) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-[60] max-h-[70vh] overflow-y-auto">
          {/* Recent searches */}
          {showEmpty && recent.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Kerkimet e fundit
              </p>
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setQuery(r);
                    go(r);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-700 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5 text-gray-300 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Popular */}
          {showEmpty && (
            <div className="p-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Popullore
              </p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuery(s);
                      go(s);
                    }}
                    className="text-xs bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700 rounded-full px-3 py-1.5 transition-colors font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category matches */}
          {cats.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Kategori
              </p>
              {cats.map((c) => (
                <Link
                  key={c.id}
                  href={`/kerko?kat=${c.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <span>{c.icon}</span>
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          {/* Product suggestions */}
          {results.length > 0 && (
            <div className="p-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Produkte
              </p>
              {results.map((p) => (
                <Link
                  key={p.id}
                  href={`/produkt/${p.id}`}
                  onClick={() => {
                    saveRecent(p.family);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 px-2 py-2 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="w-9 h-9 object-contain rounded bg-gray-50 p-0.5"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 font-medium truncate">
                      {p.family}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.brand} · {p.subcategory || p.category}
                    </p>
                  </div>
                </Link>
              ))}
              <Link
                href={`/kerko?q=${encodeURIComponent(query)}`}
                onClick={() => {
                  saveRecent(query);
                  setOpen(false);
                }}
                className="block text-center text-xs text-orange-600 hover:text-orange-700 font-semibold py-2.5 mt-1 border-t border-gray-100"
              >
                Shiko te gjitha rezultatet →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

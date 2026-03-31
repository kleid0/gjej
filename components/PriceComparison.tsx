"use client";

import { useEffect, useState } from "react";
import { STORE_MAP } from "@/src/infrastructure/stores/registry";
import { ScrapedPrice } from "@/src/domain/pricing/Price";

const DISCLAIMER =
  "Çmimi dhe stoku i shfaqur janë siç reklamohen nga dyqani. Gjej.al nuk verifikon disponueshmërinë reale të produktit.";

function StockBadge({ inStock, label }: { inStock: boolean | null; label: string }) {
  if (inStock === true)
    return (
      <span className="badge-in-stock" title={DISCLAIMER}>
        ✓ {label || "Në gjendje"}*
      </span>
    );
  if (inStock === false)
    return (
      <span className="badge-out-of-stock" title={DISCLAIMER}>
        ✗ {label || "Jo në gjendje"}*
      </span>
    );
  return (
    <span className="badge-unknown" title={DISCLAIMER}>
      ? {label || "E panjohur"}
    </span>
  );
}

interface Props {
  productId: string;
  variantColour?: string;
  variantStorage?: string;
}

export default function PriceComparison({ productId, variantColour, variantStorage }: Props) {
  const [prices, setPrices] = useState<ScrapedPrice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function fetchPrices() {
    setLoading(true);
    try {
      let url = `/api/prices?product=${encodeURIComponent(productId)}`;
      if (variantColour) url += `&ngjyre=${encodeURIComponent(variantColour)}`;
      if (variantStorage) url += `&hapesire=${encodeURIComponent(variantStorage)}`;
      const res = await fetch(url);
      const data = await res.json();
      setPrices(data.prices);
      setFromCache(data.fromCache);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPrices();
    // Refresh prices every 15 minutes
    const interval = setInterval(fetchPrices, 15 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, variantColour, variantStorage]);

  const found = prices?.filter((p) => p.price !== null) ?? [];
  const cheapest = found.length ? Math.min(...found.map((p) => p.price!)) : null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">Krahasimi i Çmimeve</h2>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {lastRefresh && (
            <span>
              Azhurnuar: {lastRefresh.toLocaleTimeString("sq-AL")}
              {fromCache && " (cache)"}
            </span>
          )}
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
          >
            {loading ? "Duke kontrolluar…" : "↻ Rifresho"}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 text-xs text-amber-700">
        <strong>* Kujdes:</strong> {DISCLAIMER}
      </div>

      {loading && !prices && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {prices && (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-white">
          {prices
            .slice()
            .sort((a, b) => {
              if (a.price === null && b.price === null) return 0;
              if (a.price === null) return 1;
              if (b.price === null) return -1;
              return a.price - b.price;
            })
            .map((p) => {
              const store = STORE_MAP[p.storeId];
              const isCheapest = p.price !== null && p.price === cheapest;

              return (
                <div
                  key={p.storeId}
                  className={`flex items-center justify-between px-4 py-3 ${
                    isCheapest ? "bg-orange-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: store?.color ?? "#ccc" }}
                    />
                    <div>
                      <div className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                        {store?.name ?? p.storeId}
                        {isCheapest && (
                          <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                            Çmimi më i mirë
                          </span>
                        )}
                      </div>
                      <StockBadge inStock={p.inStock} label={p.stockLabel} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {p.price !== null ? (
                      <span className={`font-bold text-lg ${isCheapest ? "text-orange-600" : "text-gray-800"}`}>
                        {p.price.toLocaleString("sq-AL")} ALL
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">{p.error ?? "Nuk ka çmim"}</span>
                    )}
                    {p.productUrl && (
                      <a
                        href={p.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-orange text-xs py-1.5"
                      >
                        Bli →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

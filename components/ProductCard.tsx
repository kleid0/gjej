"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Product } from "@/src/domain/catalog/Product";
import { STORE_MAP } from "@/src/infrastructure/stores/registry";

interface Props {
  product: Product;
  lowestPrice?: number | null;
  lowestPriceStore?: string | null;
}

export default function ProductCard({ product, lowestPrice: initialPrice, lowestPriceStore: initialStore }: Props) {
  const [lowestPrice, setLowestPrice] = useState<number | null>(initialPrice ?? null);
  const [lowestPriceStore, setLowestPriceStore] = useState<string | null>(initialStore ?? null);
  const [loading, setLoading] = useState(initialPrice == null);

  useEffect(() => {
    if (initialPrice != null) return; // server already gave us a price
    let cancelled = false;
    fetch(`/api/prices?product=${encodeURIComponent(product.id)}`)
      .then((r) => r.json())
      .then((data: { prices?: Array<{ price: number | null; storeId: string; suspicious?: boolean; overpriced?: boolean }> }) => {
        if (cancelled) return;
        const valid = (data.prices ?? []).filter(
          (p) => p.price != null && !p.suspicious && !p.overpriced,
        );
        if (valid.length) {
          const best = valid.reduce((a, b) => a.price! < b.price! ? a : b);
          setLowestPrice(best.price);
          setLowestPriceStore(STORE_MAP[best.storeId]?.name ?? best.storeId);
        }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [product.id, initialPrice]);

  return (
    <Link
      href={`/produkt/${product.id}`}
      className="group bg-white rounded-xl border border-gray-200/60 hover:border-orange-200 hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden"
    >
      <div className="bg-gray-50 p-4 flex items-center justify-center aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl || "/placeholder.svg"}
          alt={product.family}
          loading="lazy"
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
      </div>
      <div className="flex-1 flex flex-col p-4">
        <p className="text-xs text-gray-400">{product.brand}</p>
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
          {product.family}
        </h3>
        <div className="mt-auto pt-3">
          {lowestPrice != null ? (
            <>
              <p className="text-base font-bold text-orange-600">
                Nga {Math.round(lowestPrice).toLocaleString("sq-AL")} Lekë
              </p>
              {lowestPriceStore && (
                <p className="text-xs text-gray-400 mt-0.5">{lowestPriceStore}</p>
              )}
            </>
          ) : loading ? (
            <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-xs text-gray-400">Çmimi i panjohur</p>
          )}
        </div>
      </div>
    </Link>
  );
}

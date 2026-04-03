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
    <Link href={`/produkt/${product.id}`} className="card p-3 flex flex-col gap-2 group">
      <div className="bg-gray-50 rounded-md h-36 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl || "/placeholder.svg"}
          alt={product.family}
          loading="lazy"
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-400 font-mono">{product.modelNumber}</p>
        <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
          {product.family}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{product.brand}</p>
      </div>
      <div className="mt-auto pt-1 border-t border-gray-50">
        {lowestPrice != null ? (
          <>
            <p className="text-sm font-bold text-orange-600">
              Nga {lowestPrice.toLocaleString("sq-AL")} Lekë
            </p>
            {lowestPriceStore && (
              <p className="text-xs text-gray-500 mt-0.5">{lowestPriceStore}</p>
            )}
          </>
        ) : loading ? (
          <p className="text-xs text-gray-300 animate-pulse">Duke ngarkuar...</p>
        ) : (
          <p className="text-xs text-gray-400">Çmimi i panjohur</p>
        )}
      </div>
    </Link>
  );
}

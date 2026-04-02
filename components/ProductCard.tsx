"use client";

import Link from "next/link";
import { Product } from "@/src/domain/catalog/Product";

interface Props {
  product: Product;
  lowestPrice?: number | null;
}

export default function ProductCard({ product, lowestPrice }: Props) {
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
          <p className="text-sm font-bold text-orange-600">
            Nga {lowestPrice.toLocaleString("sq-AL")} ALL
          </p>
        ) : (
          <p className="text-xs text-gray-400">Çmimi i panjohur</p>
        )}
      </div>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { Product } from "@/lib/products";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/produkt/${product.id}`} className="card p-3 flex flex-col gap-2 group">
      <div className="bg-gray-50 rounded-md h-36 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.family}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.png";
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
        <p className="text-xs text-orange-600 font-medium">Krahaso çmimet →</p>
      </div>
    </Link>
  );
}

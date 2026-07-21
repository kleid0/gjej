"use client";

import { useEffect, useState } from "react";
import type { ProductVariant, ProductSpecs } from "@/src/domain/catalog/Product";

interface EnrichmentData {
  specs?: ProductSpecs;
  description?: string;
  officialImages?: string[];
  variant?: ProductVariant;
  fromCache?: boolean;
  notFound?: boolean;
  source?: string;
  sourceUrl?: string;
}

interface Props {
  productId: string;
  fallbackImage: string;
  productFamily: string;
}

const REGION_LABEL: Record<string, { label: string; color: string }> = {
  EU: { label: "Variant EU", color: "bg-blue-100 text-blue-700 border-blue-200" },
  US: { label: "Variant US", color: "bg-red-100 text-red-700 border-red-200" },
  Global: { label: "Global", color: "bg-green-100 text-green-700 border-green-200" },
  Unknown: { label: "Variant i panjohur", color: "bg-gray-100 text-gray-500 border-gray-200" },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed: "konfirmuar",
  likely: "me shumë gjasë",
  unclear: "i paqartë",
};

// Group specs by section (e.g. "Display: Size" → section "Display", key "Size")
function groupSpecs(specs: ProductSpecs): Array<{ section: string; items: Array<{ key: string; value: string }> }> {
  const groups = new Map<string, Array<{ key: string; value: string }>>();

  for (const [rawKey, value] of Object.entries(specs)) {
    const colonIdx = rawKey.indexOf(":");
    const section = colonIdx > 0 ? rawKey.slice(0, colonIdx).trim() : "Tjera";
    const key = colonIdx > 0 ? rawKey.slice(colonIdx + 1).trim() : rawKey;
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section)!.push({ key, value });
  }

  return Array.from(groups.entries()).map(([section, items]) => ({ section, items }));
}

export default function ProductEnrichmentPanel({ productId, fallbackImage, productFamily }: Props) {
  const [data, setData] = useState<EnrichmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>(fallbackImage);
  const [specsOpen, setSpecsOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSelectedImage(fallbackImage);
    setLoading(true);

    fetch(`/api/enrich?product=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((d: EnrichmentData) => {
        if (cancelled) return;
        setData(d);
        if (d.officialImages && d.officialImages.length > 0) {
          setSelectedImage(d.officialImages[0]);
        }
      })
      .catch(() => {
        if (!cancelled) setData({ notFound: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [productId, fallbackImage]);

  const variant = data?.variant;
  const regionInfo = variant?.region ? REGION_LABEL[variant.region] ?? REGION_LABEL.Unknown : null;
  const specs = data?.specs && Object.keys(data.specs).length > 0 ? data.specs : null;
  const specGroups = specs ? groupSpecs(specs) : [];
  const images = data?.officialImages?.length ? data.officialImages : [fallbackImage];

  return (
    <div>
      {/* Image gallery + variant/specs */}
      <div className="grid md:grid-cols-5 gap-8 mb-8">
        {/* Left: Image */}
        <div className="md:col-span-2 space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex items-center justify-center h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt={productFamily}
              className="max-h-full max-w-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
            />
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.slice(0, 5).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(img)}
                  className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden bg-gray-50 transition-colors ${
                    selectedImage === img ? "border-orange-500" : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-contain p-1"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Variant + key specs */}
        <div className="md:col-span-3 space-y-4">
          {/* Variant badge */}
          {loading && (
            <div className="flex gap-2">
              <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
              <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
            </div>
          )}
          {!loading && variant && variant.modelCode && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                {variant.modelCode}
              </span>
              {regionInfo && (
                <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${regionInfo.color}`}>
                  {regionInfo.label}
                  {variant.confidence !== "confirmed" && (
                    <span className="opacity-60 ml-1">({CONFIDENCE_LABEL[variant.confidence] ?? variant.confidence})</span>
                  )}
                </span>
              )}
              {variant.notes && (
                <span className="text-xs text-gray-400">{variant.notes}</span>
              )}
            </div>
          )}

          {/* Description */}
          {!loading && data?.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{data.description}</p>
          )}
          {loading && (
            <div className="space-y-2">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-4/5" />
            </div>
          )}

          {/* Key specs preview (first 6) */}
          {!loading && specGroups.length > 0 && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              {specGroups.slice(0, 3).map(({ section, items }) => (
                <div key={section}>
                  <div className="bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    {section}
                  </div>
                  {items.slice(0, 3).map(({ key, value }) => (
                    <div key={key} className="flex px-3 py-1.5 border-b border-gray-50 last:border-0 text-sm">
                      <span className="text-gray-500 w-32 shrink-0">{key}</span>
                      <span className="text-gray-800 font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {loading && (
            <div className="space-y-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full specs table */}
      {!loading && specGroups.length > 0 && (
        <div className="mb-8">
          <button
            onClick={() => setSpecsOpen((o) => !o)}
            className="flex items-center gap-2 text-base font-bold text-gray-800 mb-3 hover:text-orange-600 transition-colors"
          >
            <span>{specsOpen ? "▾" : "▸"}</span>
            Specifikimet teknike
            <span className="text-xs text-gray-400 font-normal ml-1">
              {loading ? "" : `(${Object.keys(specs ?? {}).length} të dhëna)`}
            </span>
          </button>

          {specsOpen && (
            <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
              {specGroups.map(({ section, items }) => (
                <div key={section}>
                  <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {section}
                  </div>
                  {items.map(({ key, value }) => (
                    <div key={key} className="flex px-4 py-2 bg-white text-sm hover:bg-gray-50 transition-colors">
                      <span className="text-gray-500 w-40 shrink-0 font-medium">{key}</span>
                      <span className="text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Specs unavailable message */}
      {!loading && data?.notFound && (
        <div className="border border-gray-100 rounded-xl p-6 text-center mb-8">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            Specifikimet teknike nuk janë të disponueshme
          </p>
          <p className="text-xs text-gray-400">
            Nuk arritëm të gjejmë të dhëna teknike për këtë produkt.
            Kontrolloni faqen e prodhuesit për më shumë informacion.
          </p>
        </div>
      )}

      {/* Source note */}
      {!loading && data && !data.notFound && (
        <p className="text-xs text-gray-400 mb-4">
          Të dhënat teknike nga{" "}
          {data.source
            ? data.source
            : data.variant?.modelCode?.startsWith("SM-")
              ? "GSMArena"
              : "faqja zyrtare e prodhuesit"}
          .
          {data.fromCache && " (ruajtur lokalisht)"}
        </p>
      )}
    </div>
  );
}

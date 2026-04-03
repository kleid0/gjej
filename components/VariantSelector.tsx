"use client";

import type { VariantConfig } from "@/src/domain/catalog/variants";

function isLightColour(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

interface Props {
  config: VariantConfig;
  selectedColour: string;
  selectedStorage: string;
  onColourChange: (nameEn: string) => void;
  onStorageChange: (storage: string) => void;
}

export default function VariantSelector({
  config,
  selectedColour,
  selectedStorage,
  onColourChange,
  onStorageChange,
}: Props) {
  const showColours = config.colours.length > 1;
  const showStorage = config.storageOptions.length > 1;
  if (!showColours && !showStorage) return null;

  const selectedColourObj = config.colours.find((c) => c.nameEn === selectedColour);

  return (
    <div className="space-y-5">
      {/* Colour swatches */}
      {showColours && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Ngjyra{selectedColourObj ? ` \u2014 ${selectedColourObj.name}` : ""}
          </p>
          <div className="flex flex-wrap gap-3">
            {config.colours.map((c) => {
              const active = c.nameEn === selectedColour;
              const light = isLightColour(c.hex);
              return (
                <button
                  key={c.nameEn}
                  onClick={() => onColourChange(c.nameEn)}
                  title={c.name}
                  aria-label={c.name}
                  /* Minimum 44×44px touch target for mobile (WCAG 2.5.5) */
                  className={`w-11 h-11 rounded-full border-2 transition-all relative flex items-center justify-center ${
                    active
                      ? "border-orange-500 shadow-md scale-110"
                      : "border-gray-200 hover:border-gray-400 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {active && (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke={light ? "#333" : "#fff"}
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Storage buttons */}
      {showStorage && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Hapesira
          </p>
          <div className="flex flex-wrap gap-2">
            {config.storageOptions.map((s) => {
              const active = s === selectedStorage;
              return (
                <button
                  key={s}
                  onClick={() => onStorageChange(s)}
                  /* min-h-11 ensures ≥44px touch target on mobile */
                  className={`px-4 min-h-11 rounded-lg text-sm font-semibold border-2 transition-all ${
                    active
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

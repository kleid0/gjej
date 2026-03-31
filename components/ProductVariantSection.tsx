"use client";

import { useState, useEffect } from "react";
import VariantSelector from "./VariantSelector";
import PriceComparison from "./PriceComparison";
import type { VariantConfig } from "@/src/domain/catalog/variants";

interface Props {
  productId: string;
  variantConfig: VariantConfig | null;
  initialColour?: string;
  initialStorage?: string;
}

export default function ProductVariantSection({
  productId,
  variantConfig,
  initialColour,
  initialStorage,
}: Props) {
  const config = variantConfig;

  // Resolve initial values against the config (case-insensitive URL matching)
  const [colour, setColour] = useState(() => {
    if (!config) return "";
    return (
      config.colours.find((c) => c.nameEn.toLowerCase() === initialColour?.toLowerCase())?.nameEn ??
      config.defaultColour
    );
  });

  const [storage, setStorage] = useState(() => {
    if (!config) return "";
    return (
      config.storageOptions.find((s) => s.toLowerCase() === initialStorage?.toLowerCase()) ??
      config.defaultStorage
    );
  });

  // Track whether URL should be synced (only after user interaction or initial URL params)
  const [syncUrl, setSyncUrl] = useState(
    Boolean(initialColour || initialStorage),
  );

  function handleColourChange(c: string) {
    setColour(c);
    setSyncUrl(true);
  }

  function handleStorageChange(s: string) {
    setStorage(s);
    setSyncUrl(true);
  }

  // Update URL for shareable links
  useEffect(() => {
    if (!config || !syncUrl) return;
    const url = new URL(window.location.href);
    if (colour) url.searchParams.set("ngjyre", colour.toLowerCase());
    if (storage) url.searchParams.set("hapesire", storage.toLowerCase());
    window.history.replaceState(null, "", url.toString());
  }, [colour, storage, config, syncUrl]);

  if (!config) {
    return <PriceComparison productId={productId} />;
  }

  return (
    <>
      <VariantSelector
        config={config}
        selectedColour={colour}
        selectedStorage={storage}
        onColourChange={handleColourChange}
        onStorageChange={handleStorageChange}
      />
      <PriceComparison
        productId={productId}
        variantColour={colour}
        variantStorage={storage}
      />
    </>
  );
}

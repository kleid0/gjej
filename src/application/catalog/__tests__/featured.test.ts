import { describe, it, expect } from "vitest";
import { pickFeatured, popularityScore, type ScoredProduct } from "../featured";
import type { Product } from "@/src/domain/catalog/Product";

let seq = 0;
function sp(over: Partial<Product> & { storeCount?: number; hasStock?: boolean }): ScoredProduct {
  const { storeCount = 2, hasStock = true, ...prod } = over;
  return {
    product: {
      id: prod.id ?? `p${seq++}`,
      modelNumber: "",
      family: prod.family ?? "Thing",
      brand: prod.brand ?? "Acme",
      category: prod.category ?? "telefona",
      subcategory: prod.subcategory ?? "Smartphone",
      imageUrl: prod.imageUrl ?? "https://img/x.jpg",
      storageOptions: [],
      searchTerms: [],
      ...prod,
    },
    storeCount,
    hasStock,
  };
}

describe("popularityScore", () => {
  it("ranks a desirable, in-stock, known-brand product above a generic long-tail one", () => {
    const hot = sp({ category: "telefona", brand: "Apple", storeCount: 4, imageUrl: "https://img/a.jpg" });
    const meh = sp({ category: "elektronike", brand: "NoName", storeCount: 1, imageUrl: "https://img/b.jpg" });
    expect(popularityScore(hot)).toBeGreaterThan(popularityScore(meh));
  });
});

describe("pickFeatured", () => {
  it("excludes products without a real image or without stock", () => {
    const items = [
      sp({ id: "keep", imageUrl: "https://img/x.jpg", hasStock: true }),
      sp({ id: "noimg", imageUrl: "", hasStock: true }),
      sp({ id: "placeholder", imageUrl: "/placeholder.svg", hasStock: true }),
      sp({ id: "oos", imageUrl: "https://img/y.jpg", hasStock: false }),
    ];
    const ids = pickFeatured(items, { count: 8 }).map((p) => p.id);
    expect(ids).toContain("keep");
    expect(ids).not.toContain("noimg");
    expect(ids).not.toContain("placeholder");
    expect(ids).not.toContain("oos");
  });

  it("enforces category diversity — no wall of one category", () => {
    // 20 kitchen appliances + a few desirable items
    const appliances = Array.from({ length: 20 }, (_, i) =>
      sp({ id: `ap${i}`, category: "shtepiake", subcategory: "Furre & Gatim", storeCount: 5 }),
    );
    const others = [
      sp({ id: "phone", category: "telefona", brand: "Apple" }),
      sp({ id: "laptop", category: "kompjutera", brand: "Dell" }),
      sp({ id: "console", category: "gaming", brand: "Nintendo" }),
    ];
    const picked = pickFeatured([...appliances, ...others], { count: 8, perCat: 2 });
    const appliancePicks = picked.filter((p) => p.category === "shtepiake").length;
    expect(appliancePicks).toBeLessThanOrEqual(2);
    expect(picked.map((p) => p.id)).toEqual(expect.arrayContaining(["phone", "laptop", "console"]));
  });

  it("rotates the window with the day so the grid changes", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      sp({ id: `p${i}`, category: ["telefona", "kompjutera", "gaming", "tv-audio"][i % 4] }),
    );
    const day0 = pickFeatured(items, { count: 8, day: 0 }).map((p) => p.id);
    const day1 = pickFeatured(items, { count: 8, day: 1 }).map((p) => p.id);
    expect(day0).not.toEqual(day1);
  });

  it("always returns a full grid when enough eligible products exist", () => {
    const items = Array.from({ length: 40 }, (_, i) =>
      sp({ id: `p${i}`, category: ["telefona", "kompjutera", "gaming", "tv-audio", "foto-video", "bukuri"][i % 6] }),
    );
    expect(pickFeatured(items, { count: 8 })).toHaveLength(8);
  });
});

import { describe, it, expect } from "vitest";
import { buildNavMenu } from "../NavMenu";
import type { Product } from "@/src/domain/catalog/Product";

const product = (over: Partial<Product>): Product => ({
  id: "p1",
  modelNumber: "",
  family: "Test",
  brand: "Acme",
  category: "telefona",
  subcategory: "Smartphone",
  imageUrl: "",
  storageOptions: [],
  searchTerms: [],
  ...over,
});

describe("buildNavMenu", () => {
  it("ranks brands by product count and filters parsing artifacts", () => {
    const products = [
      product({ id: "a", brand: "Samsung" }),
      product({ id: "b", brand: "Samsung" }),
      product({ id: "c", brand: "Apple" }),
      product({ id: "d", brand: "portativ" }), // lowercase artifact
      product({ id: "e", brand: "pa" }),       // stopword artifact
    ];
    const telefona = buildNavMenu(products).find((c) => c.id === "telefona")!;
    expect(telefona.topBrands).toEqual(["Samsung", "Apple"]);
  });

  it("only lists subcategories that contain products", () => {
    const telefona = buildNavMenu([product({ subcategory: "Tablet" })]).find(
      (c) => c.id === "telefona",
    )!;
    expect(telefona.subcategories).toEqual(["Tablet"]);
  });

  it("features only image-bearing products, enriched first, max 3", () => {
    const products = [
      product({ id: "no-img", imageUrl: "" }),
      product({ id: "plain", imageUrl: "https://x/1.jpg" }),
      product({ id: "rich", imageUrl: "https://x/2.jpg", enrichedAt: "2026-01-01" }),
      product({ id: "p3", imageUrl: "https://x/3.jpg" }),
      product({ id: "p4", imageUrl: "https://x/4.jpg" }),
    ];
    const telefona = buildNavMenu(products).find((c) => c.id === "telefona")!;
    expect(telefona.featured).toHaveLength(3);
    expect(telefona.featured[0].id).toBe("rich");
    expect(telefona.featured.map((f) => f.id)).not.toContain("no-img");
  });

  it("returns every category even when empty", () => {
    const nav = buildNavMenu([]);
    expect(nav.length).toBeGreaterThanOrEqual(12);
    for (const cat of nav) {
      expect(cat.subcategories).toEqual([]);
      expect(cat.topBrands).toEqual([]);
      expect(cat.featured).toEqual([]);
    }
  });
});

import { describe, it, expect } from "vitest";
import {
  getVariantConfig,
  extractStorageFromFamily,
  buildVariantSearchTerms,
} from "../variants";
import type { Product } from "../Product";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    modelNumber: "",
    family: "iPhone 17",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "",
    storageOptions: [],
    searchTerms: [],
    ...overrides,
  };
}

// ── getVariantConfig ─────────────────────────────────────────────────────────

describe("getVariantConfig — base model matching", () => {
  it("matches iPhone 17 Pro Max BEFORE Pro (most-specific-first)", () => {
    const cfg = getVariantConfig(makeProduct({ family: "Apple iPhone 17 Pro Max 256GB" }));
    expect(cfg?.baseFamily).toBe("iPhone 17 Pro Max");
  });

  it("matches iPhone 17 Pro when 'Max' is absent", () => {
    const cfg = getVariantConfig(makeProduct({ family: "Apple iPhone 17 Pro 256GB" }));
    expect(cfg?.baseFamily).toBe("iPhone 17 Pro");
  });

  it("matches bare iPhone 17 without 'Pro', 'Air', or 'Plus'", () => {
    const cfg = getVariantConfig(makeProduct({ family: "Apple iPhone 17 128GB Black" }));
    expect(cfg?.baseFamily).toBe("iPhone 17");
  });

  it("matches Galaxy S25 Ultra before S25", () => {
    const cfg = getVariantConfig(
      makeProduct({ brand: "Samsung", family: "Samsung Galaxy S25 Ultra 512GB" }),
    );
    expect(cfg?.baseFamily).toBe("Galaxy S25 Ultra");
  });

  it("matches Galaxy S25+ distinct from bare S25", () => {
    const plus = getVariantConfig(
      makeProduct({ brand: "Samsung", family: "Galaxy S25+ 256GB" }),
    );
    const bare = getVariantConfig(
      makeProduct({ brand: "Samsung", family: "Galaxy S25 128GB" }),
    );
    expect(plus?.baseFamily).toBe("Galaxy S25+");
    expect(bare?.baseFamily).toBe("Galaxy S25");
  });

  it("matches Galaxy S25 FE distinct from bare S25", () => {
    const fe = getVariantConfig(
      makeProduct({ brand: "Samsung", family: "Galaxy S25 FE 128GB" }),
    );
    expect(fe?.baseFamily).toBe("Galaxy S25 FE");
  });

  it("matches Pixel 10 Pro XL before Pixel 10 Pro", () => {
    const cfg = getVariantConfig(
      makeProduct({ brand: "Google", family: "Pixel 10 Pro XL 256GB" }),
    );
    expect(cfg?.baseFamily).toBe("Pixel 10 Pro XL");
  });

  it("returns null for unknown models", () => {
    const cfg = getVariantConfig(makeProduct({ family: "Nokia 3310" }));
    expect(cfg).toBeNull();
  });

  it("returns null for non-variant subcategories", () => {
    const cfg = getVariantConfig(
      makeProduct({ subcategory: "TV", family: "iPhone 17 sticker" }),
    );
    expect(cfg).toBeNull();
  });
});

describe("getVariantConfig — accessory rejection", () => {
  it.each([
    "iPhone 17 Pro Max Case Silicone",
    "iPhone 17 Cover Leather",
    "Tempered Glass iPhone 17",
    "Folie iPhone 17",
    "Kabllo Karikues iPhone 17",
    "Mbrojtese iPhone 17",
    "Lens protector iPhone 17",
    "iPhone 17 wallet case",
    "Kover iPhone 17",
  ])("returns null for accessory name %q", (family) => {
    const cfg = getVariantConfig(makeProduct({ family }));
    expect(cfg).toBeNull();
  });

  it("still matches the phone itself when name is clean", () => {
    const cfg = getVariantConfig(makeProduct({ family: "Apple iPhone 17 128GB" }));
    expect(cfg).not.toBeNull();
  });
});

// ── extractStorageFromFamily ────────────────────────────────────────────────

describe("extractStorageFromFamily", () => {
  it("extracts '128GB' with uppercase normalisation", () => {
    expect(extractStorageFromFamily("iPhone 17 128gb")).toBe("128GB");
    expect(extractStorageFromFamily("iPhone 17 128 GB")).toBe("128GB");
  });

  it("extracts terabyte sizes", () => {
    expect(extractStorageFromFamily("iPhone 17 Pro 1TB")).toBe("1TB");
  });

  it("returns null when no capacity is present", () => {
    expect(extractStorageFromFamily("iPhone 17")).toBeNull();
    expect(extractStorageFromFamily("")).toBeNull();
  });

  it("returns the first capacity when multiple are present", () => {
    // Real-world: "12+256GB" — regex matches "12" followed by "+" which is a
    // non-word char, but the pattern requires GB/TB directly after — so
    // actually matches "256GB". Confirm behaviour:
    expect(extractStorageFromFamily("Xiaomi 15 12+256GB")).toBe("256GB");
  });
});

// ── buildVariantSearchTerms ─────────────────────────────────────────────────

describe("buildVariantSearchTerms", () => {
  const product = makeProduct({
    brand: "Apple",
    family: "iPhone 17 Pro Max 256GB",
    searchTerms: ["iPhone 17 Pro Max", "Apple iPhone 17 Pro Max"],
  });

  it("prepends '!' to lock variant-specific queries from cleanQuery stripping", () => {
    const terms = buildVariantSearchTerms(product, "Black", "256GB");
    // First term should carry both storage and colour, with !
    expect(terms[0].startsWith("!")).toBe(true);
    expect(terms[0]).toContain("256GB");
    expect(terms[0]).toContain("Black");
    expect(terms[0]).toContain("iPhone 17 Pro Max");
  });

  it("generates both branded and un-branded variants when colour+storage given", () => {
    const terms = buildVariantSearchTerms(product, "Black", "256GB");
    expect(terms).toEqual(expect.arrayContaining([
      "!Apple iPhone 17 Pro Max 256GB Black",
      "!iPhone 17 Pro Max 256GB Black",
      "!Apple iPhone 17 Pro Max 256GB",
      "!iPhone 17 Pro Max 256GB",
    ]));
  });

  it("appends the original searchTerms at the end (no ! prefix)", () => {
    const terms = buildVariantSearchTerms(product, "Black", "256GB");
    const tail = terms.slice(-2);
    expect(tail).toEqual(["iPhone 17 Pro Max", "Apple iPhone 17 Pro Max"]);
  });

  it("skips combined colour+storage terms when storage is empty", () => {
    const terms = buildVariantSearchTerms(product, "Black", "");
    expect(terms.some((t) => t === "!Apple iPhone 17 Pro Max Black")).toBe(true);
    expect(terms.every((t) => !t.includes("256GB"))).toBe(true);
  });

  it("skips colour-only terms when colour is empty", () => {
    const terms = buildVariantSearchTerms(product, "", "256GB");
    expect(terms.some((t) => t === "!Apple iPhone 17 Pro Max 256GB")).toBe(true);
    expect(terms.every((t) => !t.includes("Black"))).toBe(true);
  });

  it("falls back to the product's own searchTerms when no variant config matches", () => {
    const unknown = makeProduct({
      family: "Nokia 3310",
      searchTerms: ["Nokia 3310"],
    });
    const terms = buildVariantSearchTerms(unknown, "Black", "32GB");
    expect(terms).toEqual(["Nokia 3310"]);
  });
});

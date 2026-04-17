import { describe, it, expect, vi } from "vitest";
import { DuplicateFuser, fusionKey, fuseGroup } from "../DuplicateFuser";
import type { Product } from "@/src/domain/catalog/Product";
import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? "p1",
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

function makeRepo(products: Product[]): IProductRepository & {
  saveAll: ReturnType<typeof vi.fn>;
} {
  return {
    getAll: vi.fn(async () => products),
    getById: vi.fn(),
    getByCategory: vi.fn(),
    search: vi.fn(),
    getFamilySiblings: vi.fn(),
    saveAll: vi.fn(async () => {}),
  };
}

// ── fusionKey ─────────────────────────────────────────────────────────────────

describe("fusionKey", () => {
  it("strips store-specific family prefixes", () => {
    const a = fusionKey(makeProduct({ family: "Celular Apple iPhone 17" }));
    const b = fusionKey(makeProduct({ family: "Telefon Apple iPhone 17" }));
    const c = fusionKey(makeProduct({ family: "Apple iPhone 17" }));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("strips colour names in Albanian and English", () => {
    const a = fusionKey(makeProduct({ family: "iPhone 17 Black" }));
    const b = fusionKey(makeProduct({ family: "iPhone 17 i zi" }));
    const c = fusionKey(makeProduct({ family: "iPhone 17" }));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("strips storage sizes for phone categories", () => {
    const a = fusionKey(makeProduct({ family: "iPhone 17 128GB" }));
    const b = fusionKey(makeProduct({ family: "iPhone 17 256GB" }));
    expect(a).toBe(b);
  });

  it("KEEPS storage sizes for non-phone categories (SSD capacity is the product)", () => {
    const a = fusionKey(
      makeProduct({
        family: "Samsung 990 PRO 1TB",
        category: "kompjutera",
        subcategory: "SSD & RAM",
      }),
    );
    const b = fusionKey(
      makeProduct({
        family: "Samsung 990 PRO 2TB",
        category: "kompjutera",
        subcategory: "SSD & RAM",
      }),
    );
    expect(a).not.toBe(b);
  });

  it("strips RAM+storage specs like 12+256GB before the general storage strip", () => {
    // Bug: STORAGE_PATTERN previously ran first and ate '256GB', leaving '12+'
    // which the RAM regex couldn't match. Fix: RAM strip now runs first.
    const a = fusionKey(makeProduct({ family: "Xiaomi 15 12+256GB" }));
    const b = fusionKey(makeProduct({ family: "Xiaomi 15 8+128GB" }));
    expect(a).toBe(b);
  });

  it("normalises brand trademark symbols", () => {
    const a = fusionKey(makeProduct({ brand: "Lexar®" }));
    const b = fusionKey(makeProduct({ brand: "lexar" }));
    expect(a).toBe(b);
  });

  it("strips bundle add-ons after a late ' + ' (word index >= 3)", () => {
    const a = fusionKey(
      makeProduct({ family: "Nintendo Switch 2 + Mario Kart" }),
    );
    const b = fusionKey(makeProduct({ family: "Nintendo Switch 2" }));
    expect(a).toBe(b);
  });

  it("KEEPS early ' + ' in multi-device product names", () => {
    // "Tastiere + Mouse HP 150" — "+" is at word index 1, should be preserved
    const combo = fusionKey(makeProduct({ family: "Tastiere + Mouse HP 150" }));
    const solo = fusionKey(makeProduct({ family: "Mouse HP 150" }));
    expect(combo).not.toBe(solo);
  });

  it("strips eSIM / Dual SIM variant markers", () => {
    const a = fusionKey(makeProduct({ family: "iPhone 17 eSIM" }));
    const b = fusionKey(makeProduct({ family: "iPhone 17 Dual SIM" }));
    const c = fusionKey(makeProduct({ family: "iPhone 17" }));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("strips SM-* model suffixes", () => {
    const a = fusionKey(
      makeProduct({ brand: "Samsung", family: "Galaxy S25 SM-S931B" }),
    );
    const b = fusionKey(makeProduct({ brand: "Samsung", family: "Galaxy S25" }));
    expect(a).toBe(b);
  });

  it("produces different keys for different brands", () => {
    const a = fusionKey(makeProduct({ brand: "Apple", family: "17 Pro" }));
    const b = fusionKey(makeProduct({ brand: "Xiaomi", family: "17 Pro" }));
    expect(a).not.toBe(b);
  });
});

// ── fuseGroup ─────────────────────────────────────────────────────────────────

describe("fuseGroup", () => {
  it("returns the single product unchanged when group size is 1", () => {
    const p = makeProduct();
    expect(fuseGroup([p])).toBe(p);
  });

  it("prefers the product with a valid http image", () => {
    const withImg = makeProduct({ id: "a", imageUrl: "https://cdn.example/a.jpg" });
    const noImg = makeProduct({ id: "b", imageUrl: "" });
    expect(fuseGroup([noImg, withImg]).id).toBe("a");
  });

  it("prefers enriched products (enrichedAt + specs) over bare ones", () => {
    const enriched = makeProduct({
      id: "a",
      imageUrl: "https://cdn.example/a.jpg",
      enrichedAt: "2026-01-01",
      specs: { display: "6.1\"" },
    });
    const bare = makeProduct({
      id: "b",
      imageUrl: "https://cdn.example/b.jpg",
    });
    expect(fuseGroup([bare, enriched]).id).toBe("a");
  });

  it("prefers shorter family names (less store noise) when other signals tie", () => {
    const short = makeProduct({ id: "a", family: "iPhone 17" });
    const long = makeProduct({
      id: "b",
      family: "Celular Smartphone Apple iPhone 17 Black 128GB Brand New",
    });
    expect(fuseGroup([long, short]).id).toBe("a");
  });

  it("merges searchTerms from every product in the group", () => {
    const a = makeProduct({ id: "a", searchTerms: ["iPhone 17"] });
    const b = makeProduct({ id: "b", searchTerms: ["Apple iPhone 17"] });
    const c = makeProduct({ id: "c", searchTerms: ["iphone17"] });
    const fused = fuseGroup([a, b, c]);
    expect(new Set(fused.searchTerms)).toEqual(
      new Set(["iPhone 17", "Apple iPhone 17", "iphone17"]),
    );
  });

  it("merges storageOptions and dedupes by label", () => {
    const a = makeProduct({
      id: "a",
      storageOptions: [{ label: "128GB" }, { label: "256GB" }],
    });
    const b = makeProduct({
      id: "b",
      storageOptions: [{ label: "256GB" }, { label: "512GB" }],
    });
    const fused = fuseGroup([a, b]);
    expect(fused.storageOptions.map((o) => o.label).sort()).toEqual([
      "128GB",
      "256GB",
      "512GB",
    ]);
  });
});

// ── DuplicateFuser service ────────────────────────────────────────────────────

describe("DuplicateFuser.detect", () => {
  it("counts groups and produces absorbed samples without saving", async () => {
    const products = [
      makeProduct({ id: "1", family: "Celular iPhone 17 128GB Black" }),
      makeProduct({ id: "2", family: "iPhone 17 256GB White" }),
      makeProduct({ id: "3", family: "Galaxy S25", brand: "Samsung" }),
    ];
    const repo = makeRepo(products);
    const fuser = new DuplicateFuser(repo);

    const result = await fuser.detect();

    expect(result.before).toBe(3);
    expect(result.after).toBe(2); // two unique fusion keys
    expect(result.eliminated).toBe(1);
    expect(result.groupsFused).toBe(1);
    expect(result.samples).toHaveLength(1);
    expect(repo.saveAll).not.toHaveBeenCalled();
  });

  it("returns zero eliminations when nothing is duplicated", async () => {
    const products = [
      makeProduct({ id: "1", family: "iPhone 17", brand: "Apple" }),
      makeProduct({ id: "2", family: "Galaxy S25", brand: "Samsung" }),
    ];
    const repo = makeRepo(products);
    const fuser = new DuplicateFuser(repo);

    const result = await fuser.detect();
    expect(result.eliminated).toBe(0);
    expect(result.groupsFused).toBe(0);
    expect(result.samples).toHaveLength(0);
  });
});

describe("DuplicateFuser.fuse", () => {
  it("saves the fused catalog when duplicates are found", async () => {
    const products = [
      makeProduct({
        id: "1",
        family: "Celular iPhone 17 128GB Black",
        imageUrl: "",
        searchTerms: ["iPhone 17 Black"],
      }),
      makeProduct({
        id: "2",
        family: "iPhone 17 256GB",
        imageUrl: "https://cdn.apple.com/iphone17.jpg",
        searchTerms: ["iPhone 17"],
        storageOptions: [{ label: "256GB" }],
      }),
    ];
    const repo = makeRepo(products);
    const fuser = new DuplicateFuser(repo);

    const result = await fuser.fuse();

    expect(result.eliminated).toBe(1);
    expect(repo.saveAll).toHaveBeenCalledTimes(1);

    const saved: Product[] = repo.saveAll.mock.calls[0][0];
    expect(saved).toHaveLength(1);
    // product 2 wins (has image) — id/family/imageUrl come from it
    expect(saved[0].id).toBe("2");
    expect(saved[0].imageUrl).toContain("apple.com");
    // searchTerms merged from both
    expect(new Set(saved[0].searchTerms)).toEqual(
      new Set(["iPhone 17 Black", "iPhone 17"]),
    );
  });

  it("does not call saveAll when nothing was eliminated", async () => {
    const repo = makeRepo([
      makeProduct({ id: "1", family: "iPhone 17", brand: "Apple" }),
    ]);
    const fuser = new DuplicateFuser(repo);

    const result = await fuser.fuse();
    expect(result.eliminated).toBe(0);
    expect(repo.saveAll).not.toHaveBeenCalled();
  });

  it("strips the internal _fused field from the public result", async () => {
    const repo = makeRepo([
      makeProduct({ id: "1", family: "iPhone 17 Black" }),
      makeProduct({ id: "2", family: "iPhone 17 White" }),
    ]);
    const fuser = new DuplicateFuser(repo);

    const result = await fuser.fuse();
    expect("_fused" in result).toBe(false);
  });

  it("caps samples at 20 even when many groups are fused", async () => {
    const products: Product[] = [];
    // Build 25 duplicate groups
    for (let i = 0; i < 25; i++) {
      products.push(makeProduct({ id: `${i}-a`, family: `Model ${i} Black` }));
      products.push(makeProduct({ id: `${i}-b`, family: `Model ${i} White` }));
    }
    const repo = makeRepo(products);
    const fuser = new DuplicateFuser(repo);

    const result = await fuser.detect();
    expect(result.groupsFused).toBe(25);
    expect(result.samples).toHaveLength(20);
  });
});

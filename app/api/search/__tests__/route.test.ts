import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock the DI container ──────────────────────────────────────────────────────

const { mockProductCatalog } = vi.hoisted(() => ({
  mockProductCatalog: {
    searchProducts: vi.fn(),
    getCategories: vi.fn(),
  },
}));

vi.mock("@/src/infrastructure/container", () => ({
  productCatalog: mockProductCatalog,
}));

import { GET } from "../route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(search: string) {
  return new NextRequest(`https://gjej.al/api/search${search}`);
}

const categories = [
  { id: "telefona", name: "Telefona & Tablets", icon: "📱", subcategories: ["Smartphone", "Tablet"] },
  { id: "kompjutera", name: "Kompjutera", icon: "💻", subcategories: ["Laptop", "Desktop PC"] },
];

function makeProduct(id: string, family: string) {
  return { id, family, brand: "Apple", imageUrl: "", category: "telefona", subcategory: "Smartphone" };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductCatalog.searchProducts.mockResolvedValue([]);
    mockProductCatalog.getCategories.mockReturnValue(categories);
  });

  it("returns empty results when q is absent", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products).toEqual([]);
    expect(body.categories).toEqual([]);
  });

  it("returns empty results when q is a single character", async () => {
    const res = await GET(makeReq("?q=a"));
    const body = await res.json();
    expect(body.products).toEqual([]);
    expect(body.categories).toEqual([]);
    expect(mockProductCatalog.searchProducts).not.toHaveBeenCalled();
  });

  it("returns empty results when q is whitespace only (trimmed to '')", async () => {
    const res = await GET(makeReq("?q=%20"));
    const body = await res.json();
    expect(body.products).toEqual([]);
  });

  it("calls searchProducts for queries of 2+ characters", async () => {
    mockProductCatalog.searchProducts.mockResolvedValue([makeProduct("p1", "iPhone 17")]);
    await GET(makeReq("?q=ip"));
    expect(mockProductCatalog.searchProducts).toHaveBeenCalledWith("ip");
  });

  it("limits product results to 6", async () => {
    const many = Array.from({ length: 10 }, (_, i) => makeProduct(`p${i}`, `Product ${i}`));
    mockProductCatalog.searchProducts.mockResolvedValue(many);
    const res = await GET(makeReq("?q=product"));
    const body = await res.json();
    expect(body.products).toHaveLength(6);
  });

  it("maps product fields to the expected shape (drops searchTerms, specs, etc.)", async () => {
    mockProductCatalog.searchProducts.mockResolvedValue([makeProduct("p1", "iPhone 17")]);
    const res = await GET(makeReq("?q=iphone"));
    const body = await res.json();
    const p = body.products[0];
    expect(Object.keys(p).sort()).toEqual(
      ["brand", "category", "family", "id", "imageUrl", "subcategory"].sort(),
    );
  });

  it("matches categories by name", async () => {
    const res = await GET(makeReq("?q=Kompjutera"));
    const body = await res.json();
    expect(body.categories.map((c: { id: string }) => c.id)).toContain("kompjutera");
  });

  it("matches categories by subcategory", async () => {
    const res = await GET(makeReq("?q=Laptop"));
    const body = await res.json();
    expect(body.categories.map((c: { id: string }) => c.id)).toContain("kompjutera");
  });

  it("category search is case-insensitive", async () => {
    const res = await GET(makeReq("?q=smartphone"));
    const body = await res.json();
    expect(body.categories.map((c: { id: string }) => c.id)).toContain("telefona");
  });

  it("returns no matching categories when query matches neither name nor subcategory", async () => {
    const res = await GET(makeReq("?q=xyznomatch"));
    const body = await res.json();
    expect(body.categories).toEqual([]);
  });
});

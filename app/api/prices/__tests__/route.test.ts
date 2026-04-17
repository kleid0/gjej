import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock the DI container ──────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file, so mock objects must be created
// with vi.hoisted() to be accessible inside the factory.

const { mockPriceQuery, mockProductCatalog } = vi.hoisted(() => ({
  mockPriceQuery: {
    getPricesForProduct: vi.fn(),
  },
  mockProductCatalog: {
    getProductById: vi.fn(),
  },
}));

vi.mock("@/src/infrastructure/container", () => ({
  priceQuery: mockPriceQuery,
  productCatalog: mockProductCatalog,
}));

import { GET } from "../route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(search: string) {
  return new NextRequest(`https://gjej.al/api/prices${search}`);
}

const baseProduct = {
  id: "apple-iphone-17",
  family: "iPhone 17",
  brand: "Apple",
  category: "telefona",
  subcategory: "Smartphone",
  imageUrl: "",
  storageOptions: [],
  searchTerms: ["iPhone 17", "Apple iPhone 17"],
  modelNumber: "",
};

const basePriceResult = {
  prices: [{ storeId: "a", price: 999, inStock: true, stockLabel: "Në stok", productUrl: null, lastChecked: "" }],
  fromCache: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/prices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductCatalog.getProductById.mockResolvedValue(baseProduct);
    mockPriceQuery.getPricesForProduct.mockResolvedValue(basePriceResult);
  });

  it("returns 400 when product query param is missing", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/product/i);
  });

  it("returns 404 when product is not found in catalog", async () => {
    mockProductCatalog.getProductById.mockResolvedValue(null);
    const res = await GET(makeReq("?product=nonexistent"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns prices for a known product", async () => {
    const res = await GET(makeReq("?product=apple-iphone-17"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prices).toHaveLength(1);
    expect(body.prices[0].price).toBe(999);
  });

  it("uses the product's own searchTerms when no variant params are given", async () => {
    await GET(makeReq("?product=apple-iphone-17"));
    expect(mockPriceQuery.getPricesForProduct).toHaveBeenCalledWith(
      "apple-iphone-17",
      baseProduct.searchTerms,
      undefined,
      false,
    );
  });

  it("builds a variant cacheKey when ngjyre (colour) is provided", async () => {
    await GET(makeReq("?product=apple-iphone-17&ngjyre=Black"));
    const [, , cacheKey] = mockPriceQuery.getPricesForProduct.mock.calls[0];
    expect(cacheKey).toMatch(/apple-iphone-17/);
    expect(cacheKey).toMatch(/black/);
  });

  it("builds a variant cacheKey when hapesire (storage) is provided", async () => {
    await GET(makeReq("?product=apple-iphone-17&hapesire=256GB"));
    const [, , cacheKey] = mockPriceQuery.getPricesForProduct.mock.calls[0];
    expect(cacheKey).toMatch(/256gb/);
  });

  it("builds cacheKey combining both ngjyre and hapesire", async () => {
    await GET(makeReq("?product=apple-iphone-17&ngjyre=Black&hapesire=256GB"));
    const [, , cacheKey] = mockPriceQuery.getPricesForProduct.mock.calls[0];
    expect(cacheKey).toBe("apple-iphone-17:black:256gb");
  });

  it("passes forceRefresh=true when force=1", async () => {
    await GET(makeReq("?product=apple-iphone-17&force=1"));
    const [, , , forceRefresh] = mockPriceQuery.getPricesForProduct.mock.calls[0];
    expect(forceRefresh).toBe(true);
  });

  it("does not pass forceRefresh when force is absent", async () => {
    await GET(makeReq("?product=apple-iphone-17"));
    const [, , , forceRefresh] = mockPriceQuery.getPricesForProduct.mock.calls[0];
    expect(forceRefresh).toBe(false);
  });

  it("rewrites 'Produkti nuk u gjet' to variant message when variant params present", async () => {
    mockPriceQuery.getPricesForProduct.mockResolvedValue({
      prices: [
        { storeId: "a", price: null, inStock: null, stockLabel: "", productUrl: null,
          lastChecked: "", error: "Produkti nuk u gjet" },
      ],
      fromCache: false,
    });

    const res = await GET(makeReq("?product=apple-iphone-17&ngjyre=Black"));
    const body = await res.json();
    expect(body.prices[0].error).toBe("Ky variant nuk disponohet");
  });

  it("does NOT rewrite error message when no variant params", async () => {
    mockPriceQuery.getPricesForProduct.mockResolvedValue({
      prices: [
        { storeId: "a", price: null, inStock: null, stockLabel: "", productUrl: null,
          lastChecked: "", error: "Produkti nuk u gjet" },
      ],
      fromCache: false,
    });

    const res = await GET(makeReq("?product=apple-iphone-17"));
    const body = await res.json();
    expect(body.prices[0].error).toBe("Produkti nuk u gjet");
  });
});

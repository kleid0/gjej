// Unit test for the Fix E store_mappings batch writer.
// Mocks the pg client layer so we can assert on the SQL shape without a real DB.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { rawQueryMock, sqlMock } = vi.hoisted(() => ({
  rawQueryMock: vi.fn(async (_sql: string, _params: unknown[]) => ({ rows: [] })),
  sqlMock: vi.fn(async () => ({ rows: [] })),
}));

vi.mock("@/src/infrastructure/db/client", () => ({
  rawQuery: rawQueryMock,
  sql: sqlMock,
  ensureSchema: vi.fn(async () => {}),
}));

import { batchRecordStoreMappings } from "../PriceHistoryRepository";

describe("batchRecordStoreMappings", () => {
  beforeEach(() => {
    rawQueryMock.mockClear();
    sqlMock.mockClear();
  });

  it("is a no-op on empty input", async () => {
    await batchRecordStoreMappings([]);
    expect(rawQueryMock).not.toHaveBeenCalled();
  });

  it("emits a single multi-row UPSERT with clamped confidence", async () => {
    await batchRecordStoreMappings([
      {
        storeId: "foleja",
        storeProductId: "abc",
        storeProductName: "iPhone 17 Pro",
        catalogueProductId: "apple-iphone-17-pro-256gb",
        confidence: 150, // above range — should be clamped to 100
      },
      {
        storeId: "neptun",
        storeProductId: "/iphone-17-12345",
        storeProductName: null,
        catalogueProductId: "apple-iphone-17-pro-256gb",
        confidence: -5, // below range — should be clamped to 0
        matchMethod: "slug_match",
      },
    ]);

    expect(rawQueryMock).toHaveBeenCalledTimes(1);
    const [sqlText, params] = rawQueryMock.mock.calls[0];
    expect(sqlText).toMatch(/INSERT INTO store_mappings/);
    expect(sqlText).toMatch(/ON CONFLICT \(store_id, store_product_id\)/);
    expect(sqlText).toMatch(/WHERE store_mappings\.status = 'pending'/);

    // Flat params: 6 columns per row × 2 rows = 12
    expect(params).toHaveLength(12);
    expect(params).toEqual([
      "foleja", "abc", "iPhone 17 Pro", "apple-iphone-17-pro-256gb", "name_match", 100,
      "neptun", "/iphone-17-12345", null, "apple-iphone-17-pro-256gb", "slug_match", 0,
    ]);
  });

  it("swallows DB errors so scraper runs aren't aborted by mapping writes", async () => {
    rawQueryMock.mockRejectedValueOnce(new Error("connection refused"));
    await expect(
      batchRecordStoreMappings([
        {
          storeId: "x",
          storeProductId: "y",
          storeProductName: null,
          catalogueProductId: "z",
          confidence: 80,
        },
      ]),
    ).resolves.toBeUndefined();
  });
});

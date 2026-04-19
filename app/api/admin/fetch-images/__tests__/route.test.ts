import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Shared mock repo instance ──────────────────────────────────────────────────

// vi.mock is hoisted above top-level `const`s, so the mock factory can't close
// over locals. vi.hoisted gives us an initialized binding at hoist time.
const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    getAll: vi.fn(),
    saveAll: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/src/infrastructure/container", () => ({
  productRepo: mockRepo,
}));

vi.mock("@/src/infrastructure/enrichment/GSMArenaService", () => ({
  enrichPhone: vi.fn(),
}));

vi.mock("@/src/infrastructure/enrichment/CategoryEnrichmentService", () => ({
  enrichNonPhoneProduct: vi.fn(),
}));

import { enrichPhone } from "@/src/infrastructure/enrichment/GSMArenaService";
import { enrichNonPhoneProduct } from "@/src/infrastructure/enrichment/CategoryEnrichmentService";
import { POST } from "../route";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq() {
  return new NextRequest("https://internal/api/admin/fetch-images", {
    method: "POST",
    headers: { Authorization: "Bearer test-secret" },
  });
}

const phoneProduct = {
  id: "shpresa-iphone-17",
  family: "iPhone 17",
  brand: "Apple",
  category: "telefona",
  subcategory: "Smartphone",
  imageUrl: "",
  searchTerms: [],
};

const accessoryProduct = {
  id: "albagame-sbs-case",
  family: "Kulp Celular SBS Space White",
  brand: "SBS",
  category: "aksesore",
  subcategory: "Accessories",
  imageUrl: "",
  searchTerms: ["https://www.albagame.al/products/sbs-case"],
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/admin/fetch-images", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, CRON_SECRET: "test-secret" };
    mockRepo.saveAll.mockResolvedValue(undefined);
  });

  it("returns 401 when auth header is missing", async () => {
    const req = new NextRequest("https://internal/api/admin/fetch-images", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("uses enrichPhone for phones and saves the image", async () => {
    mockRepo.getAll.mockResolvedValue([phoneProduct]);
    vi.mocked(enrichPhone).mockResolvedValue({
      name: "Apple iPhone 17",
      deviceUrl: "https://gsmarena.com/apple_iphone_17.php",
      specs: {},
      officialImages: ["https://fdn2.gsmarena.com/iphone17.jpg"],
      variant: { modelCode: "A1234", region: "EU", confidence: "likely" },
    });

    const res = await POST(makeReq());
    const body = await res.json();

    expect(enrichPhone).toHaveBeenCalledWith("Apple iPhone 17", "Apple");
    expect(enrichNonPhoneProduct).not.toHaveBeenCalled();
    expect(body.updated).toBe(1);
    expect(body.skipped).toBe(0);
    expect(mockRepo.saveAll).toHaveBeenCalled();
  });

  it("uses enrichNonPhoneProduct for accessories and saves the image", async () => {
    mockRepo.getAll.mockResolvedValue([accessoryProduct]);
    vi.mocked(enrichNonPhoneProduct).mockResolvedValue({
      specs: {},
      officialImages: ["https://www.albagame.al/cdn/sbs-case.jpg"],
      variant: { modelCode: "", region: "Unknown", confidence: "unclear" },
      source: "AlbaGame",
    });

    const res = await POST(makeReq());
    const body = await res.json();

    expect(enrichPhone).not.toHaveBeenCalled();
    expect(enrichNonPhoneProduct).toHaveBeenCalledWith(accessoryProduct);
    expect(body.updated).toBe(1);
    expect(body.skipped).toBe(0);
    expect(mockRepo.saveAll).toHaveBeenCalled();
  });

  it("skips product when enrichment returns no image", async () => {
    mockRepo.getAll.mockResolvedValue([accessoryProduct]);
    vi.mocked(enrichNonPhoneProduct).mockResolvedValue(null);

    const res = await POST(makeReq());
    const body = await res.json();

    expect(body.updated).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockRepo.saveAll).not.toHaveBeenCalled();
  });

  it("skips products that already have an imageUrl", async () => {
    mockRepo.getAll.mockResolvedValue([
      { ...accessoryProduct, imageUrl: "https://example.com/existing.jpg" },
    ]);

    const res = await POST(makeReq());
    const body = await res.json();

    expect(enrichPhone).not.toHaveBeenCalled();
    expect(enrichNonPhoneProduct).not.toHaveBeenCalled();
    expect(body.total).toBe(0);
  });
});

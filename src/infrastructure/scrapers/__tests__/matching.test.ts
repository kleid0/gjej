import { describe, it, expect } from "vitest";
import { strictMatchScore } from "../PriceScraper";

// Regression suite for the wrong-product-link class of bug: the live case was
// the iPhone 16e product page linking to Neptun's iPhone 16. "16e" carries no
// \b\d+\b number, so the generation guards never fired and 75% word overlap
// accepted the wrong phone. Letter-suffixed generations (16e, 7a, 6s) are
// distinct products and must never cross-match their base model.

const score = (result: string, query: string) => strictMatchScore(result, [query]);

describe("strictMatchScore — letter-suffixed generations", () => {
  it("iPhone 16e query must NOT match iPhone 16 (the live Neptun bug)", () => {
    expect(score("Apple iPhone 16 128GB Black", "Apple iPhone 16e 128GB")).toBe(0);
  });

  it("iPhone 16 query must NOT match iPhone 16e (reverse direction)", () => {
    expect(score("Apple iPhone 16e 128GB Black", "Apple iPhone 16 128GB")).toBe(0);
  });

  it("iPhone 16e query DOES match iPhone 16e", () => {
    expect(score("Apple iPhone 16e 128GB Black", "Apple iPhone 16e 128GB")).toBeGreaterThan(0);
  });

  it("Pixel 7a must not cross-match Pixel 7 (either direction)", () => {
    expect(score("Google Pixel 7 128GB", "Google Pixel 7a 128GB")).toBe(0);
    expect(score("Google Pixel 7a 128GB", "Google Pixel 7 128GB")).toBe(0);
  });

  it("iPhone 6s must not cross-match iPhone 6", () => {
    expect(score("Apple iPhone 6 64GB", "Apple iPhone 6s 64GB")).toBe(0);
  });
});

describe("strictMatchScore — unit suffixes are not generations", () => {
  it("a 5G marker in the result does not break a legit match", () => {
    expect(score("Apple iPhone 16e 5G 128GB", "Apple iPhone 16e 128GB")).toBeGreaterThan(0);
  });

  it("a 4K marker in a TV result does not break a legit match", () => {
    expect(score("Samsung TV Q60D 55 4K Smart", "Samsung TV Q60D 55")).toBeGreaterThan(0);
  });

  it("wattage in a result does not break a legit match", () => {
    expect(score("Karikues Samsung 25W USB-C", "Karikues Samsung 25W USB-C")).toBeGreaterThan(0);
  });
});

describe("strictMatchScore — existing guards still hold", () => {
  it("wrong generation still rejected", () => {
    expect(score("Apple iPhone 15 128GB", "Apple iPhone 17 128GB")).toBe(0);
  });

  it("extra generation in result still rejected", () => {
    expect(score("Nintendo Switch 2 EA SPORTS FC 26", "Nintendo Switch 2")).toBe(0);
  });

  it("tier mismatch still rejected", () => {
    expect(score("Apple iPhone 17 Pro 256GB", "Apple iPhone 17 256GB")).toBe(0);
  });

  it("storage conflict still rejected", () => {
    expect(score("Apple iPhone 17 1TB", "Apple iPhone 17 256GB")).toBe(0);
  });

  it("exact match still accepted", () => {
    expect(score("Apple iPhone 17 256GB", "Apple iPhone 17 256GB")).toBeGreaterThan(0);
  });
});

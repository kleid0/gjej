import { describe, it, expect } from "vitest";
import { extractColour, colourConfidence } from "../PriceScraper";

// The bug: JS \b is ASCII-only, so a trailing "ë" ("e zezë") broke every colour
// pattern's word boundary. Black went undetected → colour confidence was
// "unknown" → a black listing leaked through as the requested (blue) colour.
describe("extractColour — Albanian diacritics", () => {
  const cases: Array<[string, string]> = [
    ["Celular Apple iPhone 17 512GB e zezë", "black"],   // the exact reported case
    ["Apple iPhone 17 e zeze", "black"],                  // ascii form still works
    ["iPhone 17 i bardhë", "white"],
    ["Samsung Galaxy e gjelbër", "green"],
    ["iPhone 15 e verdhë", "yellow"],
    ["Xiaomi rozë", "pink"],
    ["Samsung vjollcë", "purple"],
    ["iPhone Mist Blue", "mist-blue"],
    ["iPhone 17 Black", "black"],
  ];
  it.each(cases)("%s → %s", (name, key) => {
    expect(extractColour(name)).toBe(key);
  });

  it("returns null when no colour is present", () => {
    expect(extractColour("Apple iPhone 17 512GB")).toBeNull();
  });
});

describe("colourConfidence — the wrong-colour-link guard", () => {
  it("rejects a black listing for a blue request (conf 0)", () => {
    // Before the fix this returned -1 (unknown) → leaked through as blue.
    expect(colourConfidence("mist-blue", "Celular Apple iPhone 17 512GB e zezë")).toBe(0);
    expect(colourConfidence("blue", "iPhone 17 i bardhë")).toBe(0);
  });

  it("accepts the matching colour (conf 100), incl. diacritic form", () => {
    expect(colourConfidence("black", "iPhone 17 e zezë")).toBe(100);
    expect(colourConfidence("mist-blue", "iPhone 17 Mist Blue")).toBe(100);
  });

  it("treats aliases as equivalent (conf 90)", () => {
    expect(colourConfidence("blue", "iPhone 17 Mist Blue")).toBe(90);
  });

  it("returns -1 only when the listing truly has no colour info", () => {
    expect(colourConfidence("mist-blue", "Apple iPhone 17 512GB")).toBe(-1);
  });
});

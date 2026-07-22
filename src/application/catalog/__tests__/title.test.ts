import { describe, it, expect } from "vitest";
import { cleanTitle } from "../title";

describe("cleanTitle", () => {
  const cases: Array<[string, string]> = [
    // the reported case
    ["Celular Samsung Galaxy A26 128GB 6GB RAM bardhë", "Samsung Galaxy A26 128GB 6GB RAM"],
    // store prefix + trailing Albanian colour
    ["Celular Apple iPhone 17 512GB e zezë", "Apple iPhone 17 512GB"],
    ["Telefon Xiaomi Redmi Note 14 256GB vjollcë", "Xiaomi Redmi Note 14 256GB"],
    // English colours
    ["Apple iPhone 15 128GB Green", "Apple iPhone 15 128GB"],
    ["Samsung Galaxy S24 Ultra 512GB Titanium Gray", "Samsung Galaxy S24 Ultra 512GB"],
    ["Google Pixel 9 Rose Gold", "Google Pixel 9"],
    ["iPhone 17 Pro 256GB Mist Blue", "iPhone 17 Pro 256GB"],
    // colour mid-string (before a spec)
    ["Samsung Galaxy A55 bardhë 128GB", "Samsung Galaxy A55 128GB"],
    // "Titanium <colour>" is a colour; a model number after "Titanium" is NOT
    ["Tastierë Titanium TK101 USB, e zezë", "Tastierë Titanium TK101 USB"],
    ["Samsung Galaxy S24 Ultra 512GB Titanium Violet", "Samsung Galaxy S24 Ultra 512GB"],
    // slash-joined colours
    ["Celular Maxcom MS507 Black/Red", "Maxcom MS507"],
  ];
  it.each(cases)("%s → %s", (raw, clean) => {
    expect(cleanTitle(raw)).toBe(clean);
  });

  it("keeps specs and never strips a brand that merely contains a colour word", () => {
    // "Blackview" must survive — "black" isn't a standalone word here.
    expect(cleanTitle("Blackview BL9000 Pro 256GB")).toBe("Blackview BL9000 Pro 256GB");
    expect(cleanTitle("Xiaomi Redmi 14C 128GB 4GB RAM")).toBe("Xiaomi Redmi 14C 128GB 4GB RAM");
  });

  it("leaves an already-clean title unchanged", () => {
    expect(cleanTitle("Apple MacBook Air M4 13")).toBe("Apple MacBook Air M4 13");
  });

  it("never returns an empty string", () => {
    // A pathological all-colour name falls back to the original.
    expect(cleanTitle("e zezë")).toBeTruthy();
  });

  it("falls back to the original when nothing with letters survives", () => {
    // A generic store-prefix + dimension mustn't collapse to a bare number.
    expect(cleanTitle("Monitor 27")).toBe("Monitor 27");
    expect(cleanTitle("Tablet 11")).toBe("Tablet 11");
  });
});

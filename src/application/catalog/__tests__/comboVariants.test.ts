import { describe, it, expect } from "vitest";
import { comboAddon, comboBaseKey, groupCombos, collapseToBase } from "../comboVariants";
import type { Product } from "@/src/domain/catalog/Product";

let seq = 0;
const p = (family: string, over: Partial<Product> = {}): Product => ({
  id: over.id ?? `p${seq++}`,
  modelNumber: "",
  family,
  brand: over.brand ?? "Nintendo",
  category: over.category ?? "gaming",
  subcategory: "Konsola",
  imageUrl: "https://img/x.jpg",
  storageOptions: [],
  searchTerms: [],
  ...over,
});

describe("comboAddon", () => {
  it("extracts the add-on after a late ' + '", () => {
    expect(comboAddon(p("Nintendo Switch 2 + Mario Kart World"))).toBe("Mario Kart World");
  });
  it("returns null for a base product", () => {
    expect(comboAddon(p("Nintendo Switch 2"))).toBeNull();
  });
  it("ignores an early ' + ' (multi-device names)", () => {
    expect(comboAddon(p("Tastiere + Mouse HP 150"))).toBeNull();
  });
});

describe("comboBaseKey", () => {
  it("is shared by a base and its bundles", () => {
    expect(comboBaseKey(p("Nintendo Switch 2"))).toBe(
      comboBaseKey(p("Nintendo Switch 2 + Mario Kart")),
    );
  });
  it("differs across brands / base products", () => {
    expect(comboBaseKey(p("Nintendo Switch 2"))).not.toBe(comboBaseKey(p("Nintendo Switch 1")));
  });
});

describe("groupCombos", () => {
  it("returns base-first variants when bundles exist", () => {
    const all = [
      p("Nintendo Switch 2 + Zelda", { id: "z" }),
      p("Nintendo Switch 2", { id: "base" }),
      p("Nintendo Switch 2 + Mario Kart", { id: "mk" }),
    ];
    const variants = groupCombos(all[1], all);
    expect(variants.map((v) => v.id)).toEqual(["base", "mk", "z"]);
    expect(variants[0]).toMatchObject({ isBase: true, label: "Vetëm produkti" });
    expect(variants[1]).toMatchObject({ isBase: false, label: "+ Mario Kart" });
  });

  it("returns [] when there are no bundles", () => {
    const all = [p("Nintendo Switch 2", { id: "a" }), p("Nintendo Switch 1", { id: "b" })];
    expect(groupCombos(all[0], all)).toEqual([]);
  });

  it("groups from the perspective of a bundle too", () => {
    const all = [p("Nintendo Switch 2", { id: "base" }), p("Nintendo Switch 2 + Mario Kart", { id: "mk" })];
    expect(groupCombos(all[1], all).map((v) => v.id)).toEqual(["base", "mk"]);
  });
});

describe("collapseToBase", () => {
  it("drops bundles whose base is present, keeps everything else", () => {
    const products = [
      p("Nintendo Switch 2", { id: "base" }),
      p("Nintendo Switch 2 + Mario Kart", { id: "mk" }),
      p("PlayStation 5", { id: "ps5" }),
      p("Orphan Bundle X + Extra", { id: "orphan", brand: "Acme", family: "Orphan Bundle X + Extra" }),
    ];
    const kept = collapseToBase(products).map((p) => p.id);
    expect(kept).toContain("base");
    expect(kept).not.toContain("mk"); // collapsed under base
    expect(kept).toContain("ps5");
    expect(kept).toContain("orphan"); // base not present → stays discoverable
  });
});

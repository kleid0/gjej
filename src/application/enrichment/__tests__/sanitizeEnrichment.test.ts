import { describe, it, expect } from "vitest";
import {
  cleanProductDescription,
  cleanProductImages,
  isJunkProductImage,
  cleanSpecs,
} from "../sanitizeEnrichment";

describe("cleanProductDescription", () => {
  it("drops the foleja advert scraped as a description", () => {
    const ad =
      "Porosit Konzolë Nintendo Switch, 32GB, Joy-Con kuq/blu në foleja.al. Çmimet më te lira ne treg. Transport i shpejtë falas.";
    expect(cleanProductDescription(ad)).toBeUndefined();
  });

  it("drops any description that names a retailer or a .al shop", () => {
    expect(cleanProductDescription("Blej te Neptun me çmimin më të mirë")).toBeUndefined();
    expect(cleanProductDescription("Disponibël në shpresa.al")).toBeUndefined();
    expect(cleanProductDescription("Transport falas për të gjitha porositë")).toBeUndefined();
  });

  it("keeps genuine manufacturer prose", () => {
    const real =
      "The Nintendo Switch is a hybrid console that plays both at home and on the go, with detachable Joy-Con controllers.";
    expect(cleanProductDescription(real)).toBe(real);
  });

  it("returns undefined for empty/blank input", () => {
    expect(cleanProductDescription(undefined)).toBeUndefined();
    expect(cleanProductDescription("  ")).toBeUndefined();
  });
});

describe("isJunkProductImage / cleanProductImages", () => {
  it("flags logos, flags, banners and icons as junk", () => {
    expect(isJunkProductImage("https://foleja.al/logo.png")).toBe(true);
    expect(isJunkProductImage("https://images.foleja.al/flags/al.png")).toBe(true);
    expect(isJunkProductImage("https://images.foleja.al/media/xk.svg")).toBe(true);
    expect(isJunkProductImage("https://cdn.foleja.al/promo-banner.jpg")).toBe(true);
    expect(isJunkProductImage("https://foleja.al/payment-icons.png")).toBe(true);
    expect(isJunkProductImage("")).toBe(true);
    expect(isJunkProductImage("data:image/png;base64,AAAA")).toBe(true);
  });

  it("keeps genuine product photos", () => {
    const real = "https://assets.foleja.al/media/2026/03/nintendo-switch-neon.jpg";
    expect(isJunkProductImage(real)).toBe(false);
  });

  it("filters a mixed gallery down to product photos, de-duped, order kept", () => {
    const gallery = [
      "https://assets.foleja.al/media/switch-hero.jpg",
      "https://images.foleja.al/flags/al.png",
      "https://images.foleja.al/flags/xk.png",
      "https://foleja.al/logo.svg",
      "https://cdn.foleja.al/banner-promo.jpg",
      "https://assets.foleja.al/media/switch-hero.jpg", // dup
      "https://assets.foleja.al/media/switch-back.jpg",
    ];
    expect(cleanProductImages(gallery)).toEqual([
      "https://assets.foleja.al/media/switch-hero.jpg",
      "https://assets.foleja.al/media/switch-back.jpg",
    ]);
  });
});

describe("cleanSpecs", () => {
  it("drops store-operational fields, keeps real specs", () => {
    const specs = {
      Transporti: "FALAS",
      Disponueshmëria: "10",
      "Numri i produktit": "KST-200007083",
      Pesha: "398 g",
      Ekrani: "6.2 inch",
    };
    expect(cleanSpecs(specs)).toEqual({
      "Numri i produktit": "KST-200007083",
      Pesha: "398 g",
      Ekrani: "6.2 inch",
    });
  });
});

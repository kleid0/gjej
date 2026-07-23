// Strip retailer advertising from scraped enrichment before it's shown.
//
// Store product pages hand us their marketing as "enrichment": an og:description
// that reads "Porosit … në foleja.al. Çmimet më te lira ne treg. Transport i
// shpejtë falas.", and a gallery padded with country flags, the store logo, and
// promo banners. None of that describes the product — it advertises the shop.
//
// These helpers are DISPLAY-SAFE and pure: they never mutate stored data, so
// they apply to every product (cached or fresh) the moment it renders, and are
// also used at the enrichment source so junk never enters the cache.

/** ë→e, ç→c … so ASCII keyword matching survives Albanian diacritics. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Albanian retailers we aggregate. A description that names one is an ad.
const RETAILERS = [
  "foleja",
  "shpresa",
  "neptun",
  "globe",
  "albagame",
  "gjej.al",
];

// Marketing phrases (diacritic-folded) that mark a description as a store advert.
const AD_PHRASES = [
  "porosit", // "order now"
  "blej online",
  "cmimet me te lira",
  "cmimi me i mire",
  "cmimi me i lire",
  "me e lire ne treg",
  "me te lira ne treg",
  "transport falas",
  "transport i shpejt", // "fast shipping"
  "transporti falas",
  "dergesa falas",
  "zbritje",
  "oferta speciale",
  "shto ne shporte", // "add to cart"
];

/**
 * Return a product description only if it isn't store advertising. Scraped
 * og:descriptions are almost always marketing that names the shop or pushes a
 * deal; those are dropped. Genuine manufacturer prose (no retailer, no ad
 * phrasing) passes through unchanged.
 */
export function cleanProductDescription(
  description: string | undefined | null,
): string | undefined {
  if (!description) return undefined;
  const trimmed = description.trim();
  if (trimmed.length < 3) return undefined;
  const f = fold(trimmed);
  if (RETAILERS.some((r) => f.includes(fold(r)))) return undefined;
  if (AD_PHRASES.some((p) => f.includes(p))) return undefined;
  // A bare ".al" domain reference is a retailer plug too.
  if (/\b[a-z0-9-]+\.al\b/.test(f)) return undefined;
  return trimmed;
}

// URL fragments that mark an image as chrome, not a product photo: store logos,
// country flags (trust badges), promo banners, payment/shipping icons, theme
// assets, social buttons, placeholders.
const JUNK_IMAGE_TOKENS = [
  "logo",
  "flag",
  "/al.", "/xk.", // bare country-flag files (al.png, xk.svg…)
  "-al.", "-xk.",
  "/flags/",
  "banner",
  "promo",
  "badge",
  "payment",
  "shipping",
  "delivery",
  "transport",
  "guarantee",
  "garanci",
  "sticker",
  "placeholder",
  "no-image",
  "noimage",
  "default",
  "favicon",
  "sprite",
  "icon-",
  "-icon",
  "avatar",
  "watermark",
  "social",
  "facebook",
  "instagram",
  "whatsapp",
  "wp-content/themes",
  "wp-content/plugins",
  "/assets/img/",
  "spinner",
  "loading",
];

/** True when a URL looks like store chrome (logo/flag/banner/icon), not a product photo. */
export function isJunkProductImage(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return true;
  if (!url.startsWith("http")) return true;
  const u = url.toLowerCase();
  return JUNK_IMAGE_TOKENS.some((t) => u.includes(t));
}

/**
 * Keep only genuine product photos: drop logos, flags, banners and icons, and
 * de-duplicate. Order is preserved so the real hero image stays first.
 */
export function cleanProductImages(images: string[] | undefined | null): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const img of images) {
    if (isJunkProductImage(img)) continue;
    if (seen.has(img)) continue;
    seen.add(img);
    out.push(img);
  }
  return out;
}

// Spec keys that describe the shop's transaction, not the product. Folded.
const JUNK_SPEC_TOKENS = [
  "transport",
  "disponueshm", // availability / in stock
  "disponibil",
  "gjendje",
  "stok",
  "dergesa",
  "afati",
  "cmimi", // price is not a spec
  "kosto",
  "garanci", // store warranty terms
  "kthimi", // returns
];

/** Drop store-operational "specs" (shipping, availability, price…), keep real ones. */
export function cleanSpecs(
  specs: Record<string, string> | undefined | null,
): Record<string, string> {
  if (!specs || typeof specs !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(specs)) {
    const fk = fold(k);
    if (JUNK_SPEC_TOKENS.some((t) => fk.includes(t))) continue;
    out[k] = v;
  }
  return out;
}

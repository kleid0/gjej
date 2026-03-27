import axios from "axios";
import * as cheerio from "cheerio";
import { STORES } from "./stores";
import type { Product } from "./products";

// What to search on each store per category to surface products
const DISCOVERY_PLAN: Array<{
  categoryId: string;
  subcategory: string;
  terms: string[];
}> = [
  { categoryId: "telefona",   subcategory: "Smartphone",      terms: ["smartphone", "Samsung Galaxy", "iPhone", "Xiaomi telefon", "telefon celular", "Redmi", "Galaxy A", "Galaxy S", "iPhone 15", "iPhone 14", "iPhone 13", "Xiaomi 13", "OnePlus", "Oppo", "Realme", "Motorola", "Huawei", "Nokia telefon", "Android telefon"] },
  { categoryId: "telefona",   subcategory: "Tablet",           terms: ["tablet", "iPad", "Samsung Tab", "Lenovo Tab", "Xiaomi Pad", "Huawei MatePad", "iPad Pro", "iPad Air", "iPad mini"] },
  { categoryId: "kompjutera", subcategory: "Laptop",           terms: ["laptop", "notebook", "MacBook", "Dell laptop", "HP laptop", "Lenovo laptop", "ASUS laptop", "Acer laptop", "gaming laptop", "ultrabook", "Chromebook", "laptop i5", "laptop i7", "laptop ryzen"] },
  { categoryId: "kompjutera", subcategory: "Desktop",          terms: ["kompjuter desktop", "PC gaming", "all-in-one", "iMac", "mini PC"] },
  { categoryId: "kompjutera", subcategory: "Monitor",          terms: ["monitor", "monitor gaming", "monitor 4K", "monitor 27 inch", "monitor 24 inch", "curved monitor", "monitor IPS"] },
  { categoryId: "kompjutera", subcategory: "Printer",          terms: ["printer", "printues", "laser printer", "inkjet printer", "HP printer", "Canon printer", "Epson printer", "multifunksional"] },
  { categoryId: "kompjutera", subcategory: "Aksesorë",         terms: ["tastierë", "keyboard", "mouse gaming", "mouse wireless", "web kamera", "webcam", "headset PC", "USB hub", "SSD", "hard disk", "RAM", "procesor", "GPU", "grafike"] },
  { categoryId: "elektronike",subcategory: "TV",               terms: ["televizor", "Smart TV", "OLED TV", "QLED TV", "4K TV", "Samsung TV", "LG TV", "Sony TV", "Philips TV", "TV 55 inch", "TV 65 inch", "TV 43 inch", "Android TV"] },
  { categoryId: "elektronike",subcategory: "Audio",            terms: ["kufje", "headphones", "bluetooth speaker", "soundbar", "earbuds", "AirPods", "Sony kufje", "JBL speaker", "Bose", "wireless earphones", "gaming headset", "subwoofer"] },
  { categoryId: "elektronike",subcategory: "Gaming",           terms: ["PlayStation", "Xbox", "Nintendo Switch", "PS5", "PS4", "Xbox Series X", "gaming aksesorë", "joystick", "controller", "gaming chair", "PS5 game", "Xbox game"] },
  { categoryId: "elektronike",subcategory: "Kamera",           terms: ["kamera", "camera", "DSLR", "mirrorless", "Canon kamera", "Nikon", "Sony kamera", "action camera", "GoPro", "drone", "webcam", "kamera sigurie"] },
  { categoryId: "elektronike",subcategory: "Shtëpiake",        terms: ["lavatrice", "frigorifer", "lavastovilje", "microwave", "kondicionier", "ajri i kondicionuar", "ngrohës", "furrë", "aspirator"] },
  { categoryId: "elektronike",subcategory: "Aksesorë",         terms: ["charger", "karikues", "power bank", "kavo", "adapter", "batterie", "UPS", "printer ink", "toner"] },
  { categoryId: "shtepi",     subcategory: "Pajisje Kuzhine",  terms: ["lavatrice", "frigorifer", "pajisje kuzhine", "furrë gatimi", "mikrovalë", "mikser", "blender", "kafemakine", "toaster", "lavastovilje", "ngrohës uji"] },
  { categoryId: "shtepi",     subcategory: "Pastrimi",         terms: ["fshese me korrent", "aspirapolvere", "robot aspirator", "Dyson", "iRobot", "fshesë", "washing machine", "lavatrice"] },
  { categoryId: "shtepi",     subcategory: "Ndriçim",          terms: ["llambë LED", "ndriçim smart", "smart bulb", "Philips Hue", "led shirit"] },
  { categoryId: "sporte",     subcategory: "Fitness",          terms: ["fitness", "sport pajisje", "vrapim", "biçikletë fitness", "shtangë", "tapis roulant", "elliptical"] },
  { categoryId: "sporte",     subcategory: "Veshje Sportive",  terms: ["Nike", "Adidas këpucë", "Puma", "veshje sportive", "këpucë sportive", "çantë sportive"] },
  { categoryId: "bukuri",     subcategory: "Parfum",           terms: ["parfum", "eau de toilette", "Chanel", "Dior parfum", "Hugo Boss", "Versace", "parfum femra", "parfum burra"] },
  { categoryId: "bukuri",     subcategory: "Kujdes Lëkure",    terms: ["kujdes lëkure", "skincare", "moisturizer", "serum", "Nivea", "L'Oreal", "Garnier", "krema", "maska"] },
  { categoryId: "bukuri",     subcategory: "Elektrik",         terms: ["tharëse flokësh", "hair dryer", "hekur flokësh", "shavers", "Braun", "Oral-B", "Philips beauty", "epilator"] },
  { categoryId: "lodra",      subcategory: "Lodra",            terms: ["lodra", "LEGO", "toys", "Barbie", "Hot Wheels", "puzzle", "lodra fëmijësh", "playset"] },
];

const KNOWN_BRANDS = [
  "Samsung", "Apple", "Xiaomi", "Huawei", "Sony", "LG", "Dell", "HP", "Lenovo",
  "ASUS", "Acer", "Microsoft", "Nokia", "Motorola", "OnePlus", "Oppo", "Realme",
  "Philips", "Bosch", "Siemens", "Dyson", "iRobot", "Whirlpool", "Indesit",
  "Nintendo", "Dior", "Chanel", "Nike", "Adidas", "Braun", "Oral-B",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractBrand(name: string): string {
  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`\\b${brand}\\b`, "i").test(name)) return brand;
  }
  return name.split(/\s+/)[0] ?? "Unknown";
}

function extractModelNumber(name: string): string {
  // Look for typical model-number patterns like SM-G930F, A3090, WH-1000XM5
  const match = name.match(/\b([A-Z]{1,4}[-–]?[A-Z0-9]{3,12})\b/);
  return match?.[1] ?? slugify(name).slice(0, 20);
}

export async function discoverProducts(): Promise<Product[]> {
  const discovered = new Map<string, Product>();

  for (const plan of DISCOVERY_PLAN) {
    for (const store of STORES) {
      for (const term of plan.terms) {
        const urls = store.searchUrls(term);
        let data: string | null = null;
        for (const url of urls) {
          try {
            const response = await axios.get(url, {
              timeout: 12000,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept":
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "sq-AL,sq;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
                "Upgrade-Insecure-Requests": "1",
              },
            });
            data = response.data;
            break;
          } catch {
            // try next URL format
          }
        }
        try {
          if (!data) continue;
          const $ = cheerio.load(data);

          for (const sel of store.selectors.productLink) {
            let foundCount = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            $(sel).each((_: number, el: any) => {
              const $el = $(el);
              const href = $el.attr("href");
              if (!href) return;

              const productUrl = href.startsWith("http") ? href : `${store.url}${href}`;

              // Resolve product title from link text or nearby heading
              const $container = $el.closest(
                "[class*='product'], article, li.item, .item, [class*='card']"
              ).first();
              const name = (
                $el.text().trim() ||
                $el.attr("title") ||
                $el.attr("aria-label") ||
                $container
                  .find("h2,h3,h4,[class*='title'],[class*='name']")
                  .first()
                  .text()
                  .trim()
              )
                .replace(/\s+/g, " ")
                .trim();

              if (!name || name.length < 4 || name.length > 150) return;

              // Resolve product image
              const imgEl = $container.find("img").first();
              const rawSrc =
                imgEl.attr("src") ||
                imgEl.attr("data-src") ||
                imgEl.attr("data-lazy-src") ||
                "";
              const imageUrl = rawSrc
                ? rawSrc.startsWith("http")
                  ? rawSrc
                  : `${store.url}${rawSrc}`
                : "";

              const id = `disc-${slugify(name)}`;
              if (discovered.has(id)) return;

              discovered.set(id, {
                id,
                modelNumber: extractModelNumber(name),
                family: name,
                brand: extractBrand(name),
                category: plan.categoryId,
                subcategory: plan.subcategory,
                imageUrl,
                storageOptions: [],
                searchTerms: [name],
              });
              foundCount++;
            });

            // Stop trying selectors once this selector actually found products
            if (foundCount > 0) break;
          }
        } catch {
          // Store unreachable or blocked — skip silently
        }
      }
    }
  }

  return Array.from(discovered.values());
}

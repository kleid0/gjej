// Infrastructure: discovers products from Albanian retailers via platform-specific APIs

import axios from "axios";
import * as cheerio from "cheerio";
import type { IProductDiscoveryService } from "@/src/application/catalog/CatalogDiscovery";
import type { Product } from "@/src/domain/catalog/Product";
import { STORE_MAP } from "@/src/infrastructure/stores/registry";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "sq-AL,sq;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
};
const JSON_HEADERS = { ...HEADERS, "Accept": "application/json" };
// PC Store blocks standard UAs via WAF; Googlebot UA is accepted
const GOOGLEBOT_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Accept": "application/json" };

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// AlbaGame lists used console games under prefixes like "U-PS5", "U-PS4",
// "U-Switch", "U-Xbox" (see /collections/u-ps5). We only catalog new products,
// so these are filtered out at discovery time.
function isUsedProduct(title: string): boolean {
  return /^\s*u-(ps[45]|xbox|switch|nintendo)\b/i.test(title);
}

// Reject data: URIs (lazy-load placeholders) and other non-http URLs
function sanitizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.includes("base64,")) return "";
  if (!url.startsWith("http")) return "";
  return url;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ").trim();
}

const KNOWN_BRANDS = [
  // ── Multi-word brands (checked first — order matters for regex) ──
  "Be Quiet", "Green Lion", "Green Cell", "Cooler Master", "XD Design",
  "Port Designs", "Lian Li", "LC Power", "Cross Gear", "Mad Catz",
  "Fisher Price", "Owl Labs", "Harman Kardon", "Western Digital",
  "Fractal Design", "Wild Man", "Icy Box", "Innovation IT",
  "Hot Wheels",
  // ── Phones & tablets ──
  "Samsung", "Apple", "Xiaomi", "Huawei", "Sony", "LG", "Nokia", "Motorola",
  "OnePlus", "Oppo", "Realme", "Blackview", "Redmi", "Honor", "ZTE", "Oukitel",
  "Google", "Nothing", "CMF", "Meta", "Nubia", "Mijia", "Oculus",
  // ── Computers & components ──
  "Dell", "HP", "HPE", "Lenovo", "ASUS", "Acer", "Microsoft", "MSI", "Gigabyte",
  "NZXT", "Corsair", "Kingston", "Intel", "AMD", "Crucial", "G.Skill", "Seagate",
  "WD", "SanDisk", "Lexar", "PNY", "Verbatim", "Intenso", "Toshiba", "QNAP",
  "Synology", "Thermaltake", "DeepCool", "ASRock", "INNO3D", "ZOTAC", "Biostar",
  "Palit", "Kioxia", "Alienware", "Fujitsu", "TeamGroup", "Patriot", "Chieftec",
  "Xilence", "Arctic", "Valkyrie", "Jonsbo", "Enermax", "FSP", "Hyte",
  // ── Peripherals & accessories ──
  "Logitech", "Razer", "Redragon", "A4Tech", "Cherry", "Bloody", "HAVIT",
  "Gembird", "Wacom", "Elgato", "Trust", "OCOM", "SteelSeries", "HyperX",
  "3Dconnexion", "MotoSpeed", "Endorfy", "CONCEPTRONIC", "Bakker",
  "Ednet", "i-tec", "Axis", "Landberg", "EIA",
  // ── Networking ──
  "TP-Link", "D-Link", "Cisco", "Lindy", "Belkin", "Mercusys", "Linksys",
  // ── Printers & scanners ──
  "Epson", "Brother", "Canon", "Xerox", "Zebra", "Bixolon", "Rongta", "Phomemo",
  "Ricoh", "Citizen", "Tysso", "Plustek", "Avision", "Datalogic",
  // ── Audio ──
  "JBL", "Bose", "Marshall", "Jabra", "Anker", "Boya", "Saramonic", "QCY",
  "Sennheiser", "HiFuture", "Beats", "Blaupunkt", "RODE", "Tascam",
  "GravaStar", "SoundCore", "Picun",
  // ── Camera & video ──
  "DJI", "GoPro", "Insta360", "Fujifilm", "FeelWorld", "Godox", "Kodak",
  "Nikon", "Hohem", "Hollyland", "Telesin", "Moza", "LanParte", "Zeniko",
  "Olympus", "AVerMedia",
  // ── Monitors & displays ──
  "ViewSonic", "AOC", "BenQ", "iiyama", "Avtek", "Optoma", "XGIMI",
  // ── Power & charging ──
  "Baseus", "Ugreen", "Makelsan", "APC", "Schneider", "Hoco",
  "Mcdodo", "Earldom", "Wiwu", "Socomec", "Awei", "Moxom", "Davin",
  // ── Mobile accessories ──
  "Puluz", "Haweel", "Targus", "Benks", "Nillkin", "Pitaka", "3mk",
  // ── Home & appliances ──
  "Philips", "Bosch", "Siemens", "Dyson", "iRobot", "Whirlpool", "Indesit",
  "Kärcher", "Braun", "Oral-B", "Gree", "Shark", "HUTT", "Lobod",
  // ── Gaming ──
  "Nintendo", "Hori", "Sihoo", "Huzaro", "AeroCool", "Diablo",
  "Thrustmaster", "ROG", "TUF", "Maxx",
  // ── Beauty & fashion ──
  "Dior", "Chanel", "Nike", "Adidas", "YSL", "Armani", "L'Oréal",
  "L\u00B4Oréal",
  // ── Toys & hobby ──
  "LEGO", "CaDA", "ENGINO", "Playmobil", "Crayola", "Funko", "Chicco",
  "Tomy", "Numberblocks", "Barbie", "Beyblade", "Monopoly", "Panini",
  "Spybot",
  // ── Streaming & content ──
  "Amazon", "Kindle",
  // ── Transport ──
  "Segway", "Ninebot", "KuKirin", "Ouxi", "Honda", "ZWheel", "F-Wheel",
  // ── Security & software ──
  "Kaspersky", "Webroot", "EZVIZ", "EA",
  // ── Telecom & conferencing ──
  "Gigaset", "Grandstream", "Poly",
  // ── Other ──
  "Garmin", "Fitbit", "Laifen", "Zhiyun", "Kingsmith", "Honeywell",
  "Potensic", "Creative", "Delock", "GP", "LaCie", "Transcend", "FD",
  "Sbox", "Logilink", "Digitus", "Sandberg", "StarTech", "Lanberg",
  "Akyga", "Kieslect", "Mibro", "Amazfit", "Petrust", "Starlink",
  "Esperanza", "Huion", "Mi", "Instax", "Romsat", "XO", "Konig",
  "Millenium", "Beltou", "Mimd", "Interphone", "Argus", "TIBO",
  "Tring", "Gonggi", "Bitty", "SkyHawk", "Steam", "A4-Tech", "Osmo",
  "XiaomiBook", "Intuos", "SmartConnect", "Dicote", "Brähler",
];

// Words that are product types / Albanian nouns — never a valid brand.
// Used by the extractBrand fallback to skip generic first words.
const NON_BRAND_WORDS = new Set([
  // Albanian product-type nouns
  "celular", "telefon", "televizor", "laptop", "notebook", "monitor", "printer",
  "kufje", "maus", "tastierë", "tastiere", "altoparlant", "altoparlantë",
  "ekran", "ekrani", "kamera", "kamerë",
  "çantë", "çante", "çanta", "xham", "xhama", "bateri", "mbrojtës", "mbrojtes",
  "mbrojtëse", "mbajtëse", "mbajtese", "mbajtës", "mbajtes", "kartelë",
  "kartele", "karikues", "kabllo", "kabull", "kabëll",
  "kondicioner", "frigorifer", "frigoriferi", "lavatrice", "lavatriqe",
  "aspirator", "furrë", "furre",
  "hekur", "llambe", "llambë", "lampë", "sirtar", "dollap", "karrige",
  "kontroller", "kontrollues", "kontrolli", "kompjuter", "furnizues",
  "filtër", "filter", "filtro", "filtru", "kornizë", "kornize",
  "lojë", "loje", "loja", "mauspad", "mousepad", "kasë", "kase",
  "boks", "timon", "udhëzues", "udhezues", "mbështjellës", "mbeshtjelles",
  "mbështjellëse", "telekomandë", "komodë", "komodinë", "mobilje", "mobil",
  "dritë", "drita", "kutia", "kuti", "kutí", "mausi", "stacion",
  "aksesor", "stilolaps", "bazë", "jastëk", "tapet", "raft", "lidhës",
  "vitrinë", "blende", "montues", "senzor", "pajisje", "ventilator",
  "papuqe", "kabinet", "mbushes", "bravë", "stendë", "panel",
  "përshtatës", "qëndrim", "ngjyrë", "zëvendësues", "aromatizues",
  "magnetizues", "aromë", "ftohës",
  // English product-type nouns
  "smartphone", "tablet", "printer", "webcam", "headset", "headphone",
  "powerbank", "cable", "adapter", "adaptor", "router", "controller",
  "gamepad", "joystick", "processor", "motherboard", "speaker", "charger",
  "battery", "batterie", "toner", "ink", "filament", "stickers", "backpack",
  "bottle", "figure", "doll", "plush", "playset", "conditioner", "scooter",
  "case", "photo", "frame", "desk", "desktop", "adjustable", "vehicle",
  "disk", "display", "switch", "universal", "cpu", "build", "wireless",
  "soundbar", "karaoke", "microphone", "carrying", "resin", "rucksack",
  "patchcable", "mug", "bellows", "bezel", "stylus", "keyboard", "dock",
  "docking", "tripod", "robot", "drum", "portable", "vacuum", "extender",
  "binoculars", "puzzle", "thermal",
  // Generic / non-brand prefixes
  "ssd", "usb", "psu", "ram", "pc", "tv", "mini", "power", "custom",
  "gaming", "smart", "digital", "electric", "air", "wall", "set", "port",
  "assembled", "shopping", "noel", "green", "little", "sword", "be",
  "led", "lcd", "ip", "3d", "2d", "ftp",
  // Game / toy / collectible generic words
  "christmas", "light", "mural", "tumbler", "decorative", "premium",
  "canvas", "framed", "vertical", "horizontal", "belt", "back",
  "playing", "card", "deck", "game", "super", "keychain", "tin",
  "colouring", "peeling", "beach", "moon", "crystal", "ghost",
  "dual", "number", "multifunction", "waterproof", "outdoor", "short",
  "silicone", "table", "hammer", "shale",
  // Platform / console / sub-brand prefixes
  "ps5", "ps4", "xbox", "u-ps5", "u-ps4", "playstation", "iphone",
  "galaxy", "surface", "geforce",
  // More generic words
  "jump", "the", "ac", "ultra", "cruzer", "extreme", "pad", "tastier",
  "tws", "midi", "streaming", "tea", "lite", "mortal", "devil",
  "life", "silent", "astro", "fifa", "kids", "global", "on-ear",
  "space", "hi", "uav", "shake", "operation", "shimmer",
  "ms", "hot", "cat6e", "two-sided", "a4", "electric", "digital",
  "desktop/rackmount", "morph's", "streaming",
  // Fragrance prefixes
  "eau", "parfum",
  // Prepositions / connectives — Albanian, French, English. Foleja titles
  // often read "Mobil për TV", "Çantë për smartphone"; without these the
  // first-word fallback picks "për" as the brand.
  "për", "per", "pour", "de", "la", "le", "les", "me", "dhe", "and",
  "with", "for",
]);

function extractBrand(name: string, vendor?: string): string {
  if (vendor && vendor !== "Others" && vendor !== "Unknown") return vendor;
  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`\\b${brand}\\b`, "i").test(name)) return brand;
  }
  // Gaming-platform fallback: titles like "PS5 Until Dawn" have no brand token,
  // and the first-word fallback would pick the game title ("Until"). Attribute
  // to the platform maker so duplicates across stores fuse on the same brand.
  if (/^\s*(ps[45]|u-ps[45]|playstation\s*[45])\b/i.test(name)) return "Sony";
  if (/^\s*xbox\b/i.test(name)) return "Microsoft";
  // Fallback: use the first word that isn't a generic product-type term
  const words = name.replace(/[,;()]/g, " ").split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (!NON_BRAND_WORDS.has(w.toLowerCase().replace(/[®™©]/g, ""))) return w;
  }
  return "Unknown";
}

// Known manufacturer model number patterns (e.g. SM-G991B, RTX 4090, i7-13700K)
const MODEL_PATTERNS: Array<[RegExp, string]> = [
  [/\b(SM-[A-Z]\d{3}[A-Z0-9]{1,3})\b/i, "Samsung"],           // Samsung: SM-S931B, SM-G991B
  [/\b(MQ[A-Z0-9]{2,4}[A-Z]{0,2}\/[A-Z])\b/i, "Apple"],       // Apple: MQ6T3LL/A style
  [/\b([A-Z]{1,2}\d{4}[A-Z]{2,3}\/[A-Z])\b/i, "Apple"],       // Apple: MYYN3LL/A, MYM23QL/A
  [/\b(RTX\s*\d{4}[A-Z\s]*Ti?)\b/i, "NVIDIA"],                 // NVIDIA: RTX 4090
  [/\b(GTX\s*\d{3,4}[A-Z\s]*Ti?)\b/i, "NVIDIA"],               // NVIDIA: GTX 1660
  [/\b(RX\s*\d{4}[A-Z\s]*XT?)\b/i, "AMD"],                     // AMD: RX 6700 XT
  [/\b(i[3579]-\d{4,5}[A-Z]{0,2})\b/i, "Intel"],               // Intel: i7-13700K
  [/\b(Core\s+Ultra\s+[579]\s+\d{3}[A-Z]?)\b/i, "Intel"],      // Intel Core Ultra 7 165H
  [/\b(Ryzen\s+[3579]\s+\d{4}[A-Z]{0,2})\b/i, "AMD"],          // AMD Ryzen
  [/\b(Xeon\s+[A-Z0-9-]+)\b/i, "Intel"],                       // Intel Xeon
  [/\b(M[1-9]\s+(?:Pro|Max|Ultra)?)\b/i, "Apple"],             // Apple M3 Pro, M4
  [/\b(A\d{4}(?:\s*[A-Z]{1,2})?)\b/, "Apple"],                 // Apple A17 Pro chip
  [/\b(Snapdragon\s+\d+\s*[A-Z]*)\b/i, "Qualcomm"],            // Snapdragon 8 Elite
  [/\b(Dimensity\s+\d+[A-Z]*)\b/i, "MediaTek"],                // Dimensity 9400
  [/\b(Kirin\s+\d+[A-Z]*)\b/i, "Huawei"],                      // Kirin 9000
  [/\b([A-Z]{2,5}\d{3,6}[A-Z]{0,3})\b/, "Generic"],            // Generic: TV50UQ8000, PS5, EW7B66
];

// Store-internal SKU patterns to reject (not real model numbers)
const STORE_SKU_PATTERNS = [
  /^DUN\d{4}/, // Shpresa internal: DUN4745-M
  /^SAS\d{4}/, // Shpresa internal: SAS1317
  /^CEL\d{4}/i,
  /^ACN-\d/,
  /^KST-\d/,
  /^ABP-\d/,
  /^ERG-\d/,
  /^MAR-\d/,
  /^YLL-\d/,
];

function isStoreInternalSku(sku: string): boolean {
  return STORE_SKU_PATTERNS.some((p) => p.test(sku));
}

function extractModelNumber(name: string, fallbackSku: string): string {
  for (const [pattern] of MODEL_PATTERNS) {
    const m = name.match(pattern);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  // Use SKU only if it looks like a real manufacturer model (not a store-internal ID)
  if (fallbackSku && /[A-Z]/i.test(fallbackSku) && fallbackSku.length >= 4 && !isStoreInternalSku(fallbackSku)) {
    return fallbackSku;
  }
  // Return empty string — no real model number found
  // (better than a slugified store name which would be misleading)
  return "";
}

// Rule-ordered classifier over lowercase name+tags+type text. Bilingual on
// purpose — the June-2026 audit showed the old English-only rules dumped 40%
// of the catalogue into a junk drawer because store names are Albanian
// ("Pllakë amë" = motherboard, "Fshesë" = vacuum, "Altoparlant" = speaker...).
// Order is load-bearing; the trickiest precedences are commented inline.
export function guessCategory(name: string, tags: string[] = [], productType = "", categories: string[] = []): { category: string; subcategory: string } {
  // Fold Albanian diacritics to ASCII: JS \b is ASCII-only, so a trailing ë
  // ("fshesë", "klimë") would silently break word-boundary matches.
  const text = [name, productType, ...tags, ...categories]
    .join(" ")
    .toLowerCase()
    .replace(/ë/g, "e")
    .replace(/ç/g, "c");

  // ── Bags before computers ──────────────────────────────────────────────────
  // "Çantë laptopi" (laptop bag) must not hit the \blaptop\b rule.
  if (/\bcant[ea]\w*\b|\bbackpack\b|laptop\s+(?:bag|sleeve)/i.test(text)) return { category: "veshje", subcategory: "Canta" };

  // ── Computers ──────────────────────────────────────────────────────────────
  // PC cooling BEFORE the AIO-desktop rule: "AIO 240mm liquid cooler" is a
  // component, "Lenovo AIO IdeaCentre" is a whole computer.
  if (/\b(?:aio|air|cpu|liquid)\s+cooler\b|water\s*cooling|\bcase\s+fan\b|\b\d{2,3}\s*mm\s+fan\b|\bheatsink\b|thermal\s+paste/i.test(text)) return { category: "kompjutera", subcategory: "Komponente PC" };
  // Monitor before laptop — "Predator" is both an Acer laptop and monitor line.
  if (/\bmonitor\b|\bsignage\b|ekran\s+(?:signage|digjital)/i.test(text)) return { category: "kompjutera", subcategory: "Monitor" };
  if (/\b(macbook|thinkpad|chromebook|elitebook|thinkbook|vivobook|zenbook|probook|ideapad|xiaomibook|inspiron|latitude|pavilion|legion|zephyrus|predator|precision\s+\d{4})\b|\blaptop\b|\bnotebook\b/i.test(text)) return { category: "kompjutera", subcategory: "Laptop" };
  // Whole desktops incl. Albanian "kompjuter", AIO models, and mini PCs —
  // BEFORE component/SSD rules so spec-listing names ("…16GB, 512GB SSD…")
  // don't drag entire computers into the components bucket.
  if (/\b(imac|desktop|thinkcentre|optiplex|ideacentre|proone|microtower|nuc)\b|all-in-one|\baio\b|\bmini\s+pc\b|\bkompjuter\b|pc\s+gaming(?!\s+chair)/i.test(text)) return { category: "kompjutera", subcategory: "Desktop PC" };
  if (/\b(rtx\s*\d{3,4}|gtx\s*\d{3,4}|radeon\s+rx\b|graphics\s+card|video\s+card|karte\s+grafike)\b/i.test(text)) return { category: "kompjutera", subcategory: "Karte Grafike" };
  if (/\b(wifi\s+router|wireless\s+router|\brouter\b|access\s+point|mesh\s+(?:wifi|network)|rrjet[eë]|network\s+switch|ethernet\s+switch|\bmodem\b)\b|\btp-?link\b|\bmikrotik\b|\bmercusys\b/i.test(text)) return { category: "kompjutera", subcategory: "Rrjete & WiFi" };
  // 3D printing before regular printer — "Creality Ender 3D Printer" must not match the printer rule first
  if (/\b(elegoo|anycubic|creality|bambu\s+lab)\b|3d\s*print|\bfilament\b|\bresin\b/i.test(text)) return { category: "kompjutera", subcategory: "Printer 3D" };
  if (/\b(printer|printues|toner|cartridge|bojë\s+printeri)\b/i.test(text)) return { category: "kompjutera", subcategory: "Printer" };

  // ── Gaming ─────────────────────────────────────────────────────────────────
  // Before phones/audio/camera/components: "Xbox PSU", "Kamera HD Sony PS5",
  // and "PS5 <game title>" must all resolve inside gaming. Note: bare
  // "gaming" is NOT a signal — "ASUS TUF GAMING" is a motherboard line.
  if (/\b(playstation|ps[45]\b|xbox|nintendo|steam\s+deck|dualsense|dualshock|gamepad|joystick|game\s+controller|kontroller|racing\s+wheel|timon\s+loj[e]rash|gaming\s+chair|karrige\s+gaming|video\s+loj[e]|\bpegi\b)/i.test(text) || /\bloje\b(?!\s*ra)(?!\s+tavoline)/i.test(text)) {
    if (/gaming\s+chair|karrige\s+gaming/i.test(text)) return { category: "gaming", subcategory: "Karrige Gaming" };
    if (/\b(dualsense|dualshock|gamepad|joystick|controller|kontroller|racing\s+wheel|timon)\b/i.test(text)) return { category: "gaming", subcategory: "Kontrollera" };
    if (/\b(case|cover|mbeshtjelles|mbrojtes|mbrojtese|skin|charger|karikues|charging|stand|dock|screen|filter|kit|headset|kufje|kamera|camera|remote|thumb\s*grip|carry|bag|psu|furnizues)\b/i.test(text)) return { category: "gaming", subcategory: "Aksesore Gaming" };
    if (/\b(konsol[e]|console)\b/i.test(text)) return { category: "gaming", subcategory: "Konsola" };
    return { category: "gaming", subcategory: "Lojera" };
  }

  // ── Phones & Tablets ───────────────────────────────────────────────────────
  // Tablet before phone — so "iPad Celular" and "Redmi Pad" aren't caught by the phone regex
  if (/\bipad\b|\btablet\b|galaxy\s+tab\b|lenovo\s+tab\b|\bmatepad\b|redmi\s+pad|xiaomi\s+pad|poco\s+pad/i.test(text)) return { category: "telefona", subcategory: "Tablet" };
  // Smartwatch before phone — "Redmi Watch 5" must not hit the \bredmi\b phone token.
  if (/\bsmart\s*watch\b|\bsmartwatch\b|\bgalaxy\s+watch\b|\bapple\s+watch\b|\bfitbit\b|\bgarmin\b|\bamazfit\b|\bmi\s+band\b|\bhuawei\s+watch\b|redmi\s+watch|fitness\s+tracker|\bwear\s+os\b/i.test(text)) return { category: "telefona", subcategory: "Smartwatch" };
  // Phone cases/protectors before the phone rule — their names contain the phone model.
  if (/(mbrojt[e]se|kover|mbeshtjelles|xham\s+mbrojtes|screen\s+protector|tempered\s+glass|flip\s+cover|back\s+cover|\bcase\b|\bkase\b).*\b(iphone|galaxy|xiaomi|redmi|telefon\w*|celular\w*|huawei|pixel)\b/i.test(text)) return { category: "telefona", subcategory: "Aksesore Telefoni" };
  if (/\b(celular\w*|smartphone|telefon\s+celular)\b|iphone|samsung\s+galaxy\s+[as]\d|\bpixel\s+\d|\bxiaomi\s+\d+\b|\bredmi\b|\boneplus\b|\boppo\b|\brealme\b|\bmotorola\b|\bblackview\b|\bnubia\b|\bpoco\b|\bzte\b|\bhonor\b|\boukitel\b|nothing\s+(?:phone|cmf)/i.test(text)) return { category: "telefona", subcategory: "Smartphone" };

  // ── TV & Audio ─────────────────────────────────────────────────────────────
  // Mounts and streaming boxes before the bare-TV rule.
  if (/mbajt[eë]se\s+tv|tv\s+(?:mount|bracket|wall)|\btv\s+box\b|android\s+tv\s+box|chromecast|fire\s+(?:tv\s+)?stick|apple\s+tv\b/i.test(text)) return { category: "tv-audio", subcategory: "Aksesore TV" };
  if (/\b(televizor|smart\s+tv|oled|qled|4k\s+tv)\b|\btv\b|\b\d{2,3}["″]\s*(?:tv|televizor)/i.test(text)) return { category: "tv-audio", subcategory: "TV" };
  if (/\b(headphone|kufje|earbuds|earphones|airpods|headset)\b|\b(sennheiser|jabra)\b/i.test(text)) return { category: "tv-audio", subcategory: "Kufje" };
  if (/\b(altoparlant|speaker|subwoofer|soundbar|boks\s+muzike|hi-?fi|amplifik|turntable|gramafon)\b|\b(jbl|bose|sonos|harman\s+kardon|marshall)\b/i.test(text)) return { category: "tv-audio", subcategory: "Altoparlant & Soundbar" };
  if (/\b(projektor|projector)\b/i.test(text)) return { category: "tv-audio", subcategory: "Projektor" };

  // ── Foto & Video ───────────────────────────────────────────────────────────
  if (/\b(drone|dron)\b/i.test(text)) return { category: "foto-video", subcategory: "Dron" };
  // Film & camera accessories before the camera rule ("Instax film", tripods, binoculars).
  if (/\binstax\b.*film|\bfilm\b.*(?:instax|polaroid|kamer|camera|35\s*mm)|polaroid\s+(?:color\s+)?film|\b(tripod|trekembesh|gimbal|binocular|dylbi|lens\s+(?:cap|filter)|camera\s+bag)\b/i.test(text)) return { category: "foto-video", subcategory: "Aksesore Foto" };
  // Security cameras are smart-home, not photography.
  if (/kamera\s+sigurie|security\s+camera|ip\s+camera|\bcctv\b|ring\s+doorbell|video\s*doorbell|zile\s+dere/i.test(text)) return { category: "elektronike", subcategory: "Smart Home" };
  if (/\b(kamera|camera|dslr|mirrorless|gopro|action\s+cam|instax|camcorder)\b/i.test(text)) return { category: "foto-video", subcategory: "Kamera" };

  // ── Beauty appliances BEFORE large appliances ──────────────────────────────
  // "Tharëse flokesh" (hair dryer) must not hit the "tharëse" (clothes dryer) rule.
  if (/thar[eë]se\s+flokesh|hair\s+dryer|hekur\s+flokesh|airwrap|airstrait|straightener|curling\s+iron/i.test(text)) return { category: "bukuri", subcategory: "Kujdes Flokesh" };
  if (/\b(shaver|epilator|depilator|electric\s+razor|trimmer|makin[eë]\s+rroje)\b/i.test(text)) return { category: "bukuri", subcategory: "Rruajtje & Depilim" };

  // ── Large appliances (Elektroshtepiake) ────────────────────────────────────
  // Bare "hekur" is safe here: "hekur flokesh" (hair straightener) already matched above.
  if (/hekurosje|tavolin[e]\s+hekurosjeje|steam\s+(?:iron|station)|\bhekur\b/i.test(text)) return { category: "shtepiake", subcategory: "Hekurosje" };
  if (/\b(lavatrice|washing\s+machine|rrobalar[eë]se|thar[eë]se|tumble\s+dryer|washer)\b/i.test(text)) return { category: "shtepiake", subcategory: "Lavatrice & Tharese" };
  if (/\b(frigorifer|refrigerator|fridge|freezer|ngrir[eë]s|minibar)\b/i.test(text)) return { category: "shtepiake", subcategory: "Frigorifer" };
  if (/\b(lavastovilje|dishwasher|en[eë]lar[eë]se)\b/i.test(text)) return { category: "shtepiake", subcategory: "Lavastovilje" };
  // "Aspirator" in this catalogue = range hood (Faber, Miele DA…), not vacuum.
  if (/\b(furr[eë]|oven|mikroval[eë]|microwave|piano\s+gatimi|sob[eë]\s+gatimi|\bhob\b|cooktop|aspirator|range\s+hood)\b/i.test(text)) return { category: "shtepiake", subcategory: "Furre & Gatim" };
  if (/\b(fshes[eë]|vacuum|aspirapluhur|steam\s+cleaner|pastrues\s+me\s+avull|\bmop\b)\b/i.test(text)) return { category: "shtepiake", subcategory: "Fshesa & Pastrim" };
  // Desk fans, ACs, heaters, purifiers, boilers — the "desk fan" fix.
  if (/\b(kondicion|air\s+condition|klim[eë]|ventilator|\bfan\b|heater|ngroh[eë]s|radiator|boiler|air\s+purifier|purifikues|humidifier|dehumidif|lag[eë]shtues)\b/i.test(text)) return { category: "shtepiake", subcategory: "Klimatizim & Ngrohje" };

  // ── Kitchen (small) & cookware ─────────────────────────────────────────────
  if (/\b(coffee\s+maker|kafemakine|makin[eë]\s+kafeje|espresso|blender|toaster|thek[eë]se|air\s+fryer|fritez[eë]|food\s+processor|electric\s+kettle|kettle|juicer|slow\s+cooker|multicooker|rice\s+cooker|mikser|mixer|sandwich\s+maker|grill)\b/i.test(text)) return { category: "shtepi", subcategory: "Pajisje Kuzhine" };
  if (/\b(tenxhere|tigan|cookware|pan\s+set|pot\s+set|en[eë]\s+gatimi|tak[eë]me|pjata|glassware)\b/i.test(text)) return { category: "shtepi", subcategory: "Ene Gatimi" };

  // ── PC components, storage, peripherals ────────────────────────────────────
  // After whole-PC and gaming rules. "Pllakë amë" = motherboard.
  if (/pllak[eë]\s+am[eë]|\b(motherboard|mainboard|procesor|processor|\bcpu\b|\bpsu\b|power\s+supply|furnizues\s+energjie|ddr[45]|\bdimm\b|pc\s+case|kas[eë]\s+(?:pc|kompjuteri))\b|\bram\b\s*\d|\bcore\s+i[3579]\b|\bryzen\s+[3579]\b/i.test(text)) return { category: "kompjutera", subcategory: "Komponente PC" };
  if (/\b(ssd|nvme|hdd)\b|hard\s+(?:disk|drive)|pen\s*drive|usb\s+flash|flash\s+drive|memory\s+card|micro\s*sd\b|sd\s+card|external\s+storage/i.test(text)) return { category: "kompjutera", subcategory: "Disqe & Ruajtje" };
  if (/\b(keyboard|tastier[eë]|\bmouse\b|\bmaus\b|mousepad|mouse\s+pad)\b/i.test(text)) return { category: "kompjutera", subcategory: "Tastiere & Mouse" };
  if (/\b(webcam|usb\s+hub|docking\s+station|laptop\s+stand|cooling\s+pad|kaps[eë]\s+laptopi)\b/i.test(text)) return { category: "kompjutera", subcategory: "Aksesore PC" };

  // ── Beauty & Health (rest) ─────────────────────────────────────────────────
  if (/\b(parfum|eau\s+de\s+toilette|cologne)\b/i.test(text)) return { category: "bukuri", subcategory: "Parfum" };
  if (/\b(skincare|moisturizer|serum|krema|maska|sunscreen)\b/i.test(text)) return { category: "bukuri", subcategory: "Kujdes Lekure" };
  if (/\b(lipstick|mascara|foundation|makeup|eyeliner|eyeshadow|concealer)\b/i.test(text)) return { category: "bukuri", subcategory: "Makeup" };
  if (/\b(peshore|thermometer|termometr|tensiometer|oximeter|massage\s+gun|masazh)\b/i.test(text)) return { category: "bukuri", subcategory: "Shendet" };

  // ── Toys (split) ───────────────────────────────────────────────────────────
  if (/\blego\b/i.test(text)) return { category: "lodra", subcategory: "LEGO" };
  if (/\b(funko|action\s+figure|figur[eë]|\bfigure\b|beyblade|kolekcion|collectible|amiibo)\b/i.test(text)) return { category: "lodra", subcategory: "Figura & Koleksion" };
  if (/\b(doll|kukull|barbie|bratz|plush|pelush|beanie|rainbow\s+high|stuffed)\b/i.test(text)) return { category: "lodra", subcategory: "Kukulla & Plush" };
  if (/\b(puzzle|board\s+game|loj[eë]ra?\s+tavoline|ravensburger|monopoly|\buno\b|trading\s+card|pok[eé]mon\s+(?:card|collezione|tcg))\b/i.test(text)) return { category: "lodra", subcategory: "Puzzle & Lojera Tavoline" };
  if (/\b(beb[eë]|baby\s+(?:monitor|care|bottle)|biberon|pelena|diaper)\b/i.test(text)) return { category: "lodra", subcategory: "Kujdes Bebe" };
  if (/\b(karroc[eë]|stroller|pushchair)\b/i.test(text)) return { category: "lodra", subcategory: "Karroca" };
  if (/\b(hot\s+wheels|lodra|playmobil|nerf|paw\s+patrol|peppa\s+pig|play-?doh|playset|fisher\s+price|hasbro|mattel|spin\s+master|\byume\b|\bvehicle\b|slime\b)\b|\btoys?\b/i.test(text)) return { category: "lodra", subcategory: "Lodra" };

  // ── Sports ─────────────────────────────────────────────────────────────────
  if (/\b(trotinet|e.?scooter|electric\s+scooter|kick\s+scooter)\b/i.test(text)) return { category: "sporte", subcategory: "Trotinet Elektrik" };
  if (/\b(biciklet[eë]|mountain\s+bike|road\s+bike|e.?bike|electric\s+bike)\b/i.test(text)) return { category: "sporte", subcategory: "Bicikleta" };
  if (/\b(camping|sleeping\s+bag|hiking|trekking|tend[eë]\s+kampimi)\b/i.test(text)) return { category: "sporte", subcategory: "Camping" };
  if (/\b(peshkim|fishing\s+rod|spinning\s+reel)\b/i.test(text)) return { category: "sporte", subcategory: "Peshkim" };
  if (/\b(fitness|treadmill|tapis\s+roulant|elliptical|dumbbell|barbell|yoga\s+mat)\b/i.test(text)) return { category: "sporte", subcategory: "Fitness" };
  if (/\b(veshje\s+sportive|jersey)\b|\bnike\b|\badidas\b|\bpuma\b|\breebok\b/i.test(text)) return { category: "sporte", subcategory: "Veshje Sportive" };

  // ── Home ───────────────────────────────────────────────────────────────────
  if (/\b(llamb[eë]?|desk\s+lamp|floor\s+lamp|led\s+strip|smart\s+bulb|ndricim|abazhur)\b/i.test(text)) return { category: "shtepi", subcategory: "Ndricim" };
  if (/\b(kopsht|lawn\s+mower|garden\s+hose|hedge\s+trimmer|pressure\s+washer|drill\b|trapan|vegla\s+pune|bormakin[eë]|sharr[eë])\b/i.test(text)) return { category: "shtepi", subcategory: "Kopsht & Vegla" };
  if (/\b(mobilje|divan|kolltuk|tavolin[eë]|karrige(?!\s+gaming)|rafte?|dollap)\b/i.test(text)) return { category: "shtepi", subcategory: "Mobilje" };
  if (/\b(dekorim|picture\s+frame|wall\s+art|korniz[eë]|qiri\b|vazo)\b/i.test(text)) return { category: "shtepi", subcategory: "Dekorim" };

  // ── Accessories & catch-all (slimmed-down "elektronike") ───────────────────
  if (/smart\s+(?:home|plug|hub|sensor)|\balexa\b|echo\s+dot|google\s+nest|homekit|zigbee|prize\s+inteligjente/i.test(text)) return { category: "elektronike", subcategory: "Smart Home" };
  if (/power\s*bank|powerbank|\bbateri\b|\bbattery\b|\bups\b/i.test(text)) return { category: "elektronike", subcategory: "Power Bank & Bateri" };
  if (/\b(charger|karikues|kabell|kabllo|cable|kavo|adapter|adaptor|usb-c|lightning|hdmi|displayport)\b/i.test(text)) return { category: "elektronike", subcategory: "Karikues & Kabllo" };

  // ── Default ────────────────────────────────────────────────────────────────
  return { category: "elektronike", subcategory: "Te Tjera" };
}

// ── Shopify ───────────────────────────────────────────────────────────────────
interface ShopifyProduct { handle: string; title: string; vendor: string; product_type: string; tags: string[]; images: Array<{ src: string }>; variants: Array<{ sku: string }>; }

async function fetchShopify(storeId: string, baseUrl: string): Promise<Product[]> {
  const products: Product[] = [];
  let page = 1;
  while (true) {
    try {
      const { data } = await axios.get(`${baseUrl}/products.json`, { params: { limit: 250, page }, timeout: 15000, headers: JSON_HEADERS });
      const items: ShopifyProduct[] = data?.products ?? [];
      if (!items.length) break;
      for (const item of items) {
        if (!item.title || item.title.length < 3) continue;
        if (isUsedProduct(item.title)) continue;
        const { category, subcategory } = guessCategory(item.title, item.tags ?? [], item.product_type ?? "");
        products.push({ id: `${storeId}-${item.handle ?? slugify(item.title)}`, modelNumber: extractModelNumber(item.title, item.variants?.[0]?.sku ?? ""), family: item.title, brand: extractBrand(item.title, item.vendor), category, subcategory, imageUrl: sanitizeImageUrl(item.images?.[0]?.src), storageOptions: [], searchTerms: [item.title] });
      }
      if (items.length < 250) break;
      page++;
    } catch { break; }
  }
  return products;
}

// ── WooCommerce ───────────────────────────────────────────────────────────────
interface WooProduct { name: string; slug: string; sku: string; categories: Array<{ name: string }>; images: Array<{ src: string }>; brands?: Array<{ name: string }>; }

async function fetchWooCommerce(storeId: string, baseUrl: string, extraHeaders?: Record<string, string>): Promise<Product[]> {
  const products: Product[] = [];
  let page = 1;
  const perPage = 100;
  const headers = extraHeaders ? { ...JSON_HEADERS, ...extraHeaders } : JSON_HEADERS;
  while (true) {
    try {
      const { data } = await axios.get(`${baseUrl}/wp-json/wc/store/v1/products`, { params: { per_page: perPage, page }, timeout: 25000, headers });
      const items: WooProduct[] = Array.isArray(data) ? data : [];
      if (!items.length) break;
      for (const item of items) {
        if (!item.name || item.name.length < 3) continue;
        if (isUsedProduct(item.name)) continue;
        const name = decodeHtml(item.name);
        const cats = item.categories?.map((c) => c.name) ?? [];
        const { category, subcategory } = guessCategory(name, [], "", cats);
        const wooVendor = item.brands?.[0]?.name;
        products.push({ id: `${storeId}-${item.slug ?? slugify(name)}`, modelNumber: extractModelNumber(name, item.sku ?? ""), family: name, brand: extractBrand(name, wooVendor), category, subcategory, imageUrl: sanitizeImageUrl(item.images?.[0]?.src), storageOptions: [], searchTerms: [name] });
      }
      if (items.length < perPage) break;
      page++;
      await new Promise((r) => setTimeout(r, 500));
    } catch { break; }
  }
  return products;
}

// ── Shopware (Foleja.al) ──────────────────────────────────────────────────────
const FOLEJA_TERMS = ["smartphone", "Samsung Galaxy", "iPhone", "Xiaomi", "laptop", "MacBook", "Dell", "HP laptop", "ASUS", "monitor", "televizor", "Smart TV", "PlayStation", "Xbox", "Nintendo", "headphones", "bluetooth speaker", "printer", "SSD", "keyboard", "mouse", "power bank", "parfum", "Dyson", "lavatrice", "frigorifer", "tablet", "iPad"];

async function fetchFoleja(): Promise<Product[]> {
  const discovered = new Map<string, Product>();
  for (const term of FOLEJA_TERMS) {
    for (let page = 1; page <= 5; page++) {
      try {
        const { data } = await axios.get("https://www.foleja.al/search", { params: { search: term, p: page }, timeout: 12000, headers: HEADERS });
        const $ = cheerio.load(data);
        let found = 0;
        $(".product-box, .product-info, .product-name").each((_: number, el: any) => {
          const $el = $(el);
          const link = $el.find("a[href*='/']").first();
          const href = link.attr("href") ?? $el.closest("a").attr("href");
          if (!href) return;
          const name = ($el.find(".product-name, h2, h3, .name").first().text().trim() || link.text().trim() || "").replace(/\s+/g, " ").trim();
          if (!name || name.length < 4 || name.length > 200) return;
          if (isUsedProduct(name)) return;
          const img = $el.find("img").first();
          const rawSrc = img.attr("src") || img.attr("data-src") || "";
          const imageUrl = sanitizeImageUrl(rawSrc.startsWith("http") ? rawSrc : rawSrc ? `https://www.foleja.al${rawSrc}` : "");
          const id = `foleja-${slugify(name)}`;
          if (discovered.has(id)) return;
          const { category, subcategory } = guessCategory(name);
          const productUrl = href.startsWith("http") ? href : `https://www.foleja.al${href}`;
          discovered.set(id, { id, modelNumber: extractModelNumber(name, ""), family: name, brand: extractBrand(name), category, subcategory, imageUrl, storageOptions: [], searchTerms: [name, productUrl] });
          found++;
        });
        if (found === 0) break; // no more results for this term
      } catch { break; }
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return Array.from(discovered.values());
}

// ── Globe Albania ─────────────────────────────────────────────────────────────
interface GlobeProduct { id: number; name: string; price: number; image: string | null; images: string[]; category: string; sku: string; brand: string; stock: number; categories: string[]; }

async function fetchGlobe(): Promise<Product[]> {
  try {
    const { data } = await axios.get<GlobeProduct[]>("https://www.globe.al/api/products", { timeout: 20000, headers: JSON_HEADERS });
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item.name && item.name.length >= 3 && !isUsedProduct(item.name))
      .map((item) => {
        const name = decodeHtml(item.name);
        const cats = item.categories ?? [];
        const { category, subcategory } = guessCategory(name, [], "", cats);
        const imageUrl = sanitizeImageUrl(item.image ?? item.images?.[0]);
        return { id: `globe-${item.id}`, modelNumber: extractModelNumber(name, item.sku ?? ""), family: name, brand: extractBrand(name, item.brand), category, subcategory, imageUrl, storageOptions: [], searchTerms: [name] };
      });
  } catch { return []; }
}

// ── Neptun Albania ────────────────────────────────────────────────────────────
// Neptun uses an AngularJS frontend with a JSON API at NeptunCategories/LoadProductsForCategory.
// Products are not in static HTML; a mobile UA is required to bypass Cloudflare.
const NEPTUN_MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const NEPTUN_IMAGE_BASE = "https://www.neptun.al/";

// Category IDs discovered by probing the API (IDs 1–300 scanned; only non-empty ones listed).
// Covers phones, tablets, computers, TVs, audio, cameras, gaming, accessories, and home appliances.
const NEPTUN_CATEGORY_IDS = [
  // Phones & wearables
  144, 143, 149, 146, 147,
  // Tablets & computers
  106, 82, 80, 81, 92,
  // TV & audio
  276, 165, 138, 84, 162,
  // Cameras
  35, 73, 36, 75,
  // Gaming
  261, 187, 192,
  // Printers & office
  100, 99, 101, 103,
  // PC peripherals
  93, 96, 90, 94,
  // Mobile accessories
  136, 140, 135, 134, 139, 131,
  // Large accessories buckets
  241, 250, 130, 236, 237,
  // Small kitchen appliances
  24, 25, 26, 28, 29, 31, 37, 38, 40, 41, 43, 45, 46, 47, 48, 49, 51, 53, 63,
  // Personal care
  54, 56, 120, 122, 123, 124, 125, 127,
  // Vacuum & floor
  20, 21, 219, 220,
  // Irons & steam
  23, 118, 221,
  // Lighting
  60,
  // Health
  110, 111,
  // Cookware
  238, 227,
  // Other accessories
  240, 243, 244, 246, 247, 248, 251, 260,
  // Misc
  33, 85, 91,
];

interface NeptunItem {
  Id: number;
  Title: string;
  Manufacturer: { Name: string } | null;
  Category: { Id: number; Name: string; NameEn: string } | null;
  ModelNumber: string | null;
  ProductCode: string | null;
  Thumbnail: string | null;
}

async function fetchNeptunCategory(categoryId: number): Promise<NeptunItem[]> {
  const items: NeptunItem[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    try {
      const { data } = await axios.post(
        "https://www.neptun.al/NeptunCategories/LoadProductsForCategory",
        { model: { CategoryId: categoryId, Sort: 4, Manufacturers: [], PriceRange: null, BoolFeatures: [], DropdownFeatures: [], MultiSelectFeatures: [], ShowAllProducts: false, ItemsPerPage: pageSize, CurrentPage: page } },
        { timeout: 20000, headers: { ...JSON_HEADERS, "User-Agent": NEPTUN_MOBILE_UA, "X-Requested-With": "XMLHttpRequest", "Referer": "https://www.neptun.al/" } }
      );
      const batch = data?.Batch;
      if (!batch?.Items?.length) break;
      items.push(...batch.Items);
      if (items.length >= batch.Config?.TotalItems || batch.Items.length < pageSize) break;
      page++;
      await new Promise((r) => setTimeout(r, 300));
    } catch { break; }
  }
  return items;
}

async function fetchNeptun(): Promise<Product[]> {
  const discovered = new Map<string, Product>();
  for (const catId of NEPTUN_CATEGORY_IDS) {
    try {
      const items = await fetchNeptunCategory(catId);
      for (const item of items) {
        if (!item.Title || item.Title.length < 3) continue;
        if (isUsedProduct(item.Title)) continue;
        const id = `neptun-${item.Id}`;
        if (discovered.has(id)) continue;
        const name = decodeHtml(item.Title);
        const catNameEn = item.Category?.NameEn ?? item.Category?.Name ?? "";
        const { category, subcategory } = guessCategory(name, [], catNameEn);
        const imageUrl = sanitizeImageUrl(item.Thumbnail ? `${NEPTUN_IMAGE_BASE}${item.Thumbnail}` : "");
        discovered.set(id, {
          id,
          modelNumber: extractModelNumber(name, item.ModelNumber ?? item.ProductCode ?? ""),
          family: name,
          brand: extractBrand(name, item.Manufacturer?.Name),
          category,
          subcategory,
          imageUrl,
          storageOptions: [],
          searchTerms: [name],
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    } catch { /* skip failed category */ }
  }
  return Array.from(discovered.values());
}

// ── Main discovery service ────────────────────────────────────────────────────
export class ProductDiscoveryService implements IProductDiscoveryService {
  async discover(): Promise<Product[]> {
    const all: Product[] = [];
    const seen = new Set<string>();

    const sources: Array<[string, () => Promise<Product[]>]> = [
      ["albagame", () => fetchShopify("albagame", "https://www.albagame.al")],
      ["shpresa",  () => fetchWooCommerce("shpresa", "https://shpresa.al")],
      ["pcstore",  () => fetchWooCommerce("pcstore", "https://www.pcstore.al", GOOGLEBOT_HEADERS)],
      ["foleja",   () => fetchFoleja()],
      ["globe",    () => fetchGlobe()],
      ["neptun",   () => fetchNeptun()],
    ];
    const results = await Promise.allSettled(
      sources
        .filter(([id]) => STORE_MAP[id]?.enabled !== false)
        .map(([, run]) => run()),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const p of result.value) {
          if (!seen.has(p.id) && p.brand !== "Unknown") {
            seen.add(p.id);
            all.push(p);
          }
        }
      }
    }

    return all;
  }
}

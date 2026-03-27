export interface StorageOption {
  label: string;       // e.g. "128GB", "8GB/256GB"
  sku?: string;        // store-specific SKU suffix if any
}

export interface Product {
  id: string;          // slug, derived from modelNumber
  modelNumber: string; // unique hardware identifier e.g. "SM-G930F"
  family: string;      // display name e.g. "Samsung Galaxy S7"
  brand: string;
  category: string;
  subcategory: string;
  imageUrl: string;
  storageOptions: StorageOption[]; // selectable on product page (same model, diff storage)
  searchTerms: string[];           // terms used to search stores
}

// Note: different model numbers = separate Product entries (separate pages)
// e.g. SM-G930F and SM-G930FD are siblings but separate items

export interface ProductFamily {
  name: string;        // e.g. "Samsung Galaxy S7"
  brand: string;
  category: string;
  modelNumbers: string[]; // all model IDs in this family, for cross-linking
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  subcategories: string[];
}

export const CATEGORIES: Category[] = [
  { id: "telefona", name: "Telefona & Tablets", icon: "📱", subcategories: ["Smartphone", "Tablet", "Aksesore Telefoni"] },
  { id: "kompjutera", name: "Kompjutera", icon: "💻", subcategories: ["Laptop", "Desktop PC", "Monitor", "Printer", "Aksesore PC"] },
  { id: "elektronike", name: "Elektronikë", icon: "🔌", subcategories: ["TV", "Audio", "Kamera", "Gaming", "Aksesore"] },
  { id: "shtepi", name: "Shtëpi & Kopsht", icon: "🏠", subcategories: ["Pajisje Kuzhine", "Pastrimi", "Ndriçim", "Kopsht"] },
  { id: "sporte", name: "Sporte & Outdoor", icon: "⚽", subcategories: ["Fitness", "Veshje Sportive", "Biçikleta", "Camping"] },
  { id: "veshje", name: "Veshje & Këpucë", icon: "👟", subcategories: ["Këpucë", "Xhaketë", "Aksesore Mode"] },
  { id: "lodra", name: "Lodra & Fëmijë", icon: "🧸", subcategories: ["Lodra", "Libra Fëmijësh", "Kujdes Bebe"] },
  { id: "bukuri", name: "Bukuri & Shëndet", icon: "💊", subcategories: ["Parfum", "Kujdes Lëkure", "Shëndet", "Rruajtje"] },
];

export const PRODUCTS: Product[] = [
  // ── Samsung Galaxy S7 family ─────────────────────────────────────
  // Each model number is a separate product; storage options are selectable within a model
  {
    id: "SM-G930F",
    modelNumber: "SM-G930F",
    family: "Samsung Galaxy S7",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/global/sm-g930/gallery/global-galaxy-s7-sm-g930-sm-g930fzkaxfe-001-front-black",
    storageOptions: [{ label: "32GB" }],
    searchTerms: ["Samsung Galaxy S7", "Galaxy S7"],
  },
  {
    id: "SM-G930FD",
    modelNumber: "SM-G930FD",
    family: "Samsung Galaxy S7",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/global/sm-g930/gallery/global-galaxy-s7-sm-g930-sm-g930fzkaxfe-001-front-black",
    storageOptions: [{ label: "32GB" }],
    searchTerms: ["Samsung Galaxy S7 Dual", "Galaxy S7 Dual SIM", "S7 dual sim"],
  },
  {
    id: "SM-G930W8",
    modelNumber: "SM-G930W8",
    family: "Samsung Galaxy S7",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/global/sm-g930/gallery/global-galaxy-s7-sm-g930-sm-g930fzkaxfe-001-front-black",
    storageOptions: [{ label: "32GB" }],
    searchTerms: ["Samsung Galaxy S7", "Galaxy S7"],
  },

  // ── Samsung Galaxy S24 family ────────────────────────────────────
  {
    id: "SM-S921B",
    modelNumber: "SM-S921B",
    family: "Samsung Galaxy S24",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2401/gallery/al-galaxy-s24-s921-sm-s921bzadeue-thumb-539572882",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }],
    searchTerms: ["Samsung Galaxy S24", "Galaxy S24"],
  },
  {
    id: "SM-S921B-DS",
    modelNumber: "SM-S921B/DS",
    family: "Samsung Galaxy S24",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2401/gallery/al-galaxy-s24-s921-sm-s921bzadeue-thumb-539572882",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }],
    searchTerms: ["Samsung Galaxy S24 Dual", "Galaxy S24 Dual SIM", "S24 dual sim"],
  },
  {
    id: "SM-S928B",
    modelNumber: "SM-S928B",
    family: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2401/gallery/al-galaxy-s24-ultra-s928-sm-s928bzageue-thumb-539572882",
    storageOptions: [{ label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["Samsung Galaxy S24 Ultra", "Galaxy S24 Ultra"],
  },

  // ── Apple iPhone 15 family ───────────────────────────────────────
  {
    id: "A3090",
    modelNumber: "A3090",
    family: "Apple iPhone 15",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-black",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }, { label: "512GB" }],
    searchTerms: ["iPhone 15", "Apple iPhone 15"],
  },
  {
    id: "A2848",
    modelNumber: "A2848",
    family: "Apple iPhone 15 Pro",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["iPhone 15 Pro", "Apple iPhone 15 Pro"],
  },
  {
    id: "A2849",
    modelNumber: "A2849",
    family: "Apple iPhone 15 Pro Max",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium",
    storageOptions: [{ label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["iPhone 15 Pro Max", "Apple iPhone 15 Pro Max"],
  },

  // ── MacBook Pro M3 ───────────────────────────────────────────────
  {
    id: "MTL73",
    modelNumber: "MTL73",
    family: "Apple MacBook Pro 14\" M3",
    brand: "Apple",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spacegray-select-202310",
    storageOptions: [{ label: "8GB / 512GB" }, { label: "16GB / 1TB" }],
    searchTerms: ["MacBook Pro 14 M3", "MacBook Pro 14 inch M3", "MacBook Pro M3 2023"],
  },
  {
    id: "MTL83",
    modelNumber: "MTL83",
    family: "Apple MacBook Pro 14\" M3 Pro",
    brand: "Apple",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spaceblack-select-202310",
    storageOptions: [{ label: "18GB / 512GB" }, { label: "36GB / 1TB" }],
    searchTerms: ["MacBook Pro 14 M3 Pro", "MacBook Pro M3 Pro"],
  },

  // ── Dell XPS ─────────────────────────────────────────────────────
  {
    id: "XPS9530-7749SLV",
    modelNumber: "XPS9530-7749SLV-PUS",
    family: "Dell XPS 15 9530",
    brand: "Dell",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/media-gallery/laptop-xps-9530-nt-blue-gallery-4.psd",
    storageOptions: [{ label: "16GB / 512GB" }, { label: "32GB / 1TB" }],
    searchTerms: ["Dell XPS 15 9530", "Dell XPS 15", "XPS 15 2023"],
  },

  // ── Samsung TV ───────────────────────────────────────────────────
  {
    id: "QE55Q80CATXXH",
    modelNumber: "QE55Q80CATXXH",
    family: "Samsung QLED Q80C",
    brand: "Samsung",
    category: "elektronike",
    subcategory: "TV",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/qn65q80cafxza/gallery/al-qled-q80c-qn65q80cafxza-535157854",
    storageOptions: [],
    searchTerms: ["Samsung Q80C 55 inch", "Samsung QLED 55", "QLED Q80C 55"],
  },
  {
    id: "QE65Q80CATXXH",
    modelNumber: "QE65Q80CATXXH",
    family: "Samsung QLED Q80C",
    brand: "Samsung",
    category: "elektronike",
    subcategory: "TV",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/qn65q80cafxza/gallery/al-qled-q80c-qn65q80cafxza-535157854",
    storageOptions: [],
    searchTerms: ["Samsung Q80C 65 inch", "Samsung QLED 65", "QLED Q80C 65"],
  },
  {
    id: "OLED55C34LA",
    modelNumber: "OLED55C34LA",
    family: "LG OLED C3",
    brand: "LG",
    category: "elektronike",
    subcategory: "TV",
    imageUrl: "https://gscs-b2c.lge.com/downloadFile?fileId=sbRxYPF78z7HxE6b2oTJmA",
    storageOptions: [],
    searchTerms: ["LG OLED C3 55 inch", "LG OLED 55", "OLED C3 55"],
  },
  {
    id: "OLED65C34LA",
    modelNumber: "OLED65C34LA",
    family: "LG OLED C3",
    brand: "LG",
    category: "elektronike",
    subcategory: "TV",
    imageUrl: "https://gscs-b2c.lge.com/downloadFile?fileId=sbRxYPF78z7HxE6b2oTJmA",
    storageOptions: [],
    searchTerms: ["LG OLED C3 65 inch", "LG OLED 65", "OLED C3 65"],
  },

  // ── Gaming ───────────────────────────────────────────────────────
  {
    id: "CFI-1216A",
    modelNumber: "CFI-1216A",
    family: "Sony PlayStation 5",
    brand: "Sony",
    category: "elektronike",
    subcategory: "Gaming",
    imageUrl: "https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21",
    storageOptions: [],
    searchTerms: ["PlayStation 5", "PS5", "PS5 Disc Edition"],
  },
  {
    id: "CFI-1216B",
    modelNumber: "CFI-1216B",
    family: "Sony PlayStation 5 Digital",
    brand: "Sony",
    category: "elektronike",
    subcategory: "Gaming",
    imageUrl: "https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21",
    storageOptions: [],
    searchTerms: ["PlayStation 5 Digital Edition", "PS5 Digital", "PS5 Digital Edition"],
  },
  {
    id: "HEG-001",
    modelNumber: "HEG-001",
    family: "Nintendo Switch OLED",
    brand: "Nintendo",
    category: "elektronike",
    subcategory: "Gaming",
    imageUrl: "https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_2.625/c_scale,w_400/ncom/software/switch/70010000022023/cover",
    storageOptions: [],
    searchTerms: ["Nintendo Switch OLED", "Switch OLED"],
  },
  {
    id: "HEG-S-KAAAA",
    modelNumber: "HEG-S-KAAAA",
    family: "Nintendo Switch 2",
    brand: "Nintendo",
    category: "elektronike",
    subcategory: "Gaming",
    imageUrl: "https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_2/c_scale,w_400/ncom/en_US/products/hardware/nintendo-switch-2",
    storageOptions: [],
    searchTerms: ["Nintendo Switch 2", "Switch 2", "Nintendo Switch 2 console"],
  },
  {
    id: "1TB-XBX",
    modelNumber: "RRT-00010",
    family: "Xbox Series X",
    brand: "Microsoft",
    category: "elektronike",
    subcategory: "Gaming",
    imageUrl: "https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RE4mRni",
    storageOptions: [],
    searchTerms: ["Xbox Series X", "Xbox Series X 1TB"],
  },

  // ── Audio ────────────────────────────────────────────────────────
  {
    id: "WH-1000XM5",
    modelNumber: "WH-1000XM5",
    family: "Sony WH-1000XM5",
    brand: "Sony",
    category: "elektronike",
    subcategory: "Audio",
    imageUrl: "https://www.sony.com/image/5d02da5df552836db894cead8a68f5f3",
    storageOptions: [],
    searchTerms: ["Sony WH-1000XM5", "WH1000XM5", "Sony headphones XM5"],
  },
  {
    id: "MQTP3",
    modelNumber: "MQTP3",
    family: "Apple AirPods Pro 2",
    brand: "Apple",
    category: "elektronike",
    subcategory: "Audio",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83",
    storageOptions: [],
    searchTerms: ["AirPods Pro 2", "Apple AirPods Pro 2nd generation"],
  },
  {
    id: "WF-1000XM5",
    modelNumber: "WF-1000XM5",
    family: "Sony WF-1000XM5",
    brand: "Sony",
    category: "elektronike",
    subcategory: "Audio",
    imageUrl: "https://www.sony.com/image/6745c5f6f92bc9da3e792f02f2adeadc",
    storageOptions: [],
    searchTerms: ["Sony WF-1000XM5", "WF1000XM5", "Sony earbuds XM5"],
  },

  // ── More Telefona ────────────────────────────────────────────────
  {
    id: "SM-S931B",
    modelNumber: "SM-S931B",
    family: "Samsung Galaxy S25",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2501/gallery/al-galaxy-s25-s931-sm-s931bzkdeue-thumb",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }],
    searchTerms: ["Samsung Galaxy S25", "Galaxy S25"],
  },
  {
    id: "SM-S936B",
    modelNumber: "SM-S936B",
    family: "Samsung Galaxy S25+",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2501/gallery/al-galaxy-s25-plus-s936-sm-s936bzkdeue-thumb",
    storageOptions: [{ label: "256GB" }, { label: "512GB" }],
    searchTerms: ["Samsung Galaxy S25 Plus", "Galaxy S25+", "S25 Plus"],
  },
  {
    id: "SM-S938B",
    modelNumber: "SM-S938B",
    family: "Samsung Galaxy S25 Ultra",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2501/gallery/al-galaxy-s25-ultra-s938-sm-s938bzkgeue-thumb",
    storageOptions: [{ label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["Samsung Galaxy S25 Ultra", "Galaxy S25 Ultra"],
  },
  {
    id: "A3293",
    modelNumber: "A3293",
    family: "Apple iPhone 16",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-black",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }, { label: "512GB" }],
    searchTerms: ["iPhone 16", "Apple iPhone 16"],
  },
  {
    id: "A3294",
    modelNumber: "A3294",
    family: "Apple iPhone 16 Pro",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["iPhone 16 Pro", "Apple iPhone 16 Pro"],
  },
  {
    id: "A3295",
    modelNumber: "A3295",
    family: "Apple iPhone 16 Pro Max",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-9inch-blacktitanium",
    storageOptions: [{ label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["iPhone 16 Pro Max", "Apple iPhone 16 Pro Max"],
  },
  {
    id: "23116PN5BC",
    modelNumber: "23116PN5BC",
    family: "Xiaomi 14",
    brand: "Xiaomi",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F0/pms_1707207339.34571374.png",
    storageOptions: [{ label: "256GB" }, { label: "512GB" }],
    searchTerms: ["Xiaomi 14", "Xiaomi 14 5G"],
  },
  {
    id: "2311DRK48G",
    modelNumber: "2311DRK48G",
    family: "Xiaomi Redmi Note 13 Pro",
    brand: "Xiaomi",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F0/pms_1695709337.58760086.png",
    storageOptions: [{ label: "256GB" }],
    searchTerms: ["Redmi Note 13 Pro", "Xiaomi Redmi Note 13 Pro"],
  },
  {
    id: "SM-X110",
    modelNumber: "SM-X110",
    family: "Samsung Galaxy Tab A9",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Tablet",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/sm-x110nzaaeue/gallery/al-galaxy-tab-a9-sm-x110-sm-x110nzaaeue-thumb",
    storageOptions: [{ label: "64GB" }, { label: "128GB" }],
    searchTerms: ["Samsung Galaxy Tab A9", "Galaxy Tab A9"],
  },
  {
    id: "MQKQ3",
    modelNumber: "MQKQ3",
    family: "Apple iPad 10th Gen",
    brand: "Apple",
    category: "telefona",
    subcategory: "Tablet",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-10th-gen-finish-select-202212-blue-wifi",
    storageOptions: [{ label: "64GB" }, { label: "256GB" }],
    searchTerms: ["iPad 10th generation", "Apple iPad 2022", "iPad 2022"],
  },

  // ── More Laptops ─────────────────────────────────────────────────
  {
    id: "MXCV3",
    modelNumber: "MXCV3",
    family: "Apple MacBook Air 15\" M3",
    brand: "Apple",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba15-midnight-select-202402",
    storageOptions: [{ label: "8GB / 256GB" }, { label: "16GB / 512GB" }],
    searchTerms: ["MacBook Air 15 M3", "MacBook Air 15 inch M3", "MacBook Air M3 2024"],
  },
  {
    id: "MRXN3",
    modelNumber: "MRXN3",
    family: "Apple MacBook Air 13\" M3",
    brand: "Apple",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba13-midnight-select-202402",
    storageOptions: [{ label: "8GB / 256GB" }, { label: "16GB / 512GB" }],
    searchTerms: ["MacBook Air 13 M3", "MacBook Air 13 inch M3", "MacBook Air M3"],
  },
  {
    id: "20XW005RIX",
    modelNumber: "20XW005RIX",
    family: "Lenovo ThinkPad X1 Carbon Gen 10",
    brand: "Lenovo",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://p3-ofp.static.pub/fes/cms/2022/07/20/ofp-2022-07-20-p3-7c0c1640-8ab6-4e6e-ab4a-1aba786d1a14.png",
    storageOptions: [{ label: "16GB / 512GB" }, { label: "32GB / 1TB" }],
    searchTerms: ["Lenovo ThinkPad X1 Carbon", "ThinkPad X1 Carbon Gen 10"],
  },
  {
    id: "82H801KKIX",
    modelNumber: "82H801KKIX",
    family: "Lenovo IdeaPad 5 15",
    brand: "Lenovo",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://p3-ofp.static.pub/fes/cms/2021/10/20/y2m3uluwsv2fnvnxb77cjgjvzbbhue558009.png",
    storageOptions: [{ label: "16GB / 512GB" }],
    searchTerms: ["Lenovo IdeaPad 5", "IdeaPad 5 15", "Lenovo IdeaPad 5 15"],
  },
  {
    id: "HP-ENVY15-FH0012",
    modelNumber: "7Z2N4EA",
    family: "HP Envy x360 15",
    brand: "HP",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08761428.png",
    storageOptions: [{ label: "16GB / 512GB" }],
    searchTerms: ["HP Envy x360 15", "HP Envy 15 2023", "HP Envy x360"],
  },
  {
    id: "ASUS-UX3405MA",
    modelNumber: "UX3405MA",
    family: "ASUS ZenBook 14 OLED",
    brand: "ASUS",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://dlcdnwebimgs.asus.com/gain/3AE38A6B-7B9F-4B91-8E13-4DCBFCDE3D2A",
    storageOptions: [{ label: "16GB / 512GB" }, { label: "32GB / 1TB" }],
    searchTerms: ["ASUS ZenBook 14 OLED", "ZenBook 14 OLED", "ASUS ZenBook OLED 2024"],
  },

  // ── Monitors ─────────────────────────────────────────────────────
  {
    id: "LS27C432GAUXEN",
    modelNumber: "LS27C432GAUXEN",
    family: "Samsung 27\" IPS Gaming Monitor",
    brand: "Samsung",
    category: "kompjutera",
    subcategory: "Monitor",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/ls27c432gauxen/gallery/al-viewfinity-s4-ls27c432gauxen-thumb",
    storageOptions: [],
    searchTerms: ["Samsung monitor 27 inch", "Samsung 27 inch IPS", "Samsung gaming monitor 27"],
  },
  {
    id: "27GP850P-B",
    modelNumber: "27GP850P-B",
    family: "LG UltraGear 27\" QHD Gaming",
    brand: "LG",
    category: "kompjutera",
    subcategory: "Monitor",
    imageUrl: "https://gscs-b2c.lge.com/downloadFile?fileId=kDZQlL8uJGpMH6sZ5KAibQ",
    storageOptions: [],
    searchTerms: ["LG UltraGear 27 QHD", "LG gaming monitor 27 inch", "LG UltraGear QHD"],
  },

  // ── Shtëpi & Kopsht ──────────────────────────────────────────────
  {
    id: "WAN2426PXLS",
    modelNumber: "WAN2426PXLS",
    family: "Bosch Serie 6 Washing Machine 9kg",
    brand: "Bosch",
    category: "shtepi",
    subcategory: "Pajisje Kuzhine",
    imageUrl: "https://media3.bosch-home.com/Images/1920x/MCSA02700286_BO_FOC_F_WAN2426PXLS_def.jpg",
    storageOptions: [],
    searchTerms: ["Bosch lavatrice 9kg", "Bosch washing machine 9kg", "Bosch Serie 6"],
  },
  {
    id: "WW90T534DAE",
    modelNumber: "WW90T534DAE",
    family: "Samsung EcoBubble Washing Machine 9kg",
    brand: "Samsung",
    category: "shtepi",
    subcategory: "Pajisje Kuzhine",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/ww90t534dae/gallery/al-front-loading-ww90t534dae-thumb",
    storageOptions: [],
    searchTerms: ["Samsung lavatrice 9kg", "Samsung washing machine 9kg", "Samsung EcoBubble"],
  },
  {
    id: "RB38A7B5E22",
    modelNumber: "RB38A7B5E22",
    family: "Samsung Refrigerator 390L",
    brand: "Samsung",
    category: "shtepi",
    subcategory: "Pajisje Kuzhine",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/rb38a7b5e22/gallery/al-top-mount-freezer-rb38a7b5e22-thumb",
    storageOptions: [],
    searchTerms: ["Samsung frigorifer 390L", "Samsung refrigerator 390L", "Samsung frigorifer"],
  },
  {
    id: "HD9280-90",
    modelNumber: "HD9280/90",
    family: "Philips Airfryer XXL",
    brand: "Philips",
    category: "shtepi",
    subcategory: "Pajisje Kuzhine",
    imageUrl: "https://images.philips.com/is/image/PhilipsConsumer/HD9280_90-IMS-global",
    storageOptions: [],
    searchTerms: ["Philips Airfryer XXL", "Philips air fryer", "airfryer Philips XXL"],
  },
  {
    id: "V15-DETECT",
    modelNumber: "SV22",
    family: "Dyson V15 Detect",
    brand: "Dyson",
    category: "shtepi",
    subcategory: "Pastrimi",
    imageUrl: "https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/hero/368096-01.png",
    storageOptions: [],
    searchTerms: ["Dyson V15 Detect", "Dyson V15", "Dyson fshese me korrent"],
  },
  {
    id: "S3122",
    modelNumber: "S3122",
    family: "iRobot Roomba i3+",
    brand: "iRobot",
    category: "shtepi",
    subcategory: "Pastrimi",
    imageUrl: "https://homeassets.irobot.com/is/image/iRobot/roomba_i3plus_product_hero_1x1",
    storageOptions: [],
    searchTerms: ["iRobot Roomba i3+", "Roomba i3", "Roomba robot fshese"],
  },
  {
    id: "HF-LP075",
    modelNumber: "HF-LP075",
    family: "Xiaomi Smart Projector 2 Pro",
    brand: "Xiaomi",
    category: "shtepi",
    subcategory: "Ndriçim",
    imageUrl: "https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F0/pms_1640163553.5748246.png",
    storageOptions: [],
    searchTerms: ["Xiaomi Smart Projector 2 Pro", "Xiaomi projektor", "Xiaomi projektor 4K"],
  },

  // ── Sporte & Outdoor ─────────────────────────────────────────────
  {
    id: "DV9864-001",
    modelNumber: "DV9864-001",
    family: "Nike Air Max 270",
    brand: "Nike",
    category: "sporte",
    subcategory: "Veshje Sportive",
    imageUrl: "https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/aipmfk95mjqbwdopehep/air-max-270-shoes.png",
    storageOptions: [{ label: "40" }, { label: "41" }, { label: "42" }, { label: "43" }, { label: "44" }, { label: "45" }],
    searchTerms: ["Nike Air Max 270", "Nike Air Max 270 shoes"],
  },
  {
    id: "GW4138",
    modelNumber: "GW4138",
    family: "Adidas Ultraboost 23",
    brand: "Adidas",
    category: "sporte",
    subcategory: "Veshje Sportive",
    imageUrl: "https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/5f32cedf42444060a84aaf8400b6ff88_9366/Ultraboost_23_Shoes_White_GY9351_01_standard.jpg",
    storageOptions: [{ label: "40" }, { label: "41" }, { label: "42" }, { label: "43" }, { label: "44" }, { label: "45" }],
    searchTerms: ["Adidas Ultraboost 23", "Adidas Ultraboost"],
  },
  {
    id: "TMILL-T100",
    modelNumber: "DOMYOS-T100",
    family: "Domyos Treadmill T100",
    brand: "Domyos",
    category: "sporte",
    subcategory: "Fitness",
    imageUrl: "https://contents.mediadecathlon.com/p1999456/k$a9f3b1c3b4d5e6f7a8b9c0d1e2f3a4b5/tapis-roulant-t100-domyos.jpg",
    storageOptions: [],
    searchTerms: ["Domyos T100", "Domyos tapis roulant", "treadmill fitness"],
  },
  {
    id: "B'TWIN-520",
    modelNumber: "BTWIN-520",
    family: "B'Twin Triban RC 520",
    brand: "B'Twin",
    category: "sporte",
    subcategory: "Biçikleta",
    imageUrl: "https://contents.mediadecathlon.com/p2104978/k$4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a/shise-biçikleta-triban-rc-520.jpg",
    storageOptions: [],
    searchTerms: ["Triban RC 520", "B'Twin biçikletë", "Triban biçikletë"],
  },

  // ── Veshje & Këpucë ──────────────────────────────────────────────
  {
    id: "BQ3204-001",
    modelNumber: "BQ3204-001",
    family: "Nike Air Force 1 '07",
    brand: "Nike",
    category: "veshje",
    subcategory: "Këpucë",
    imageUrl: "https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/00375826-1527-4821-85a5-d9e6e2ffcfdb/air-force-1-07-shoes.png",
    storageOptions: [{ label: "39" }, { label: "40" }, { label: "41" }, { label: "42" }, { label: "43" }, { label: "44" }],
    searchTerms: ["Nike Air Force 1", "Nike Air Force 1 07", "Nike AF1"],
  },
  {
    id: "EG4958",
    modelNumber: "EG4958",
    family: "Adidas Stan Smith",
    brand: "Adidas",
    category: "veshje",
    subcategory: "Këpucë",
    imageUrl: "https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/7ed0855435194229a525aad6009a0497_9366/Stan_Smith_Shoes_White_FX5502_01_standard.jpg",
    storageOptions: [{ label: "39" }, { label: "40" }, { label: "41" }, { label: "42" }, { label: "43" }, { label: "44" }],
    searchTerms: ["Adidas Stan Smith", "Stan Smith white"],
  },
  {
    id: "NMJS-001",
    modelNumber: "NA-WJ-001",
    family: "Nike Therma-FIT ADV Jacket",
    brand: "Nike",
    category: "veshje",
    subcategory: "Xhaketë",
    imageUrl: "https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/jacket-placeholder.png",
    storageOptions: [{ label: "S" }, { label: "M" }, { label: "L" }, { label: "XL" }],
    searchTerms: ["Nike Therma-FIT jacket", "Nike xhaketë", "Nike therma fit"],
  },

  // ── Lodra & Fëmijë ───────────────────────────────────────────────
  {
    id: "LEGO-42154",
    modelNumber: "42154",
    family: "LEGO Technic Ford GT",
    brand: "LEGO",
    category: "lodra",
    subcategory: "Lodra",
    imageUrl: "https://www.lego.com/cdn/cs/set/assets/blt44c9cfe8be24c38b/42154.jpg",
    storageOptions: [],
    searchTerms: ["LEGO Technic Ford GT", "LEGO 42154", "LEGO Technic makinë"],
  },
  {
    id: "LEGO-10311",
    modelNumber: "10311",
    family: "LEGO Icons Orchid",
    brand: "LEGO",
    category: "lodra",
    subcategory: "Lodra",
    imageUrl: "https://www.lego.com/cdn/cs/set/assets/blt6e1bacd1ab215dc0/10311.jpg",
    storageOptions: [],
    searchTerms: ["LEGO Icons Orchid", "LEGO 10311", "LEGO lule"],
  },
  {
    id: "SWITCH-OLED-MK",
    modelNumber: "HEG-S-KABAA",
    family: "Nintendo Switch OLED Mario Kart Bundle",
    brand: "Nintendo",
    category: "lodra",
    subcategory: "Lodra",
    imageUrl: "https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_2/c_scale,w_400/ncom/en_US/products/hardware/nintendo-switch-oled-model-mario-kart-8-deluxe-bundle",
    storageOptions: [],
    searchTerms: ["Nintendo Switch OLED Mario Kart", "Switch OLED Mario Kart bundle"],
  },
  {
    id: "FURBY-CORAL",
    modelNumber: "F6743",
    family: "Furby Interactive Toy",
    brand: "Hasbro",
    category: "lodra",
    subcategory: "Lodra",
    imageUrl: "https://hasbro.com/common/productimages/en_US/F6743_1.jpg",
    storageOptions: [],
    searchTerms: ["Furby interaktiv", "Furby lëvizëse"],
  },

  // ── Bukuri & Shëndet ─────────────────────────────────────────────
  {
    id: "DIOR-SAUVAGE-EDT",
    modelNumber: "DIOR-SAUVAGE-100ML",
    family: "Dior Sauvage EDT 100ml",
    brand: "Dior",
    category: "bukuri",
    subcategory: "Parfum",
    imageUrl: "https://www.dior.com/dw/image/v2/BGXS_PRD/on/demandware.static/-/Sites-master_dior/default/dw6dc94b80/Y0996350/Y0996350_C099600355_E01_GHC.jpg",
    storageOptions: [],
    searchTerms: ["Dior Sauvage EDT", "Dior Sauvage 100ml", "parfum Dior burra"],
  },
  {
    id: "CHANEL-N5-EDP",
    modelNumber: "CHANEL-N5-100ML",
    family: "Chanel N°5 EDP 100ml",
    brand: "Chanel",
    category: "bukuri",
    subcategory: "Parfum",
    imageUrl: "https://www.chanel.com/images//t_one//q_auto:good,f_auto,fl_lossy,dpr_1.1/w_620/n-5-eau-de-parfum-spray-3-4fl-oz--packshot-default-107365-9535028396062.jpg",
    storageOptions: [],
    searchTerms: ["Chanel No 5 EDP", "Chanel N5 100ml", "parfum Chanel gra"],
  },
  {
    id: "ORAL-B-IO9",
    modelNumber: "IO9-BLACK",
    family: "Oral-B iO Series 9",
    brand: "Oral-B",
    category: "bukuri",
    subcategory: "Rruajtje",
    imageUrl: "https://oralb.com/image/upload/f_auto/q_auto/oral-b-io-series-9.jpg",
    storageOptions: [],
    searchTerms: ["Oral-B iO Series 9", "Oral-B electric toothbrush", "furçë dhëmbësh elektrike"],
  },
  {
    id: "BRAUN-SERIES9",
    modelNumber: "9470CC",
    family: "Braun Series 9 Pro+ Electric Shaver",
    brand: "Braun",
    category: "bukuri",
    subcategory: "Rruajtje",
    imageUrl: "https://content.braun.com/Assets/product/braun-series-9-electric-shaver-9470cc.png",
    storageOptions: [],
    searchTerms: ["Braun Series 9 Pro", "Braun rruajtëse elektrike", "Braun Series 9"],
  },
  {
    id: "CETAPHIL-CLEANSER",
    modelNumber: "CE-GENTLE-250",
    family: "Cetaphil Gentle Skin Cleanser 250ml",
    brand: "Cetaphil",
    category: "bukuri",
    subcategory: "Kujdes Lëkure",
    imageUrl: "https://www.cetaphil.com/dw/image/v2/BCCK_PRD/on/demandware.static/-/Sites-cetaphil-master-catalog/default/gentle-skin-cleanser-250ml.jpg",
    storageOptions: [],
    searchTerms: ["Cetaphil Gentle Cleanser", "Cetaphil pastrim fytyre"],
  },
];

// Products that share a family (for cross-linking on product pages)
export function getFamilySiblings(product: Product): Product[] {
  return PRODUCTS.filter(
    (p) => p.family === product.family && p.id !== product.id
  );
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return PRODUCTS.filter((p) => p.category === categoryId);
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return PRODUCTS.filter(
    (p) =>
      p.family.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.modelNumber.toLowerCase().includes(q) ||
      p.searchTerms.some((t) => t.toLowerCase().includes(q))
  );
}

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

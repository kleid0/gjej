import { describe, it, expect } from "vitest";
import { guessCategory } from "../ProductDiscovery";
import { CATEGORIES } from "@/src/domain/catalog/Product";

// Every case here is a real (or lightly trimmed) product name from
// data/discovered-products.json — the June 2026 audit set. The old classifier
// put the first three in the SAME bucket ("the AIO PC / desk fan /
// motherboard problem") and 40% of the catalogue in elektronike/Aksesore.
const CASES: Array<[name: string, category: string, subcategory: string]> = [
  // The original complaint
  ["PC Lenovo AIO IdeaCentre 3 23.8″, 16GB, 512GB SSD, AMD Ryzen 7", "kompjutera", "Desktop PC"],
  ["Xiaomi Smart Standing Fan 2 Lite", "shtepiake", "Klimatizim & Ngrohje"],
  ["Pllakë amë ASUS TUF GAMING B650-PLUS, Socket AM5, ATX", "kompjutera", "Komponente PC"],
  ["Asus Motherboard ASUS TUF GAMING B850-PLUS WIFI 7, Micro ATX, DDR5", "kompjutera", "Komponente PC"],
  // …and the "who needs a category with a Switch, a Dyson and camera film"
  ["Nintendo Switch 2 Console", "gaming", "Konsola"],
  ["Fshesë DYSON V15s Detect Submarine, Teal", "shtepiake", "Fshesa & Pastrim"],
  ["Fujifilm Instax Mini Film 2x10", "foto-video", "Aksesore Foto"],

  // AIO disambiguation: cooler stays a component
  ["DeepCool AIO 240mm Liquid Cooler LE520", "kompjutera", "Komponente PC"],
  ["Kompjuter mini ASUS NUC GEN15 Pro+ i5", "kompjutera", "Desktop PC"],
  ["Kompjuter Dell DC15255, Ryzen 7-7730U, 16GB RAM, 1TB SSD", "kompjutera", "Desktop PC"],

  // Gaming splits
  ["Bethesda PS5 Starfield", "gaming", "Lojera"],
  ["Sony Kontroller DualSense V2 për PlayStation 5", "gaming", "Kontrollera"],
  ["Furnizues energjie për Xbox One AKYGA AK-PD-01, 135W", "gaming", "Aksesore Gaming"],
  ["Steelplay Carry & Protect Kit Nintendo Switch 11in1", "gaming", "Aksesore Gaming"],

  // Albanian names the old English-only rules missed
  ["Altoparlant portativ Blow BT460, 10W", "tv-audio", "Altoparlant & Soundbar"],
  ["TV SAMSUNG THE FRAME QE75LS03FWUXXH", "tv-audio", "TV"],
  ["MBAJTESE TV SONOROUS SUREFIX 152 40\"-65\" FIX", "tv-audio", "Aksesore TV"],
  ["Lavatrice Electrolux EW6F2491E", "shtepiake", "Lavatrice & Tharese"],
  ["Frigorifer i kombinuar Samsung RB38C600ES9 390L No Frost", "shtepiake", "Frigorifer"],
  ["Lavastovilje Hisense HV642D90", "shtepiake", "Lavastovilje"],
  ["Furre Electrolux EOE8P39WV", "shtepiake", "Furre & Gatim"],
  ["Faber Aspirator IN-NOVA ZERO DRIP X A60", "shtepiake", "Furre & Gatim"],
  ["Xiaomi Smart Air Purifier 4 Compact", "shtepiake", "Klimatizim & Ngrohje"],
  ["Boiler Gorenje Vertikal TG50WE", "shtepiake", "Klimatizim & Ngrohje"],
  ["TAVOLINE HEKUROSJEJE ME VAKUM BEKO ADN 040 BP", "shtepiake", "Hekurosje"],
  ["Metalac Tenxhere me kapak 387267 24 cm", "shtepi", "Ene Gatimi"],

  // Beauty appliances must not fall into laundry
  ["Tharese flokesh Philips BHD837/10", "bukuri", "Kujdes Flokesh"],
  ["Tharese rrobash Hisense DH7S107BW", "shtepiake", "Lavatrice & Tharese"],
  ["Depilator Rowenta EP4920F0", "bukuri", "Rruajtje & Depilim"],

  // Components / storage / peripherals
  ["DeepCool PSU PN850M 850W", "kompjutera", "Komponente PC"],
  ["G.Skill RAM 32GB Trident Z5 RGB 2x16GB 6400Mhz DDR5", "kompjutera", "Komponente PC"],
  ["Intel Procesor Core i3-12100, 12 MB Smart Cache, Box", "kompjutera", "Komponente PC"],
  ["Samsung 990 PRO PCIe 4.0 NVMe SSD 2TB", "kompjutera", "Disqe & Ruajtje"],
  ["Keychron Keyboard Q5 MAX QMK/VIA Wireless", "kompjutera", "Tastiere & Mouse"],
  ["Redragon Mouse Griffin M607", "kompjutera", "Tastiere & Mouse"],
  ["Terra Webcam TW-S01", "kompjutera", "Aksesore PC"],
  ["MERCUSYS Switch 5-Port Gigabit", "kompjutera", "Rrjete & WiFi"],

  // Monitors / signage before laptop tokens
  ["Ekran signage digjital Samsung QM50C", "kompjutera", "Monitor"],
  ["Laptop Lenovo IdeaPad Slim 3, Ryzen 5", "kompjutera", "Laptop"],

  // Smartwatch before phone tokens
  ["Redmi Watch 5 Active", "telefona", "Smartwatch"],
  ["Xiaomi Redmi Note 13 Pro 256GB", "telefona", "Smartphone"],

  // Toys split
  ["Funko Pop! Vinyl Television 1238: Stranger Things Eleven", "lodra", "Figura & Koleksion"],
  ["Doll Barbie Cutie Reveal Jungle Series", "lodra", "Kukulla & Plush"],
  ["Ravensburger Puzzle Marvel Avengers XXL 100 Pcs", "lodra", "Puzzle & Lojera Tavoline"],
  ["Spin Master Vehicle Paw Patrol Chase With Puppy", "lodra", "Lodra"],

  // Slimmed accessories bucket
  ["Tech-Protect Powerbank LifeMag PB11 10000mAh", "elektronike", "Power Bank & Bateri"],
  ["KABELL APPLE WOVEN 60W USB-C 1M", "elektronike", "Karikues & Kabllo"],
  ["Dell Adapter energjie 45W USB-C", "elektronike", "Karikues & Kabllo"],
];

describe("guessCategory", () => {
  it.each(CASES)("%s → %s/%s", (name, category, subcategory) => {
    expect(guessCategory(name)).toEqual({ category, subcategory });
  });

  it("only ever returns categories and subcategories that exist in CATEGORIES", () => {
    for (const [name] of CASES) {
      const { category, subcategory } = guessCategory(name);
      const cat = CATEGORIES.find((c) => c.id === category);
      expect(cat, `unknown category ${category} for "${name}"`).toBeDefined();
      expect(cat!.subcategories, `unknown subcategory ${subcategory} for "${name}"`).toContain(subcategory);
    }
  });

  it("defaults to the catch-all for unrecognizable names", () => {
    expect(guessCategory("Gadget XYZ 3000")).toEqual({ category: "elektronike", subcategory: "Te Tjera" });
  });
});

// Dependency injection container — wires domain interfaces to infrastructure implementations
// Import from here in API routes and server components (never import infra directly from UI).

import { DbProductRepository } from "./persistence/DbProductRepository";
import { FilePriceRepository } from "./persistence/FilePriceRepository";
import { ProductDiscoveryService } from "./scrapers/ProductDiscovery";
import { PriceScraper } from "./scrapers/PriceScraper";
import { STORES } from "./stores/registry";
import { ProductCatalog } from "@/src/application/catalog/ProductCatalog";
import { CatalogDiscovery } from "@/src/application/catalog/CatalogDiscovery";
import { DuplicateFuser } from "@/src/application/catalog/DuplicateFuser";
import { PriceQuery } from "@/src/application/pricing/PriceQuery";

// Repositories
// Products live in Postgres (Fix D): file-backed storage didn't survive
// Vercel's /tmp recycling, so discovery writes never reached the homepage.
// DbProductRepository falls back to data/discovered-products.json when the
// DB is empty/unreachable, keeping local dev and fresh deploys working.
export const productRepo = new DbProductRepository();
const priceRepo = new FilePriceRepository();

// Services
const discoveryService = new ProductDiscoveryService();
const priceScraper = new PriceScraper();

// Use cases (exported for use in API routes and server components)
export const productCatalog = new ProductCatalog(productRepo);
export const catalogDiscovery = new CatalogDiscovery(productRepo, discoveryService);
export const duplicateFuser = new DuplicateFuser(productRepo);
export const priceQuery = new PriceQuery(priceRepo, priceScraper, STORES);

// Re-export store list for components that need it (e.g. PriceComparison)
export { STORES };

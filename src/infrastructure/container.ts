// Dependency injection container — wires domain interfaces to infrastructure implementations
// Import from here in API routes and server components (never import infra directly from UI).

import { FileProductRepository } from "./persistence/FileProductRepository";
import { FilePriceRepository } from "./persistence/FilePriceRepository";
import { ProductDiscoveryService } from "./scrapers/ProductDiscovery";
import { PriceScraper } from "./scrapers/PriceScraper";
import { STORES } from "./stores/registry";
import { ProductCatalog } from "@/src/application/catalog/ProductCatalog";
import { CatalogDiscovery } from "@/src/application/catalog/CatalogDiscovery";
import { PriceQuery } from "@/src/application/pricing/PriceQuery";

// Repositories
const productRepo = new FileProductRepository();
const priceRepo = new FilePriceRepository();

// Services
const discoveryService = new ProductDiscoveryService();
const priceScraper = new PriceScraper();

// Use cases (exported for use in API routes and server components)
export const productCatalog = new ProductCatalog(productRepo);
export const catalogDiscovery = new CatalogDiscovery(productRepo, discoveryService);
export const priceQuery = new PriceQuery(priceRepo, priceScraper, STORES);

// Re-export store list for components that need it (e.g. PriceComparison)
export { STORES };

// Infrastructure: Postgres-backed implementation of IProductRepository.
//
// Fix D: discovery used to write to /tmp/discovered-products.json, which
// Vercel wipes between invocations, so newly discovered products never
// reached the homepage. This repo UPSERTs into the `products` table (the
// same one /api/admin/migrate seeded) so discovery writes survive.
//
// getAll() falls back to the committed JSON snapshot when the DB is empty
// or unreachable, preserving fresh-deploy / local-dev ergonomics.

import { promises as fs } from "fs";
import path from "path";
import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";
import type { Product } from "@/src/domain/catalog/Product";
import { sql, rawQuery } from "@/src/infrastructure/db/client";
import { scoreAndSortProducts, parseSearchQuery } from "./productSearch";

type ProductRow = {
  id: string;
  model_number: string;
  family: string;
  brand: string;
  category: string;
  subcategory: string;
  image_url: string;
  storage_options: Product["storageOptions"] | null;
  search_terms: string[] | null;
  variant: Product["variant"] | null;
  specs: Product["specs"] | null;
  description: string | null;
  official_images: string[] | null;
  enriched_at: string | Date | null;
};

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    modelNumber: r.model_number ?? "",
    family: r.family ?? "",
    brand: r.brand ?? "",
    category: r.category ?? "",
    subcategory: r.subcategory ?? "",
    imageUrl: r.image_url ?? "",
    storageOptions: r.storage_options ?? [],
    searchTerms: r.search_terms ?? [],
    variant: r.variant ?? undefined,
    specs: r.specs ?? undefined,
    description: r.description ?? undefined,
    officialImages: r.official_images ?? undefined,
    enrichedAt: r.enriched_at
      ? new Date(r.enriched_at).toISOString()
      : undefined,
  };
}

async function readSnapshotFallback(): Promise<Product[]> {
  try {
    const snapshot = path.join(
      process.cwd(),
      "data",
      "discovered-products.json",
    );
    const raw = await fs.readFile(snapshot, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Tuned to match /api/admin/migrate — 100 parallel UPSERTs per batch is
// fast enough for the whole catalogue and fits comfortably under Neon's
// connection ceiling via pgbouncer.
const UPSERT_BATCH_SIZE = 100;

export class DbProductRepository implements IProductRepository {
  async getAll(): Promise<Product[]> {
    try {
      const { rows } = await sql`
        SELECT id, model_number, family, brand, category, subcategory,
               image_url, storage_options, search_terms,
               variant, specs, description, official_images, enriched_at
        FROM products
      `;
      if (rows.length > 0) return (rows as ProductRow[]).map(rowToProduct);
    } catch (err) {
      console.error(
        "[DbProductRepository.getAll] DB read failed, falling back to snapshot:",
        err instanceof Error ? err.message : err,
      );
    }
    return readSnapshotFallback();
  }

  async getById(id: string): Promise<Product | null> {
    // Try exact match first
    try {
      const { rows } = await sql`
        SELECT id, model_number, family, brand, category, subcategory,
               image_url, storage_options, search_terms,
               variant, specs, description, official_images, enriched_at
        FROM products WHERE id = ${id} LIMIT 1
      `;
      if (rows.length > 0) return rowToProduct(rows[0] as ProductRow);

      // Fallback: Next.js URL-decodes dynamic path segments before passing
      // them as params.slug, so decoded IDs may arrive for products whose
      // stored ID is percent-encoded. Match by decoded form.
      const decoded = safeDecode(id);
      if (decoded !== id) {
        const { rows: rows2 } = await sql`
          SELECT id, model_number, family, brand, category, subcategory,
                 image_url, storage_options, search_terms,
                 variant, specs, description, official_images, enriched_at
          FROM products WHERE id = ${decoded} LIMIT 1
        `;
        if (rows2.length > 0) return rowToProduct(rows2[0] as ProductRow);
      }
    } catch (err) {
      console.error("[DbProductRepository.getById] DB read failed:", err);
    }

    // Snapshot fallback: scan and compare with decode normalisation
    const all = await readSnapshotFallback();
    const norm = safeDecode(id);
    return (
      all.find((p) => p.id === id) ??
      all.find((p) => safeDecode(p.id) === norm) ??
      null
    );
  }

  async getByCategory(categoryId: string): Promise<Product[]> {
    try {
      const { rows } = await sql`
        SELECT id, model_number, family, brand, category, subcategory,
               image_url, storage_options, search_terms,
               variant, specs, description, official_images, enriched_at
        FROM products WHERE category = ${categoryId}
      `;
      return (rows as ProductRow[]).map(rowToProduct);
    } catch (err) {
      console.error("[DbProductRepository.getByCategory] DB read failed:", err);
      const all = await readSnapshotFallback();
      return all.filter((p) => p.category === categoryId);
    }
  }

  async search(query: string): Promise<Product[]> {
    const { words } = parseSearchQuery(query);
    if (words.length === 0) return [];

    try {
      // Narrow the candidate set in SQL (AND of per-word ILIKE), then do the
      // full scoring in JS so behaviour matches the file-backed repo exactly.
      const params: string[] = [];
      const clauses: string[] = [];
      for (const w of words) {
        params.push(`%${w}%`);
        const idx = params.length;
        clauses.push(
          `(family ILIKE $${idx} OR brand ILIKE $${idx} OR model_number ILIKE $${idx} OR search_terms::text ILIKE $${idx})`,
        );
      }
      const { rows } = await rawQuery(
        `SELECT id, model_number, family, brand, category, subcategory,
                image_url, storage_options, search_terms,
                variant, specs, description, official_images, enriched_at
         FROM products
         WHERE ${clauses.join(" AND ")}`,
        params,
      );
      return scoreAndSortProducts(
        (rows as ProductRow[]).map(rowToProduct),
        query,
      );
    } catch (err) {
      console.error("[DbProductRepository.search] DB read failed:", err);
      const all = await readSnapshotFallback();
      return scoreAndSortProducts(all, query);
    }
  }

  async getFamilySiblings(product: Product): Promise<Product[]> {
    try {
      const { rows } = await sql`
        SELECT id, model_number, family, brand, category, subcategory,
               image_url, storage_options, search_terms,
               variant, specs, description, official_images, enriched_at
        FROM products WHERE family = ${product.family} AND id != ${product.id}
      `;
      return (rows as ProductRow[]).map(rowToProduct);
    } catch (err) {
      console.error("[DbProductRepository.getFamilySiblings] DB read failed:", err);
      const all = await readSnapshotFallback();
      return all.filter(
        (p) => p.family === product.family && p.id !== product.id,
      );
    }
  }

  async saveAll(products: Product[]): Promise<void> {
    if (products.length === 0) return;

    // Mirror /api/admin/migrate: 100-at-a-time parallel UPSERTs. Only the
    // Product-domain columns are written; price/coverage columns
    // (lowest_price, store_count, last_seen_at, catalogue_status) are owned
    // by the cron and refresh flows and left untouched.
    for (let i = 0; i < products.length; i += UPSERT_BATCH_SIZE) {
      const batch = products.slice(i, i + UPSERT_BATCH_SIZE);
      await Promise.allSettled(
        batch.map((p) =>
          sql`
            INSERT INTO products (
              id, model_number, family, brand, category, subcategory,
              image_url, storage_options, search_terms,
              variant, specs, description, official_images, enriched_at
            ) VALUES (
              ${p.id},
              ${p.modelNumber ?? ""},
              ${p.family ?? ""},
              ${p.brand ?? ""},
              ${p.category ?? ""},
              ${p.subcategory ?? ""},
              ${p.imageUrl ?? ""},
              ${JSON.stringify(p.storageOptions ?? [])}::jsonb,
              ${JSON.stringify(p.searchTerms ?? [])}::jsonb,
              ${p.variant ? JSON.stringify(p.variant) : null}::jsonb,
              ${p.specs ? JSON.stringify(p.specs) : null}::jsonb,
              ${p.description ?? null},
              ${p.officialImages ? JSON.stringify(p.officialImages) : null}::jsonb,
              ${p.enrichedAt ? new Date(p.enrichedAt).toISOString() : null}
            )
            ON CONFLICT (id) DO UPDATE SET
              model_number    = EXCLUDED.model_number,
              family          = EXCLUDED.family,
              brand           = EXCLUDED.brand,
              category        = EXCLUDED.category,
              subcategory     = EXCLUDED.subcategory,
              image_url       = EXCLUDED.image_url,
              storage_options = EXCLUDED.storage_options,
              search_terms    = EXCLUDED.search_terms,
              variant         = EXCLUDED.variant,
              specs           = EXCLUDED.specs,
              description     = EXCLUDED.description,
              official_images = EXCLUDED.official_images,
              enriched_at     = EXCLUDED.enriched_at,
              updated_at      = NOW()
          `,
        ),
      );
    }
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

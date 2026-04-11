import type { MetadataRoute } from "next";
import { productCatalog } from "@/src/infrastructure/container";
import { CATEGORIES } from "@/src/domain/catalog/Product";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gjej.al";

export const revalidate = 3600; // regenerate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await productCatalog.getAllProducts();

  const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/produkt/${p.id}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const categoryUrls: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${SITE_URL}/kategori/${c.id}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/kerko`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/rreth-nesh`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/si-funksionon`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/kontakt`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privatesia`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  ];

  return [...staticUrls, ...categoryUrls, ...productUrls];
}

// Infrastructure: file-based implementation of IPriceRepository

import { promises as fs } from "fs";
import path from "path";
import type { IPriceRepository } from "@/src/domain/pricing/IPriceRepository";
import type { ScrapedPrice, PriceRecord } from "@/src/domain/pricing/Price";
import { PRICES_FILE } from "./paths";

type PriceFile = Record<string, PriceRecord>;

export class FilePriceRepository implements IPriceRepository {
  private async readFile(): Promise<PriceFile> {
    try {
      return JSON.parse(await fs.readFile(PRICES_FILE, "utf-8")) as PriceFile;
    } catch {
      return {};
    }
  }

  async getByProductId(productId: string): Promise<PriceRecord | null> {
    const data = await this.readFile();
    return data[productId] ?? null;
  }

  async save(productId: string, prices: ScrapedPrice[]): Promise<void> {
    await fs.mkdir(path.dirname(PRICES_FILE), { recursive: true });
    const data = await this.readFile();
    data[productId] = { prices, refreshedAt: new Date().toISOString() };
    await fs.writeFile(PRICES_FILE, JSON.stringify(data, null, 2));
  }

  async saveAll(all: Record<string, ScrapedPrice[]>): Promise<void> {
    await fs.mkdir(path.dirname(PRICES_FILE), { recursive: true });
    const refreshedAt = new Date().toISOString();
    const data = await this.readFile();
    for (const [productId, prices] of Object.entries(all)) {
      data[productId] = { prices, refreshedAt };
    }
    await fs.writeFile(PRICES_FILE, JSON.stringify(data, null, 2));
  }
}

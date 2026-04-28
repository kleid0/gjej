// Generic JSON-file load/save with the snapshot-fallback semantics used by
// every cron-written data file. Reads prefer /tmp on Vercel and fall back
// to the committed data/ snapshot; writes always go to /tmp on Vercel.

import { promises as fs } from "fs";
import path from "path";
import { snapshotReadPath } from "./paths";

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(snapshotReadPath(file), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

/** Track which data files were mutated during the current cron invocation. */
const dirty = new Set<string>();

export function markDirty(file: string): void {
  dirty.add(file);
}

export function takeDirtyFiles(): string[] {
  const list = Array.from(dirty);
  dirty.clear();
  return list;
}

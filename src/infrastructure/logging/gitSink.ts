// Durable log sink: appends the in-memory log buffer to data/logs/events.ndjson
// and marks it dirty so the caller's commitDirtyFiles() persists it to GitHub
// inside the cron's existing chore(data): commit. No extra commit = no extra
// Vercel Hobby deploy.

import { promises as fs } from "fs";
import path from "path";
import { drainBuffer, formatEntry } from "./logger";
import { markDirty } from "@/src/infrastructure/persistence/JsonStore";
import { hydrateFromGitHub } from "@/src/infrastructure/git/commitDataFiles";
import { EVENTS_LOG_FILE } from "@/src/infrastructure/persistence/paths";

// Ring-buffer caps on the committed file. Newest lines win; older lines are
// dropped once either bound is hit. This is the safety valve that keeps
// "super chatty" logging from bloating the repo over time (Hobby-wary).
export const MAX_LOG_LINES = 5000;
export const MAX_LOG_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Apply both caps to a list of NDJSON lines, keeping the most recent. Always
 * keeps at least the newest line. Pure — unit-testable without the filesystem.
 */
export function capLines(lines: string[]): string[] {
  if (lines.length === 0) return lines;
  const byCount = lines.length > MAX_LOG_LINES ? lines.slice(-MAX_LOG_LINES) : lines;

  // Byte cap: walk from the newest line backwards until we'd exceed the limit.
  let bytes = 0;
  let start = byCount.length;
  for (let i = byCount.length - 1; i >= 0; i--) {
    bytes += Buffer.byteLength(byCount[i], "utf-8") + 1; // +1 for the newline
    if (bytes > MAX_LOG_BYTES) break;
    start = i;
  }
  // Guarantee the newest line survives even if it alone exceeds the byte cap.
  return byCount.slice(Math.min(start, byCount.length - 1));
}

async function readExistingLines(file: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return raw.split("\n").filter((l) => l.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Append the buffered log entries to data/logs/events.ndjson and mark it dirty
 * so the caller's commitDirtyFiles() picks it up. Hydrates the committed file
 * into /tmp first so entries accumulate across cron invocations — each runs in
 * its own (often cold) Vercel container with an empty /tmp.
 *
 * Returns the local file path when something was written, else null. Must be
 * called BEFORE takeDirtyFiles() / commitDirtyFiles().
 */
export async function flushLogsToGit(): Promise<string | null> {
  const entries = drainBuffer();
  if (entries.length === 0) return null;

  // Pull the current committed log into /tmp so we append rather than clobber.
  // No-op locally / when GITHUB_TOKEN is unset.
  await hydrateFromGitHub([EVENTS_LOG_FILE]);

  const existing = await readExistingLines(EVENTS_LOG_FILE);
  const merged = capLines([...existing, ...entries.map(formatEntry)]);

  await fs.mkdir(path.dirname(EVENTS_LOG_FILE), { recursive: true });
  await fs.writeFile(EVENTS_LOG_FILE, merged.join("\n") + "\n");
  markDirty(EVENTS_LOG_FILE);
  return EVENTS_LOG_FILE;
}

// Multi-file commit to GitHub via the Git Data API.
//
// The cron runs in Vercel where the filesystem is read-only outside /tmp,
// so price history, scraper errors, etc. are written to /tmp during a run
// and then persisted as a single commit on the repo's default branch.
// vercel.json's ignoreCommand skips deploys for chore(data): commits, so
// the bundled data/ snapshot only refreshes on real code deploys; reads
// fall back from /tmp to the bundle via paths.snapshotReadPath().
//
// Concurrency: each invocation in the refresh-prices self-chain calls this
// independently with its own slice of changes. We always rebase on the
// latest ref tip; if PATCH /git/refs returns 422 (someone else moved the
// branch), we refetch and retry up to MAX_RETRIES times.

import { promises as fs } from "fs";
import path from "path";

const GITHUB_API = "https://api.github.com";
const MAX_RETRIES = 4;

interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

function getRepoConfig(): RepoConfig | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  const vercelOwner = process.env.VERCEL_GIT_REPO_OWNER;
  const vercelSlug = process.env.VERCEL_GIT_REPO_SLUG;
  const slug =
    process.env.GITHUB_REPOSITORY ??
    (vercelOwner && vercelSlug ? `${vercelOwner}/${vercelSlug}` : null);
  if (!slug) return null;
  const [owner, repo] = slug.split("/");
  if (!owner || !repo) return null;
  const branch =
    process.env.GITHUB_DATA_BRANCH ??
    process.env.VERCEL_GIT_COMMIT_REF ??
    "main";
  return { owner, repo, branch, token };
}

async function gh(
  path: string,
  cfg: RepoConfig,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function getBranchTip(cfg: RepoConfig): Promise<{ commitSha: string; treeSha: string }> {
  const refRes = await gh(
    `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${cfg.branch}`,
    cfg,
  );
  if (!refRes.ok) {
    throw new Error(`get ref failed: ${refRes.status} ${await refRes.text()}`);
  }
  const ref = (await refRes.json()) as { object: { sha: string } };
  const commitSha = ref.object.sha;

  const commitRes = await gh(
    `/repos/${cfg.owner}/${cfg.repo}/git/commits/${commitSha}`,
    cfg,
  );
  if (!commitRes.ok) {
    throw new Error(`get commit failed: ${commitRes.status}`);
  }
  const commit = (await commitRes.json()) as { tree: { sha: string } };
  return { commitSha, treeSha: commit.tree.sha };
}

async function createBlob(content: string, cfg: RepoConfig): Promise<string> {
  const res = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/blobs`, cfg, {
    method: "POST",
    body: JSON.stringify({
      content: Buffer.from(content, "utf-8").toString("base64"),
      encoding: "base64",
    }),
  });
  if (!res.ok) throw new Error(`create blob failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { sha: string }).sha;
}

interface FileChange {
  /** Path relative to repo root, e.g. "data/price-history.json" */
  path: string;
  /** UTF-8 content to write. */
  content: string;
}

/**
 * Commit one or more file updates to the configured branch in a single
 * GitHub commit. No-op (returns null) if GITHUB_TOKEN / repository are
 * not configured — useful for local dev where files are written directly
 * to data/ on disk.
 *
 * Returns the new commit SHA on success.
 */
export async function commitDataFiles(
  files: FileChange[],
  message: string,
): Promise<string | null> {
  if (files.length === 0) return null;
  const cfg = getRepoConfig();
  if (!cfg) {
    console.warn(
      "[commitDataFiles] GITHUB_TOKEN or repo slug not configured; skipping commit.",
    );
    return null;
  }

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const tip = await getBranchTip(cfg);

      // Create one blob per file in parallel.
      const blobShas = await Promise.all(
        files.map((f) => createBlob(f.content, cfg)),
      );

      const treeRes = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/trees`, cfg, {
        method: "POST",
        body: JSON.stringify({
          base_tree: tip.treeSha,
          tree: files.map((f, i) => ({
            path: f.path,
            mode: "100644",
            type: "blob",
            sha: blobShas[i],
          })),
        }),
      });
      if (!treeRes.ok) {
        throw new Error(`create tree failed: ${treeRes.status} ${await treeRes.text()}`);
      }
      const tree = (await treeRes.json()) as { sha: string };

      const commitRes = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/commits`, cfg, {
        method: "POST",
        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: [tip.commitSha],
        }),
      });
      if (!commitRes.ok) {
        throw new Error(`create commit failed: ${commitRes.status} ${await commitRes.text()}`);
      }
      const commit = (await commitRes.json()) as { sha: string };

      const updateRes = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${cfg.branch}`,
        cfg,
        {
          method: "PATCH",
          body: JSON.stringify({ sha: commit.sha, force: false }),
        },
      );
      if (updateRes.status === 422) {
        // Someone else moved the branch — refetch tip and retry.
        lastErr = new Error("ref moved; retrying");
        continue;
      }
      if (!updateRes.ok) {
        throw new Error(`update ref failed: ${updateRes.status} ${await updateRes.text()}`);
      }
      return commit.sha;
    } catch (err) {
      lastErr = err;
      // Network blips: short backoff and retry.
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error("commitDataFiles: exhausted retries");
}

/**
 * Hydrate /tmp from the committed branch tip so subsequent reads see the
 * latest cron output. Vercel deploys eventually serve the new files in the
 * bundle, but until the deploy lands the cron self-chain reads from /tmp.
 *
 * No-op when GITHUB_TOKEN is missing — local dev reads data/ directly.
 */
export async function hydrateFromGitHub(localPaths: string[]): Promise<void> {
  const cfg = getRepoConfig();
  if (!cfg) return;
  await Promise.all(
    localPaths.map(async (localPath) => {
      const repoPath = repoRelativePath(localPath);
      if (!repoPath) return;
      try {
        const url = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${repoPath}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${cfg.token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = await res.text();
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, body);
      } catch {
        // Non-fatal: snapshot fallback in JsonStore handles missing files.
      }
    }),
  );
}

function repoRelativePath(localPath: string): string | null {
  const idx = localPath.indexOf("/data/");
  if (idx < 0) {
    if (localPath.startsWith("/tmp/")) return `data/${localPath.slice("/tmp/".length)}`;
    return null;
  }
  return localPath.slice(idx + 1); // ".../data/foo.json" → "data/foo.json"
}

/**
 * Read the dirty-tracked files from disk and commit them in one GitHub
 * commit. Convenience wrapper used at the end of cron invocations.
 *
 * Returns null when there's nothing to commit or GitHub isn't configured;
 * returns the new commit SHA on success.
 */
export async function commitDirtyFiles(
  localPaths: string[],
  message: string,
): Promise<string | null> {
  if (localPaths.length === 0) return null;
  const changes: FileChange[] = [];
  for (const localPath of localPaths) {
    const repoPath = repoRelativePath(localPath);
    if (!repoPath) continue;
    let content: string;
    try {
      content = await fs.readFile(localPath, "utf-8");
    } catch {
      continue;
    }
    changes.push({ path: repoPath, content });
  }
  return commitDataFiles(changes, message);
}

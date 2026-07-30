// Cache for cited page text.
//
// Most cited sources are regulations, FAQs and guidance that change on the
// order of months. Re-fetching them on every question was wasteful and, worse,
// fragile: a shared retrieval deadline meant one unreachable host could abort
// requests to healthy ones, so a source that answers in 30ms would be reported
// as unavailable because a different host had hung.
//
// With a cache, a source that was read recently is not fetched at all, so the
// deadline rarely applies and a slow host can no longer take others down with
// it. Freshness is stated rather than assumed: served text always carries the
// time it was captured.

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CACHE_DIR = join(ROOT, "data", "runtime", "page-cache");
const MAX_ENTRIES = 300;

const key = (url) => createHash("sha1").update(String(url)).digest("hex");

export async function readCachedPage(url) {
  try {
    const entry = JSON.parse(await readFile(join(CACHE_DIR, `${key(url)}.json`), "utf8"));
    if (!entry?.text || entry.url !== String(url)) return null;
    const ageMs = Date.now() - Date.parse(entry.capturedAt);
    return { ...entry, ageMs: Number.isFinite(ageMs) ? ageMs : Infinity };
  } catch { return null; }
}

export async function writeCachedPage(url, text, etag = null) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const path = join(CACHE_DIR, `${key(url)}.json`);
    const temp = `${path}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify({ url: String(url), text, etag, capturedAt: new Date().toISOString() }));
    await rename(temp, path);
    await prune();
  } catch { /* the cache is an optimisation; failing to write it is not fatal */ }
}

// Bounded so a long-running prototype cannot fill the disk. Oldest first.
async function prune() {
  try {
    const files = await readdir(CACHE_DIR);
    if (files.length <= MAX_ENTRIES) return;
    const stamped = await Promise.all(files
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => ({ name, mtime: (await stat(join(CACHE_DIR, name))).mtimeMs })));
    stamped.sort((left, right) => left.mtime - right.mtime);
    for (const item of stamped.slice(0, stamped.length - MAX_ENTRIES)) {
      await unlink(join(CACHE_DIR, item.name)).catch(() => {});
    }
  } catch { /* pruning is housekeeping, not correctness */ }
}

export function describeAge(ageMs) {
  if (!Number.isFinite(ageMs)) return null;
  const hours = ageMs / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ageMs / 60_000))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

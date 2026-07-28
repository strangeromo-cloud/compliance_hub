import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RUNTIME_DIR = join(ROOT, "data", "runtime");
const FALLBACK_DIR = join(ROOT, "data", "fallback");
const STATUS_PATH = join(RUNTIME_DIR, "sync-status.json");
let statusWriteQueue = Promise.resolve();

async function ensureRuntime() {
  await mkdir(join(RUNTIME_DIR, "raw"), { recursive: true });
  await mkdir(join(RUNTIME_DIR, "normalized"), { recursive: true });
}

async function atomicWrite(path, contents) {
  const tempPath = `${path}.${process.pid}.tmp`;
  await writeFile(tempPath, contents);
  await rename(tempPath, path);
}

export async function readSyncStatus() {
  try { return JSON.parse(await readFile(STATUS_PATH, "utf8")); }
  catch { return {}; }
}

export async function updateSyncStatus(sourceId, status) {
  const operation = statusWriteQueue.catch(() => {}).then(async () => {
    await ensureRuntime();
    const all = await readSyncStatus();
    all[sourceId] = { ...(all[sourceId] || {}), ...status };
    await atomicWrite(STATUS_PATH, JSON.stringify(all, null, 2));
    return all[sourceId];
  });
  statusWriteQueue = operation;
  return operation;
}

export async function saveSourceData({ sourceId, extension, bytes, records, metadata = {} }) {
  await ensureRuntime();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rawDir = join(RUNTIME_DIR, "raw", sourceId);
  await mkdir(rawDir, { recursive: true });
  const rawPath = join(rawDir, `${stamp}.${extension}`);
  const normalizedPath = join(RUNTIME_DIR, "normalized", `${sourceId}.json`);
  await atomicWrite(rawPath, bytes);
  await atomicWrite(normalizedPath, JSON.stringify({ sourceId, capturedAt: new Date().toISOString(), metadata, records }, null, 2));
  return {
    snapshotPath: relative(ROOT, rawPath),
    normalizedPath: relative(ROOT, normalizedPath),
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length
  };
}

// A live snapshot always wins. The bundled copy exists only so a host that
// cannot reach the official source still has something to screen against —
// notably PRC sources, which are not reliably reachable from every region.
// It is returned tagged, never silently, because presenting a point-in-time
// list copy as the current list is the worst failure this tool could have.
export async function readNormalized(sourceId) {
  const livePath = join(RUNTIME_DIR, "normalized", `${sourceId}.json`);
  try { return { ...JSON.parse(await readFile(livePath, "utf8")), provenance: "live_sync" }; }
  catch { /* fall through to the bundled copy */ }

  const fallbackPath = join(FALLBACK_DIR, `${sourceId}.json`);
  try {
    const snapshot = JSON.parse(await readFile(fallbackPath, "utf8"));
    return { ...snapshot, provenance: "bundled_fallback_snapshot", isFallback: true };
  } catch { return null; }
}

export async function readFallbackMeta(sourceId) {
  try {
    const snapshot = JSON.parse(await readFile(join(FALLBACK_DIR, `${sourceId}.json`), "utf8"));
    return { available: true, bundledAt: snapshot.bundledAt || snapshot.capturedAt || null, recordCount: snapshot.records?.length || 0 };
  } catch { return { available: false }; }
}

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RUNTIME_DIR = join(ROOT, "data", "runtime");
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

export async function readNormalized(sourceId) {
  const path = join(RUNTIME_DIR, "normalized", `${sourceId}.json`);
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return null; }
}

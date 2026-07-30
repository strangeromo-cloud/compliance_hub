import { DATA_SOURCE_REGISTRY, dataSourceCoverage } from "../data-source-registry.js";
import { ADAPTERS, queryRemoteSource } from "./adapters.js";
import { readFallbackMeta, readNormalized, readSyncStatus, saveSourceData, updateSyncStatus } from "./storage.js";

const activeSyncs = new Map();

// Citation pages on hosts a deployment cannot reach still have their text in
// the ingested corpus. Indexing by URL lets a failed live fetch fall back to
// what was already captured, rather than showing an empty citation.
const ARCHIVE_SOURCES = ["china-dual-use", "china-licence-catalogue", "china-control-entities", "china-unreliable-entity"];
let archiveIndex = null;

async function buildArchiveIndex() {
  const index = new Map();
  for (const sourceId of ARCHIVE_SOURCES) {
    const snapshot = await readNormalized(sourceId);
    for (const record of snapshot?.records || []) {
      if (!record.sourceUrl || !record.contentText || index.has(record.sourceUrl)) continue;
      index.set(record.sourceUrl, {
        text: record.contentText,
        capturedAt: snapshot.capturedAt,
        provenance: snapshot.provenance || "live_sync",
        noticeNumber: record.noticeNumber || null
      });
    }
  }
  return index;
}

export async function findArchivedDocument(url) {
  if (!archiveIndex) archiveIndex = buildArchiveIndex();
  return (await archiveIndex).get(String(url)) || null;
}

// Node wraps every transport failure as a bare "fetch failed"; the actionable
// detail (ETIMEDOUT vs ENOTFOUND vs a TLS error) only lives on error.cause.
// Without walking the chain a network-level failure is undiagnosable in a
// hosted deployment, where there is no shell to retry the request from.
function errorChain(error, depth = 0) {
  if (!error || depth > 3) return [];
  const parts = [error.code, error.syscall, error.hostname, error.address, error.message].filter(Boolean);
  // A failed connection surfaces as an AggregateError with one entry per address
  // family tried; its own message is empty, so the detail is only in .errors.
  const nested = error.cause ? [error.cause] : Array.isArray(error.errors) ? error.errors.slice(0, 2) : [];
  return [[...new Set(parts)].join(" ")].concat(...nested.map((item) => errorChain(item, depth + 1)));
}

function safeError(error) {
  const message = error?.name === "AbortError"
    ? "Source request timed out."
    : errorChain(error).filter(Boolean).join(" <- ") || "Unknown sync error";
  return message.replace(/api_key=[^&\s]+/gi, "api_key=[redacted]").slice(0, 500);
}

export async function getDataSourceCoverage() {
  const statuses = await readSyncStatus();
  const fallbacks = Object.fromEntries(await Promise.all(
    DATA_SOURCE_REGISTRY.map(async (source) => [source.sourceId, await readFallbackMeta(source.sourceId)])
  ));
  const sources = DATA_SOURCE_REGISTRY.map((source) => {
    const adapter = ADAPTERS[source.sourceId];
    const sync = statuses[source.sourceId] || null;
    const credentialConfigured = !adapter?.credential || Boolean(process.env[adapter.credential]);
    const hasSnapshot = sync?.status === "success";
    const fallback = fallbacks[source.sourceId] || { available: false };
    const snapshotIsSample = hasSnapshot && String(sync.syncScope || "").startsWith("sample_");
    return {
      ...source,
      currentCoverage: hasSnapshot ? (snapshotIsSample ? "sample_snapshot" : "structured_snapshot") : source.currentCoverage,
      dataCaptured: hasSnapshot ? [
        "official raw snapshot",
        `${Number(sync.recordCount || 0).toLocaleString("en-US")} normalized records`,
        "source version and retrieval time",
        "SHA-256 content checksum",
        ...(snapshotIsSample ? ["sample only; use live query for case lookup"] : [])
      ] : source.dataCaptured,
      adapter: adapter ? { implemented: true, syncable: Boolean(adapter.sync), queryable: adapter.mode === "live_query" || source.sourceId === "gleif-lei", mode: adapter.mode, credential: adapter.credential, credentialConfigured } : { implemented: false, syncable: false, queryable: false, mode: null, credential: null, credentialConfigured: true },
      fallback,
      // A bundled fallback is reported as its own state, never as "success".
      // Rolling it into success would present a point-in-time list copy as the
      // current list, which is the one mistake this tool must not make.
      sync: hasSnapshot
        ? sync
        : fallback.available
          ? { ...(sync || {}), status: "fallback_snapshot", recordCount: fallback.recordCount, bundledAt: fallback.bundledAt, liveSyncError: sync?.error || null }
          : sync || { status: adapter?.credential && !credentialConfigured ? "configuration_required" : "not_synced" }
    };
  });
  return { ...dataSourceCoverage(), sources, syncCounts: sources.reduce((counts, source) => { counts[source.sync.status] = (counts[source.sync.status] || 0) + 1; return counts; }, {}) };
}

async function executeSync(sourceId) {
  const adapter = ADAPTERS[sourceId];
  if (!adapter?.sync) throw Object.assign(new Error("This source has no snapshot sync adapter."), { status: 400 });
  const startedAt = new Date().toISOString();
  await updateSyncStatus(sourceId, { status: "syncing", startedAt, error: null });
  try {
    const result = await adapter.sync();
    const saved = await saveSourceData({ sourceId, extension: result.extension, bytes: result.file.bytes, records: result.records, metadata: { sourceUpdatedAt: result.sourceUpdatedAt, finalUrl: result.file.finalUrl, etag: result.file.etag, syncScope: result.syncScope } });
    archiveIndex = null;
    return await updateSyncStatus(sourceId, { status: "success", startedAt, completedAt: new Date().toISOString(), recordCount: result.records.length, sourceUpdatedAt: result.sourceUpdatedAt, syncScope: result.syncScope, ...saved, error: null });
  } catch (error) {
    await updateSyncStatus(sourceId, { status: "failed", startedAt, completedAt: new Date().toISOString(), error: safeError(error) });
    throw error;
  }
}

export function syncSource(sourceId) {
  if (!DATA_SOURCE_REGISTRY.some((source) => source.sourceId === sourceId)) throw Object.assign(new Error("Unknown data source."), { status: 404 });
  if (activeSyncs.has(sourceId)) return activeSyncs.get(sourceId);
  const promise = executeSync(sourceId).finally(() => activeSyncs.delete(sourceId));
  activeSyncs.set(sourceId, promise);
  return promise;
}

// Long regulation and notice text is useless as a whole field in a result list,
// so the matching passage is extracted with enough context to read. The offsets
// are relative to the field, not the record, because a caller renders per field.
function matchSnippets(record, needle, max = 2) {
  const snippets = [];
  for (const field of ["contentText", "content", "excerpt", "notes"]) {
    const text = record[field];
    if (typeof text !== "string" || text.length < 80) continue;
    const lower = text.toLocaleLowerCase();
    let from = 0;
    while (snippets.length < max) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      const start = Math.max(0, at - 90);
      const end = Math.min(text.length, at + needle.length + 130);
      snippets.push({
        field,
        text: `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`,
        matchAt: at - start + (start > 0 ? 1 : 0),
        matchLength: needle.length
      });
      from = at + needle.length;
    }
  }
  return snippets;
}

export async function queryDataSource(sourceId, query, limit = 20) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery || cleanQuery.length > 200) throw Object.assign(new Error("A query of 1-200 characters is required."), { status: 400 });
  const adapter = ADAPTERS[sourceId];
  if (adapter?.mode === "live_query" || sourceId === "gleif-lei") return { sourceId, mode: "live", records: await queryRemoteSource(sourceId, cleanQuery) };
  const normalized = await readNormalized(sourceId);
  if (!normalized) throw Object.assign(new Error("This source has not been synchronized yet."), { status: 409 });
  const needle = cleanQuery.toLocaleLowerCase();
  const hits = normalized.records.filter((record) => JSON.stringify(record).toLocaleLowerCase().includes(needle));
  const records = hits.slice(0, Math.min(100, Math.max(1, Number(limit) || 20)))
    .map((record) => ({ ...record, matchSnippets: matchSnippets(record, needle) }));
  return {
    sourceId,
    totalMatches: hits.length,
    mode: normalized.isFallback ? "bundled_fallback_snapshot" : "local_snapshot",
    provenance: normalized.provenance,
    capturedAt: normalized.capturedAt,
    ...(normalized.isFallback ? { bundledAt: normalized.bundledAt, fallbackNotice: "Results come from a committed point-in-time copy because the official source was not synchronized on this host. Re-sync before relying on them." } : {}),
    records
  };
}

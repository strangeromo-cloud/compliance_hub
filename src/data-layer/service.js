import { DATA_SOURCE_REGISTRY, dataSourceCoverage } from "../data-source-registry.js";
import { ADAPTERS, queryRemoteSource } from "./adapters.js";
import { readNormalized, readSyncStatus, saveSourceData, updateSyncStatus } from "./storage.js";

const activeSyncs = new Map();

function safeError(error) {
  const message = error?.name === "AbortError" ? "Source request timed out." : String(error?.message || "Unknown sync error");
  return message.replace(/api_key=[^&\s]+/gi, "api_key=[redacted]").slice(0, 500);
}

export async function getDataSourceCoverage() {
  const statuses = await readSyncStatus();
  const sources = DATA_SOURCE_REGISTRY.map((source) => {
    const adapter = ADAPTERS[source.sourceId];
    const sync = statuses[source.sourceId] || null;
    const credentialConfigured = !adapter?.credential || Boolean(process.env[adapter.credential]);
    const hasSnapshot = sync?.status === "success";
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
      sync: sync || { status: adapter?.credential && !credentialConfigured ? "configuration_required" : "not_synced" }
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

export async function queryDataSource(sourceId, query, limit = 20) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery || cleanQuery.length > 200) throw Object.assign(new Error("A query of 1-200 characters is required."), { status: 400 });
  const adapter = ADAPTERS[sourceId];
  if (adapter?.mode === "live_query" || sourceId === "gleif-lei") return { sourceId, mode: "live", records: await queryRemoteSource(sourceId, cleanQuery) };
  const normalized = await readNormalized(sourceId);
  if (!normalized) throw Object.assign(new Error("This source has not been synchronized yet."), { status: 409 });
  const needle = cleanQuery.toLocaleLowerCase();
  const records = normalized.records.filter((record) => JSON.stringify(record).toLocaleLowerCase().includes(needle)).slice(0, Math.min(100, Math.max(1, Number(limit) || 20)));
  return { sourceId, mode: "local_snapshot", capturedAt: normalized.capturedAt, records };
}

import { DATA_SOURCE_REGISTRY, dataSourceCoverage } from "../data-source-registry.js";
import { SOURCE_PURPOSE } from "../source-purpose.js";
import { ADAPTERS, queryRemoteSource } from "./adapters.js";
import { readFallbackMeta, readNormalized, readRecordsPage, readSnapshotMeta, readSyncStatus, saveSourceData, updateSyncStatus } from "./storage.js";

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
    const hasSnapshot = sync?.status === "success" || sync?.status === "refresh_failed";
    const fallback = fallbacks[source.sourceId] || { available: false };
    const snapshotIsSample = hasSnapshot && String(sync.syncScope || "").startsWith("sample_");
    // What the source is for, and which steps read it. `notes` answers "how do we
    // get it"; a compliance reader looking at thirty-four cards needs "what is it
    // for", and needs to see when the answer is "nothing reads it yet".
    const purpose = SOURCE_PURPOSE[source.sourceId] || null;
    return {
      ...source,
      purpose: purpose ? {
        zh: purpose.zh, en: purpose.en, usedIn: purpose.usedIn,
        optionalApi: purpose.optionalApi
          ? { ...purpose.optionalApi, configured: Boolean(process.env[purpose.optionalApi.credential]) }
          : null
      } : null,
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
    // A refresh that fails on top of a snapshot that succeeded is not the same as
    // having no data. Reporting it as "failed" hid 203 real Country Chart rows
    // behind a rate-limit error and read as if the source were unavailable. The
    // snapshot keeps its own capture time, so nothing here presents stale data as
    // current — the refresh failure is stated alongside it.
    const previous = (await readSyncStatus())[sourceId];
    const keepsSnapshot = previous?.status === "success" || previous?.status === "refresh_failed";
    await updateSyncStatus(sourceId, keepsSnapshot
      ? { status: "refresh_failed", refreshStartedAt: startedAt, refreshFailedAt: new Date().toISOString(), error: safeError(error) }
      : { status: "failed", startedAt, completedAt: new Date().toISOString(), error: safeError(error) });
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

// Queries are typed by people, not composed as boolean expressions. "3A090 服务器"
// or "华为 深圳" should rank the records that hit both terms above the ones that
// hit one — a substring match over the joined JSON instead returned nothing at
// all unless some field happened to contain the whole string verbatim.
const HAN = /\p{Script=Han}/u;

// Chinese has no spaces, so a run of Han characters is indexed as overlapping
// bigrams: "两用物项" becomes 两用/用物/物项, which is what makes a partial phrase
// match at all.
export function tokenizeQuery(query) {
  const terms = [];
  for (const chunk of String(query).toLocaleLowerCase().match(/\p{Script=Han}+|[\p{L}\p{N}][\p{L}\p{N}.\-/]*/gu) || []) {
    if (HAN.test(chunk)) {
      if (chunk.length < 2) terms.push(chunk);
      else for (let at = 0; at + 2 <= chunk.length; at += 1) terms.push(chunk.slice(at, at + 2));
    } else if (chunk.length >= 2 || /\d/.test(chunk)) {
      terms.push(chunk);
    }
  }
  return [...new Set(terms)].slice(0, 24);
}

// An identifier hit means far more than the same word inside a paragraph, so the
// field decides the weight. Every other field is still searched, at weight 1 —
// a fixed field list would silently make whatever it omits unfindable, and each
// source names its fields differently.
const FIELD_WEIGHTS = {
  eccn: 6, entityName: 5, entityNameEn: 5, noticeNumber: 4, title: 4, noticeTitle: 4,
  recordId: 3, aliases: 3, sourceList: 2, country: 2, countries: 2, supplement: 2,
  restrictionType: 2, licenceRequiredFor: 2, addresses: 2, measureType: 2
};

// Fields that would match on every record of a source, or that hold no prose:
// the source id repeats the name being searched, the URL repeats the country, and
// the raw record is snapshot bookkeeping.
const UNSEARCHED = new Set(["sourceId", "sourceUrl", "rawRecord", "matchSnippets", "relevance", "humanReviewRequired", "parserConfidence", "matchDisposition", "columnAlignment", "snapshotRecordIndex"]);

function searchableText(value) {
  if (value === null || value === undefined || typeof value === "boolean") return "";
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (typeof value === "object") return Object.values(value).map(searchableText).join(" ");
  return String(value);
}

function scoreRecord(record, terms, phrase) {
  const matched = new Set();
  let score = 0;
  for (const [field, value] of Object.entries(record)) {
    if (UNSEARCHED.has(field)) continue;
    const weight = FIELD_WEIGHTS[field] || 1;
    const text = searchableText(value);
    if (!text) continue;
    const lower = text.toLocaleLowerCase();
    // The whole query appearing verbatim is the strongest signal there is.
    if (phrase && lower.includes(phrase)) score += weight * 4;
    for (const term of terms) {
      if (!lower.includes(term)) continue;
      matched.add(term);
      score += weight + (lower.startsWith(term) ? weight / 2 : 0);
    }
  }
  // Coverage has to dominate the field weight, or one hit in a title ties three
  // hits in a body and the ranking stops meaning "answers more of the question".
  // A full match scores 3.3x a single-term match at equal field weight.
  const coverage = matched.size / terms.length;
  return { score: score && score * (0.25 + coverage * 1.75), matched: [...matched] };
}

// Long regulation and notice text is useless as a whole field in a result list,
// so the matching passage is extracted with enough context to read. The offsets
// are relative to the field, not the record, because a caller renders per field.
function matchSnippets(record, needles, max = 2) {
  const snippets = [];
  for (const field of ["contentText", "content", "excerpt", "notes"]) {
    const text = record[field];
    if (typeof text !== "string" || text.length < 80) continue;
    const lower = text.toLocaleLowerCase();
    // The longest matching term first, so the snippet lands on the most specific
    // part of the query rather than on whichever word came first.
    for (const needle of [...needles].sort((left, right) => right.length - left.length)) {
      if (snippets.length >= max) break;
      const at = lower.indexOf(needle);
      if (at < 0) continue;
      const start = Math.max(0, at - 90);
      const end = Math.min(text.length, at + needle.length + 130);
      snippets.push({
        field, term: needle,
        text: `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`,
        matchAt: at - start + (start > 0 ? 1 : 0),
        matchLength: needle.length
      });
    }
  }
  return snippets;
}

export async function queryDataSource(sourceId, query, limit = 20, offset = 0) {
  const cleanQuery = String(query || "").trim();
  if (cleanQuery.length > 200) throw Object.assign(new Error("A query of at most 200 characters is required."), { status: 400 });
  const size = Math.min(100, Math.max(1, Number(limit) || 20));
  const from = Math.max(0, Math.min(100_000, Number(offset) || 0));

  const adapter = ADAPTERS[sourceId];
  if (adapter?.mode === "live_query" || sourceId === "gleif-lei") {
    // A remote API answers a query; there is no local corpus to page through.
    if (!cleanQuery) throw Object.assign(new Error("This source answers live queries, so it needs search terms."), { status: 400, code: "query_required" });
    return { sourceId, mode: "live", records: await queryRemoteSource(sourceId, cleanQuery) };
  }

  // Browsing a synced source is answered from the index rather than by reading
  // it: eleven thousand rows should not have to be materialised to show twenty.
  // A search still scans, and a bundled fallback still comes from its file.
  if (!cleanQuery) {
    const meta = await readSnapshotMeta(sourceId);
    if (meta) {
      return {
        sourceId, mode: "local_snapshot", provenance: "live_sync", capturedAt: meta.capturedAt, kind: "browse",
        totalRecords: meta.recordCount, offset: from, limit: size,
        records: await readRecordsPage(sourceId, from, size)
      };
    }
  }

  const normalized = await readNormalized(sourceId);
  if (!normalized) throw Object.assign(new Error("This source has not been synchronized yet."), { status: 409 });
  const provenance = {
    mode: normalized.isFallback ? "bundled_fallback_snapshot" : "local_snapshot",
    provenance: normalized.provenance,
    capturedAt: normalized.capturedAt,
    ...(normalized.isFallback ? { bundledAt: normalized.bundledAt, fallbackNotice: "Results come from a committed point-in-time copy because the official source was not synchronized on this host. Re-sync before relying on them." } : {})
  };

  // No terms means "show me what is in here". A source is easier to trust when
  // its whole content can be paged through, not only sampled by guessing words.
  if (!cleanQuery) {
    return {
      sourceId, ...provenance, kind: "browse",
      totalRecords: normalized.records.length, offset: from, limit: size,
      records: normalized.records.slice(from, from + size)
    };
  }

  const terms = tokenizeQuery(cleanQuery);
  const phrase = cleanQuery.toLocaleLowerCase();
  const scored = [];
  for (const record of normalized.records) {
    const { score, matched } = scoreRecord(record, terms, phrase);
    if (score > 0) scored.push({ record, score, matched });
  }
  scored.sort((left, right) => right.score - left.score);
  // With Han bigrams a generic query touches nearly every record, so "206 of 206
  // matched" tells the reader nothing. Records answering at least half the query
  // are the result set; the rest are counted, not hidden, so a query that only
  // ever matches weakly still returns its best effort rather than nothing.
  const strong = scored.filter((hit) => hit.matched.length / terms.length >= 0.5);
  const pool = strong.length ? strong : scored;
  const page = pool.slice(from, from + size);
  return {
    sourceId, ...provenance, kind: "search",
    totalMatches: pool.length, partialMatchesExcluded: pool.length === scored.length ? 0 : scored.length - pool.length,
    totalRecords: normalized.records.length,
    offset: from, limit: size, terms,
    records: page.map(({ record, score, matched }) => ({
      ...record,
      // Reported so a result can be read as "why this one": which parts of the
      // query it answered, and which it did not.
      relevance: { score: Math.round(score * 10) / 10, matchedTerms: matched, missedTerms: terms.filter((term) => !matched.includes(term)) },
      matchSnippets: matchSnippets(record, matched)
    }))
  };
}

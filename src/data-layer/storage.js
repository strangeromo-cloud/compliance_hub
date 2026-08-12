// Synced source data, read and written through the database.
//
// The exported shape is unchanged from when this wrote JSON files, so grounding
// and the data-layer service did not have to learn anything about storage. What
// changed underneath: a source's records are rows rather than one document, so
// paging through a list no longer means parsing eight megabytes to show twenty
// rows, and a sync replaces one source's rows inside a transaction instead of
// rewriting a file that another read might be halfway through.

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, fromJson, toJson, transact } from "./db.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FALLBACK_DIR = join(ROOT, "data", "fallback");

export async function readSyncStatus() {
  const rows = db().prepare("SELECT source_id, state FROM sync_status").all();
  return Object.fromEntries(rows.map((row) => [row.source_id, fromJson(row.state, {})]));
}

export async function updateSyncStatus(sourceId, status) {
  return transact((database) => {
    const row = database.prepare("SELECT state FROM sync_status WHERE source_id = ?").get(sourceId);
    const merged = { ...fromJson(row?.state, {}), ...status };
    database.prepare("INSERT INTO sync_status (source_id, state) VALUES (?, ?) ON CONFLICT (source_id) DO UPDATE SET state = excluded.state")
      .run(sourceId, toJson(merged));
    return merged;
  });
}

export async function saveSourceData({ sourceId, extension, bytes, records, metadata = {} }) {
  const capturedAt = new Date().toISOString();
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const list = records || [];

  transact((database) => {
    // Replacing a source's rows inside the transaction is what makes a failed
    // sync leave the previous snapshot intact rather than half of a new one.
    database.prepare("DELETE FROM records WHERE source_id = ?").run(sourceId);
    const insert = database.prepare("INSERT INTO records (source_id, ordinal, record_id, payload) VALUES (?, ?, ?, ?)");
    list.forEach((record, ordinal) => {
      insert.run(sourceId, ordinal, record?.recordId == null ? null : String(record.recordId), toJson(record));
    });
    database.prepare(`
      INSERT INTO snapshots (source_id, captured_at, metadata, record_count, checksum_sha256, raw_extension, raw_bytes, raw_byte_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (source_id) DO UPDATE SET
        captured_at = excluded.captured_at, metadata = excluded.metadata, record_count = excluded.record_count,
        checksum_sha256 = excluded.checksum_sha256, raw_extension = excluded.raw_extension,
        raw_bytes = excluded.raw_bytes, raw_byte_count = excluded.raw_byte_count`)
      .run(sourceId, capturedAt, toJson(metadata), list.length, checksum, extension || null, bytes, bytes.length);
    // Only the current snapshot keeps its bytes. The log keeps every capture's
    // checksum, which is what tells you whether a list actually changed — and
    // it does so without the raw directory growing without limit, which is what
    // the file store did.
    database.prepare("INSERT INTO snapshot_log (source_id, captured_at, checksum_sha256, record_count, raw_byte_count) VALUES (?, ?, ?, ?, ?)")
      .run(sourceId, capturedAt, checksum, list.length, bytes.length);
  });

  return {
    snapshotPath: `hub.db:snapshots/${sourceId}`,
    normalizedPath: `hub.db:records/${sourceId}`,
    checksumSha256: checksum,
    bytes: bytes.length
  };
}

// A live snapshot always wins. The bundled copy exists only so a host that
// cannot reach the official source still has something to screen against —
// notably PRC sources, which are not reliably reachable from every region.
// It is returned tagged, never silently, because presenting a point-in-time
// list copy as the current list is the worst failure this tool could have.
export async function readNormalized(sourceId) {
  const snapshot = db().prepare("SELECT captured_at, metadata, record_count FROM snapshots WHERE source_id = ?").get(sourceId);
  if (snapshot) {
    const rows = db().prepare("SELECT payload FROM records WHERE source_id = ? ORDER BY ordinal").all(sourceId);
    return {
      sourceId,
      capturedAt: snapshot.captured_at,
      metadata: fromJson(snapshot.metadata, {}),
      records: rows.map((row) => fromJson(row.payload, null)).filter(Boolean),
      provenance: "live_sync"
    };
  }

  const bundled = await readBundled(sourceId);
  return bundled ? { ...bundled, provenance: "bundled_fallback_snapshot", isFallback: true } : null;
}

// Plain or gzipped, whichever is on disk.
//
// A sanctions list is tens of thousands of records and compresses to about a
// tenth: OFAC's SLS is 14.4 MB of JSON and 1.5 MB gzipped. Committing the plain
// form would have put 20 MB into a repository whose whole history is 32, and
// again on every refresh. Compressing loses nothing — the alternative on the
// table was dropping fields to make it fit, which would have made the copy a
// different thing from the sync it stands in for, and that is the one property
// a fallback has to keep.
async function readBundled(sourceId) {
  try {
    return JSON.parse(gunzipSync(await readFile(join(FALLBACK_DIR, `${sourceId}.json.gz`))).toString("utf8"));
  } catch { /* fall through to the plain form */ }
  try {
    return JSON.parse(await readFile(join(FALLBACK_DIR, `${sourceId}.json`), "utf8"));
  } catch { return null; }
}

// What a snapshot is, without materialising it. Browsing a source and deciding
// whether it needs re-syncing both only need this much.
export async function readSnapshotMeta(sourceId) {
  const row = db().prepare("SELECT captured_at, metadata, record_count, checksum_sha256, raw_byte_count FROM snapshots WHERE source_id = ?").get(sourceId);
  if (!row) return null;
  return {
    sourceId,
    capturedAt: row.captured_at,
    metadata: fromJson(row.metadata, {}),
    recordCount: row.record_count,
    checksumSha256: row.checksum_sha256,
    rawByteCount: row.raw_byte_count
  };
}

// The point of a database, made use of: twenty rows out of eleven thousand cost
// twenty rows of work.
export async function readRecordsPage(sourceId, offset = 0, limit = 20) {
  const rows = db().prepare("SELECT payload FROM records WHERE source_id = ? ORDER BY ordinal LIMIT ? OFFSET ?")
    .all(sourceId, Number(limit) || 20, Number(offset) || 0);
  return rows.map((row) => fromJson(row.payload, null)).filter(Boolean);
}

export async function readSnapshotHistory(sourceId, limit = 10) {
  return db().prepare("SELECT captured_at, checksum_sha256, record_count, raw_byte_count FROM snapshot_log WHERE source_id = ? ORDER BY captured_at DESC LIMIT ?")
    .all(sourceId, Number(limit) || 10)
    .map((row) => ({ capturedAt: row.captured_at, checksumSha256: row.checksum_sha256, recordCount: row.record_count, rawByteCount: row.raw_byte_count }));
}

// The bytes that were actually downloaded, kept so a parse can be checked
// against its input rather than trusted.
export async function readRawSnapshot(sourceId) {
  const row = db().prepare("SELECT raw_extension, raw_bytes, checksum_sha256, captured_at FROM snapshots WHERE source_id = ?").get(sourceId);
  if (!row?.raw_bytes) return null;
  return {
    bytes: Buffer.from(row.raw_bytes),
    extension: row.raw_extension,
    checksumSha256: row.checksum_sha256,
    capturedAt: row.captured_at
  };
}

export async function readFallbackMeta(sourceId) {
  const snapshot = await readBundled(sourceId);
  if (!snapshot) return { available: false };
  return { available: true, bundledAt: snapshot.bundledAt || snapshot.capturedAt || null, recordCount: snapshot.records?.length || 0 };
}

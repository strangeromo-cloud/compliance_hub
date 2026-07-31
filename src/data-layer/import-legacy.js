// Carrying the JSON store into the database, once.
//
// A deployment that has been running has real data in it: synced snapshots that
// took minutes to fetch, and case history that cannot be re-created at all.
// Switching stores without moving that would have thrown it away and looked,
// from the outside, exactly like the redeploy that prompted this work.
//
// It runs only against an empty database, so it cannot overwrite anything, and
// it leaves the old files in place. Nothing here deletes; whoever is satisfied
// the move worked can remove data/runtime/normalized, raw and cases themselves.

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { db, toJson, transact } from "./db.js";
import { RUNTIME_DIR } from "./db.js";

const isEmpty = (table) => db().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n === 0;

async function readJsonFile(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return null; }
}

// The newest raw capture for a source, which is the one whose bytes correspond
// to the normalized records being imported alongside it.
async function newestRaw(sourceId) {
  const dir = join(RUNTIME_DIR, "raw", sourceId);
  try {
    const names = (await readdir(dir)).filter((name) => !name.endsWith(".tmp")).sort();
    const latest = names.at(-1);
    if (!latest) return null;
    return { bytes: await readFile(join(dir, latest)), extension: latest.split(".").pop() || null };
  } catch { return null; }
}

async function importSources() {
  if (!isEmpty("snapshots")) return { sources: 0, records: 0 };
  const dir = join(RUNTIME_DIR, "normalized");
  let names = [];
  try { names = (await readdir(dir)).filter((name) => name.endsWith(".json")); }
  catch { return { sources: 0, records: 0 }; }

  let sources = 0;
  let records = 0;
  for (const name of names) {
    const sourceId = name.replace(/\.json$/, "");
    const snapshot = await readJsonFile(join(dir, name));
    if (!snapshot?.records) continue;
    const raw = await newestRaw(sourceId);
    const list = snapshot.records;
    transact((database) => {
      const insert = database.prepare("INSERT INTO records (source_id, ordinal, record_id, payload) VALUES (?, ?, ?, ?)");
      list.forEach((record, ordinal) => {
        insert.run(sourceId, ordinal, record?.recordId == null ? null : String(record.recordId), toJson(record));
      });
      database.prepare(`
        INSERT INTO snapshots (source_id, captured_at, metadata, record_count, checksum_sha256, raw_extension, raw_bytes, raw_byte_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        // The checksum stays null rather than being recomputed here: the file
        // store recorded it in sync-status, and inventing one from whichever raw
        // capture happens to be newest would assert a link that is not checked.
        .run(sourceId, snapshot.capturedAt || new Date().toISOString(), toJson(snapshot.metadata || {}),
          list.length, null, raw?.extension || null, raw?.bytes || null, raw?.bytes?.length || 0);
    });
    sources += 1;
    records += list.length;
  }
  return { sources, records };
}

async function importSyncStatus() {
  if (!isEmpty("sync_status")) return 0;
  const status = await readJsonFile(join(RUNTIME_DIR, "sync-status.json"));
  if (!status) return 0;
  const entries = Object.entries(status);
  transact((database) => {
    const insert = database.prepare("INSERT OR REPLACE INTO sync_status (source_id, state) VALUES (?, ?)");
    for (const [sourceId, state] of entries) insert.run(sourceId, toJson(state));
  });
  return entries.length;
}

async function importCases() {
  if (!isEmpty("threads")) return { threads: 0, turns: 0 };
  const dir = join(RUNTIME_DIR, "cases");
  const index = await readJsonFile(join(dir, "threads.json"));
  if (!Array.isArray(index) || !index.length) return { threads: 0, turns: 0 };

  let turns = 0;
  for (const thread of index) {
    if (!thread?.threadId) continue;
    // Read outside the transaction: a hundred cases is a hundred files, and the
    // point of the transaction is the write, not the reading.
    const loaded = [];
    for (const item of thread.turns || []) {
      const turn = await readJsonFile(join(dir, `${item.id}.json`));
      if (turn) loaded.push({ item, turn });
    }
    transact((database) => {
      database.prepare(`
        INSERT OR REPLACE INTO threads (thread_id, title, headline, overall_risk, locale, mode, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(thread.threadId, thread.title || "", thread.headline || "", thread.overallRisk || "unknown",
          thread.locale === "en" ? "en" : "zh", thread.mode || null,
          thread.createdAt || new Date().toISOString(), thread.updatedAt || thread.createdAt || new Date().toISOString());
      const insert = database.prepare(`
        INSERT OR REPLACE INTO turns (case_id, thread_id, created_at, question, headline, overall_risk, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const { item, turn } of loaded) {
        insert.run(item.id, thread.threadId, item.createdAt || turn.createdAt || thread.createdAt || new Date().toISOString(),
          item.question || turn.question || "", item.headline || "", item.overallRisk || "unknown", toJson(turn));
      }
    });
    turns += loaded.length;
  }
  return { threads: index.length, turns };
}

export async function importLegacyStore() {
  // Nothing to do on a fresh deployment, which is the common case.
  const present = await stat(join(RUNTIME_DIR, "normalized")).then(() => true, () => false)
    || await stat(join(RUNTIME_DIR, "cases")).then(() => true, () => false);
  if (!present) return null;

  const sources = await importSources();
  const statuses = await importSyncStatus();
  const cases = await importCases();
  if (!sources.sources && !statuses && !cases.threads) return null;
  return { ...sources, syncStatuses: statuses, ...cases };
}

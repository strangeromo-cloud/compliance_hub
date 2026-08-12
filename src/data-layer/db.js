// The store everything durable lives in.
//
// Before this there were four file layouts under data/runtime — a JSON file per
// source, one per case, a status document rewritten whole on every sync, and a
// directory of cached pages. Each one re-read and rewrote far more than it
// changed, and none of them could answer a question without loading everything
// first.
//
// node:sqlite is built into Node, so this stays a project with no runtime
// dependencies and no build step. It needs Node 24; server.js says so on
// startup rather than failing on the first query.
//
// One thing this does not change: the file still sits on the container's disk.
// A database survives a redeploy exactly when the directory it is in does, so
// the volume at data/runtime is what makes any of this durable. See
// storageDurability() in case-store.js, which reports that honestly.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const RUNTIME_DIR = join(ROOT, "data", "runtime");
export const DB_PATH = process.env.HUB_DB_PATH || join(RUNTIME_DIR, "hub.db");

// Written out rather than generated, so the shape of what is stored can be read
// in one place. Records keep their ordinal because a source's own order is part
// of what it publishes — a control list is ordered, and paging through it in
// insertion order is what makes it checkable against the original.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS snapshots (
  source_id        TEXT PRIMARY KEY,
  captured_at      TEXT NOT NULL,
  metadata         TEXT NOT NULL DEFAULT '{}',
  record_count     INTEGER NOT NULL DEFAULT 0,
  checksum_sha256  TEXT,
  raw_extension    TEXT,
  raw_bytes        BLOB,
  raw_byte_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS records (
  source_id  TEXT NOT NULL,
  ordinal    INTEGER NOT NULL,
  record_id  TEXT,
  payload    TEXT NOT NULL,
  PRIMARY KEY (source_id, ordinal)
);

-- Every sync leaves a line here, including the ones that changed nothing. The
-- bytes of superseded snapshots are not kept, but their checksum is, which is
-- what a "was this list different last month" question actually needs.
CREATE TABLE IF NOT EXISTS snapshot_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id        TEXT NOT NULL,
  captured_at      TEXT NOT NULL,
  checksum_sha256  TEXT,
  record_count     INTEGER NOT NULL DEFAULT 0,
  raw_byte_count   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS snapshot_log_by_source ON snapshot_log (source_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS sync_status (
  source_id  TEXT PRIMARY KEY,
  state      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  thread_id     TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  headline      TEXT NOT NULL DEFAULT '',
  overall_risk  TEXT NOT NULL DEFAULT 'unknown',
  locale        TEXT NOT NULL DEFAULT 'zh',
  mode          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS threads_by_recency ON threads (updated_at DESC);

CREATE TABLE IF NOT EXISTS turns (
  case_id       TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads (thread_id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL,
  question      TEXT NOT NULL DEFAULT '',
  headline      TEXT NOT NULL DEFAULT '',
  overall_risk  TEXT NOT NULL DEFAULT 'unknown',
  payload       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS turns_by_thread ON turns (thread_id, created_at);

  -- What each run cost the reader, kept past the point where the turn itself is
  -- pruned. threads and turns are a history feature and are bounded on purpose;
  -- this is the record of how well the system read the question, and deleting it
  -- to make room for recent chat history would mean the one measurement that
  -- could improve the reading is the first thing thrown away.
  --
  -- One row per case, a few hundred bytes, never pruned by the history limits.
  -- Deliberately not the whole payload: what is needed is the question, what was
  -- asked for, and what it cost — not a second copy of every answer.
  CREATE TABLE IF NOT EXISTS case_signals (
    case_id        TEXT PRIMARY KEY,
    thread_id      TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    question       TEXT NOT NULL DEFAULT '',
    locale         TEXT NOT NULL DEFAULT 'zh',
    mode           TEXT NOT NULL DEFAULT '',
    gem_id         TEXT,
    kind           TEXT NOT NULL DEFAULT 'review',
    intent         TEXT NOT NULL DEFAULT '',
    lanes          TEXT NOT NULL DEFAULT '[]',
    -- Whether any term in the question put a lane on the path, or every lane ran
    -- because nothing matched. The fallback rate is the headline number for how
    -- well the routing vocabulary covers how people actually write.
    route_matched  INTEGER NOT NULL DEFAULT 0,
    turn_index     INTEGER NOT NULL DEFAULT 1,
    asked_step     TEXT,
    declared       TEXT NOT NULL DEFAULT '[]',
    unavailable    TEXT NOT NULL DEFAULT '[]',
    open_steps     INTEGER NOT NULL DEFAULT 0,
    settled_steps  INTEGER NOT NULL DEFAULT 0,
    overall_risk   TEXT
  );
  CREATE INDEX IF NOT EXISTS case_signals_by_time ON case_signals (created_at);
  CREATE INDEX IF NOT EXISTS case_signals_by_thread ON case_signals (thread_id, created_at);

CREATE TABLE IF NOT EXISTS page_cache (
  url          TEXT PRIMARY KEY,
  text         TEXT NOT NULL,
  etag         TEXT,
  captured_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS page_cache_by_age ON page_cache (captured_at);

-- A saved procedure and the slash command that runs it. Written by the reader,
-- so it lives here with threads and turns rather than in data/fallback, which
-- holds committed mirrors of official sources and nothing else.
--
-- command is UNIQUE because it is how one is invoked: two skills answering to
-- /tpdd is a composer that cannot say which the reader meant.
CREATE TABLE IF NOT EXISTS skills (
  skill_id    TEXT PRIMARY KEY,
  command     TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  payload     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS skills_by_age ON skills (created_at);

-- A gem the reader built: the same four fields the built-in eight carry, with
-- requiredFacts written as keywords rather than regular expressions.
CREATE TABLE IF NOT EXISTS custom_gems (
  gem_id      TEXT PRIMARY KEY,
  command     TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  payload     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS custom_gems_by_age ON custom_gems (created_at);
`;

export const REQUIRED_NODE_MAJOR = 24;

// Imported at first use rather than at module load. A static import of a
// built-in that does not exist throws inside the loader, before any line of this
// program runs — which is how a Node 20 deployment produced nothing but
// ERR_UNKNOWN_BUILTIN_MODULE and a crash loop, with no statement of what was
// required or by what.
export function sqlite() {
  try {
    return createRequire(import.meta.url)("node:sqlite");
  } catch (error) {
    if (error?.code !== "ERR_UNKNOWN_BUILTIN_MODULE") throw error;
    throw Object.assign(
      new Error(`node:sqlite requires Node ${REQUIRED_NODE_MAJOR}; this process is ${process.version}. `
        + "The Dockerfile pins node:24-alpine and package.json declares engines.node — a build that ignores both is the thing to fix."),
      { code: "node_too_old" }
    );
  }
}

let handle = null;

export function db() {
  if (handle) return handle;
  const { DatabaseSync } = sqlite();
  mkdirSync(RUNTIME_DIR, { recursive: true });
  handle = new DatabaseSync(DB_PATH);
  // WAL keeps a reader from blocking the sync that is writing beneath it, which
  // matters here because boot sync runs while the server is already answering.
  handle.exec("PRAGMA journal_mode = WAL");
  handle.exec("PRAGMA foreign_keys = ON");
  // A crash mid-sync may lose the last transaction; it cannot leave a corrupt
  // file. For a snapshot that can be re-fetched, that is the right trade.
  handle.exec("PRAGMA synchronous = NORMAL");
  handle.exec(SCHEMA);
  return handle;
}

export function closeDb() {
  if (!handle) return;
  try { handle.close(); } finally { handle = null; }
}

// SQLite has no boolean and no object type, so everything crossing this
// boundary is stated explicitly rather than left to a driver's coercion rules.
export const toJson = (value) => JSON.stringify(value ?? null);
export const fromJson = (value, fallback = null) => {
  try { return value == null ? fallback : JSON.parse(value); }
  catch { return fallback; }
};

// One transaction per unit of work. Without it a 25,000-record insert is 25,000
// separate commits, which is the difference between a tenth of a second and a
// minute.
export function transact(work) {
  const database = db();
  database.exec("BEGIN");
  try {
    const value = work(database);
    database.exec("COMMIT");
    return value;
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* the failure below is the one that matters */ }
    throw error;
  }
}

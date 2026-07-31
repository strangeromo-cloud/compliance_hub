// Case history, grouped into threads.
//
// This is the first piece of the decision memory the architecture calls for: a
// case keeps its question, the sources it stood on, the comparisons that were
// made and when. A follow-up belongs to the same enquiry as the question that
// prompted it, so turns are grouped by thread rather than listed separately —
// otherwise the history reads as unrelated cases that happen to share a topic.
//
// Threads and turns are rows now. What that removes: a file per case plus an
// index document rewritten in full on every save, where a crash between the two
// writes left a turn on disk that the index did not know about. A save is one
// transaction, so a thread and its turn either both land or neither does.
//
// The database still lives under data/runtime, so a hosted container loses it on
// redeploy unless a volume is mounted. That is a deployment choice, not
// something to hide — storageDurability() below reports which case a deployment
// is actually in.

import { stat } from "node:fs/promises";
import { db, DB_PATH, fromJson, toJson, transact } from "./data-layer/db.js";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAX_THREADS = 100;
const MAX_TURNS = 30;

// Ids are still validated rather than trusted. They no longer reach a
// filesystem, but they do reach queries and the client, and an id that does not
// look like an id is a sign something is wrong upstream.
const caseId = (value) => (/^CASE-[A-Z0-9]{1,24}$/.test(String(value)) ? String(value) : null);
const threadId = (value) => (/^TH-[A-Za-z0-9]{1,32}$/.test(String(value)) ? String(value) : null);

export async function saveCase(result, question, locale, thread) {
  const id = caseId(result?.id);
  if (!id) return null;
  // A turn with no thread is its own enquiry, which also keeps older cases
  // readable after this change.
  const tid = threadId(thread) || `TH-${id.slice(5)}`;
  const createdAt = result.createdAt || new Date().toISOString();
  const headline = result.synthesis?.headline || "";
  const risk = result.synthesis?.overallRisk || "unknown";
  const title = String(question).slice(0, 240);

  return transact((database) => {
    database.prepare(`
      INSERT INTO threads (thread_id, title, headline, overall_risk, locale, mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (thread_id) DO UPDATE SET
        headline = excluded.headline, overall_risk = excluded.overall_risk, updated_at = excluded.updated_at`)
      .run(tid, title, headline, risk, locale === "en" ? "en" : "zh", result.mode || null, createdAt, createdAt);

    database.prepare(`
      INSERT INTO turns (case_id, thread_id, created_at, question, headline, overall_risk, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (case_id) DO UPDATE SET
        headline = excluded.headline, overall_risk = excluded.overall_risk, payload = excluded.payload`)
      .run(id, tid, createdAt, title, headline, risk, toJson({ ...result, question, locale, threadId: tid }));

    // Bounded in the same transaction that grew them, so the limits hold even
    // if the process stops immediately afterwards.
    database.prepare(`
      DELETE FROM turns WHERE thread_id = ? AND case_id NOT IN (
        SELECT case_id FROM turns WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?)`)
      .run(tid, tid, MAX_TURNS);
    database.prepare(`
      DELETE FROM threads WHERE thread_id NOT IN (
        SELECT thread_id FROM threads ORDER BY updated_at DESC LIMIT ?)`)
      .run(MAX_THREADS);

    return { threadId: tid, title, headline, overallRisk: risk, createdAt, updatedAt: createdAt };
  });
}

// Whether history outlives the container it was written in.
//
// In an image the database sits on the same overlay filesystem as the code, and
// the whole layer is replaced on every deploy. A mounted volume is a different
// device, which is what this compares. Outside a container the question does not
// arise: an ordinary disk keeps its files.
export async function storageDurability() {
  try {
    db();
    const [store, root] = await Promise.all([stat(DB_PATH), stat(ROOT)]);
    const containerized = await stat("/.dockerenv").then(() => true, () => false);
    if (!containerized) return { persistent: true, reason: "host_filesystem" };
    return store.dev === root.dev
      ? { persistent: false, reason: "container_overlay" }
      : { persistent: true, reason: "mounted_volume" };
  } catch {
    // Unknown beats a confident guess in either direction.
    return { persistent: null, reason: "unreadable" };
  }
}

export async function listThreads(limit = 50) {
  const size = Math.min(100, Math.max(1, Number(limit) || 50));
  return db().prepare(`
    SELECT t.thread_id, t.title, t.headline, t.overall_risk, t.created_at, t.updated_at,
           (SELECT COUNT(*) FROM turns WHERE turns.thread_id = t.thread_id) AS turn_count
    FROM threads t ORDER BY t.updated_at DESC LIMIT ?`).all(size)
    .map((row) => ({
      threadId: row.thread_id,
      title: row.title,
      headline: row.headline,
      overallRisk: row.overall_risk,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      turnCount: row.turn_count
    }));
}

export async function readThread(id) {
  const tid = threadId(id);
  if (!tid) return null;
  const thread = db().prepare("SELECT thread_id, title, created_at, updated_at FROM threads WHERE thread_id = ?").get(tid);
  if (!thread) return null;
  const turns = db().prepare("SELECT payload FROM turns WHERE thread_id = ? ORDER BY created_at").all(tid)
    .map((row) => fromJson(row.payload, null))
    .filter(Boolean);
  return { threadId: tid, title: thread.title, createdAt: thread.created_at, updatedAt: thread.updated_at, turns };
}

export async function deleteThread(id) {
  const tid = threadId(id);
  if (!tid) return false;
  // Turns go with the thread through the foreign key, so a delete cannot leave
  // orphaned cases behind the way the file store could.
  return transact((database) => {
    database.prepare("DELETE FROM threads WHERE thread_id = ?").run(tid);
    return true;
  });
}

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

// What this run cost the reader, projected out of the result.
//
// The signals are extracted here rather than left inside the payload because
// they have to survive the history limits: threads and turns are bounded on
// purpose, and the measurement of how well the system read the question is the
// last thing that should be deleted to make room for recent chat.
function caseSignals(result, question, locale, tid, turnIndex) {
  const steps = (result.analysisPath?.lanes || []).flatMap((lane) => lane.steps || []);
  const open = steps.filter((step) => step.status === "evidence_needed");
  const settled = steps.filter((step) => step.status === "confirmed" || step.status === "declared" || step.status === "not_applicable");
  // Whether any term in the question put a lane on the path, or every lane ran
  // because nothing matched. planAnalysisPath writes the reason onto each lane,
  // so this reads the run's own answer rather than recomputing one.
  const rows = result.analysisPath?.derivation || [];
  const matched = rows.some((row) => row.matchedBy === "question_terms" || row.matchedBy === "gem" || row.matchedBy === "direct_lookup" || row.matchedBy === "gem_kind");
  return {
    case_id: result.id,
    thread_id: tid,
    created_at: result.createdAt || new Date().toISOString(),
    question: String(question).slice(0, 500),
    locale: locale === "en" ? "en" : "zh",
    mode: result.mode || "",
    gem_id: result.gemId || null,
    kind: result.analysisPath?.lanes?.[0]?.lane === "briefing" ? "briefing"
      : result.intent === "data_lookup" ? "lookup"
        : result.intent === "case_memo" ? "memo" : "review",
    intent: result.intent || "",
    lanes: toJson(result.agents || []),
    route_matched: matched ? 1 : 0,
    turn_index: turnIndex,
    // Which step stopped the run. Null means it reached a conclusion without
    // having to interrupt.
    asked_step: result.awaitingInput?.step || null,
    declared: toJson(Object.keys(result.declaredFacts || {})),
    unavailable: toJson(result.unavailableFacts || []),
    open_steps: open.length,
    settled_steps: settled.length,
    overall_risk: result.synthesis?.overallRisk || null
  };
}

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

    // The signals outlive the turn. Written in the same transaction so a run is
    // never measured as having happened without its record, or the reverse.
    const turnIndex = database.prepare("SELECT count(*) AS n FROM turns WHERE thread_id = ?").get(tid)?.n || 1;
    const signals = caseSignals(result, question, locale, tid, turnIndex);
    database.prepare(`
      INSERT INTO case_signals (case_id, thread_id, created_at, question, locale, mode, gem_id, kind, intent,
        lanes, route_matched, turn_index, asked_step, declared, unavailable, open_steps, settled_steps, overall_risk)
      VALUES (@case_id, @thread_id, @created_at, @question, @locale, @mode, @gem_id, @kind, @intent,
        @lanes, @route_matched, @turn_index, @asked_step, @declared, @unavailable, @open_steps, @settled_steps, @overall_risk)
      ON CONFLICT (case_id) DO UPDATE SET
        asked_step = excluded.asked_step, declared = excluded.declared, unavailable = excluded.unavailable,
        open_steps = excluded.open_steps, settled_steps = excluded.settled_steps, overall_risk = excluded.overall_risk`)
      .run(signals);

    // Bounded in the same transaction that grew them, so the limits hold even
    // if the process stops immediately afterwards. case_signals is deliberately
    // not among them.
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
    // /.dockerenv exists under Docker and not under Kubernetes, which is what
    // Zeabur runs — so on the actual deployment this reported "host filesystem"
    // and the page promised durability it had no basis for. Being PID 1 is the
    // general signal; the rest are the specific ones this platform sets.
    const containerized = process.pid === 1
      || Boolean(process.env.KUBERNETES_SERVICE_HOST)
      || Boolean(process.env.ZEABUR_SERVICE_ID)
      || await stat("/.dockerenv").then(() => true, () => false);
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

// The baseline, in one query.
//
// There is no evolution without a measurement that predates it, and the
// measurements that matter are all about how well the system read the question
// rather than how well it answered: how often nothing matched and every lane ran
// by default, how many rounds it took to get the facts, which field was most
// often supplied only after being asked for. Each of those is a thing that can
// be improved without touching a single provision.
export function evolutionSignals({ days = 90 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const database = db();
  const rows = database.prepare("SELECT * FROM case_signals WHERE created_at >= ? ORDER BY created_at DESC").all(since);
  if (!rows.length) return { since, total: 0, reviews: 0, fallbackRate: null, askRate: null, averageTurns: null, byKind: [], askedSteps: [], lateFields: [] };

  const reviews = rows.filter((row) => row.kind === "review");
  const count = (list, test) => list.filter(test).length;
  const tally = (list, key) => {
    const seen = new Map();
    for (const value of list) seen.set(value, (seen.get(value) || 0) + 1);
    return [...seen].map(([name, n]) => ({ name, count: n })).sort((left, right) => right.count - left.count);
  };

  // A field the reader had to be asked for is a field the composer could have
  // asked for up front. Counted only where the run actually stopped, because a
  // fact volunteered in the first message was never late.
  const lateFields = tally(rows.filter((row) => row.asked_step).flatMap((row) => fromJson(row.declared) || []));
  const threads = new Map();
  for (const row of rows) threads.set(row.thread_id, Math.max(threads.get(row.thread_id) || 0, row.turn_index));

  return {
    since,
    total: rows.length,
    reviews: reviews.length,
    // Nothing in the question matched a routing term, so every lane ran. This is
    // the headline number for how well the vocabulary covers how people write.
    fallbackRate: reviews.length ? count(reviews, (row) => !row.route_matched) / reviews.length : null,
    // How often a run had to stop and ask rather than reaching a conclusion.
    askRate: rows.length ? count(rows, (row) => row.asked_step) / rows.length : null,
    averageTurns: threads.size ? [...threads.values()].reduce((sum, n) => sum + n, 0) / threads.size : null,
    byKind: tally(rows.map((row) => row.kind)),
    askedSteps: tally(rows.map((row) => row.asked_step).filter(Boolean)).slice(0, 8),
    lateFields: lateFields.slice(0, 8),
    unanswered: count(rows, (row) => row.open_steps > 0)
  };
}

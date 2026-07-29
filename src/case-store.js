// Case history, grouped into threads.
//
// This is the first piece of the decision memory the architecture calls for: a
// case keeps its question, the sources it stood on, the comparisons that were
// made and when. A follow-up belongs to the same enquiry as the question that
// prompted it, so turns are grouped by thread rather than listed separately —
// otherwise the history reads as unrelated cases that happen to share a topic.
//
// Files live under data/runtime, so a hosted container loses them on redeploy
// unless a volume is mounted. That is a deployment choice, not something to
// hide.

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CASE_DIR = join(ROOT, "data", "runtime", "cases");
const INDEX_PATH = join(CASE_DIR, "threads.json");
const MAX_THREADS = 100;
const MAX_TURNS = 30;

let writeQueue = Promise.resolve();

// Ids reach the filesystem, so they are validated rather than trusted, even
// though they are generated internally.
const caseId = (value) => (/^CASE-[A-Z0-9]{1,24}$/.test(String(value)) ? String(value) : null);
const threadId = (value) => (/^TH-[A-Za-z0-9]{1,32}$/.test(String(value)) ? String(value) : null);

async function readIndex() {
  try { return JSON.parse(await readFile(INDEX_PATH, "utf8")); }
  catch { return []; }
}

async function writeAtomic(path, contents) {
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, contents);
  await rename(temp, path);
}

export async function saveCase(result, question, locale, thread) {
  const id = caseId(result?.id);
  if (!id) return null;
  // A turn with no thread is its own enquiry, which also keeps older cases
  // readable after this change.
  const tid = threadId(thread) || `TH-${id.slice(5)}`;

  const operation = writeQueue.catch(() => {}).then(async () => {
    await mkdir(CASE_DIR, { recursive: true });
    await writeAtomic(join(CASE_DIR, `${id}.json`), JSON.stringify({ ...result, question, locale, threadId: tid }, null, 2));

    const index = await readIndex();
    const existing = index.find((item) => item.threadId === tid);
    const turn = {
      id,
      createdAt: result.createdAt,
      question: String(question).slice(0, 240),
      headline: result.synthesis?.headline || "",
      overallRisk: result.synthesis?.overallRisk || "unknown"
    };

    let thread_;
    if (existing) {
      existing.turns = [...existing.turns.filter((item) => item.id !== id), turn].slice(-MAX_TURNS);
      existing.updatedAt = result.createdAt;
      existing.overallRisk = turn.overallRisk;
      existing.headline = turn.headline;
      thread_ = existing;
    } else {
      thread_ = {
        threadId: tid,
        createdAt: result.createdAt,
        updatedAt: result.createdAt,
        locale,
        mode: result.mode,
        // The opening question names the enquiry; later turns are follow-ups.
        title: String(question).slice(0, 240),
        headline: turn.headline,
        overallRisk: turn.overallRisk,
        turns: [turn]
      };
      index.unshift(thread_);
    }

    const ordered = [thread_, ...index.filter((item) => item.threadId !== tid)]
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));

    for (const dropped of ordered.slice(MAX_THREADS)) {
      for (const item of dropped.turns || []) await unlink(join(CASE_DIR, `${item.id}.json`)).catch(() => {});
    }
    await writeAtomic(INDEX_PATH, JSON.stringify(ordered.slice(0, MAX_THREADS), null, 2));
    return thread_;
  });
  writeQueue = operation;
  return operation;
}

export async function listThreads(limit = 50) {
  const index = await readIndex();
  return index.slice(0, Math.min(100, Math.max(1, Number(limit) || 50))).map((thread) => ({
    threadId: thread.threadId,
    title: thread.title,
    headline: thread.headline,
    overallRisk: thread.overallRisk,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    turnCount: (thread.turns || []).length
  }));
}

export async function readThread(id) {
  const tid = threadId(id);
  if (!tid) return null;
  const thread = (await readIndex()).find((item) => item.threadId === tid);
  if (!thread) return null;
  const turns = [];
  for (const item of thread.turns || []) {
    try { turns.push(JSON.parse(await readFile(join(CASE_DIR, `${item.id}.json`), "utf8"))); }
    catch { /* a turn whose file is gone must not lose the rest of the thread */ }
  }
  return { threadId: tid, title: thread.title, createdAt: thread.createdAt, updatedAt: thread.updatedAt, turns };
}

export async function deleteThread(id) {
  const tid = threadId(id);
  if (!tid) return false;
  const operation = writeQueue.catch(() => {}).then(async () => {
    const index = await readIndex();
    const thread = index.find((item) => item.threadId === tid);
    for (const item of thread?.turns || []) await unlink(join(CASE_DIR, `${item.id}.json`)).catch(() => {});
    await writeAtomic(INDEX_PATH, JSON.stringify(index.filter((item) => item.threadId !== tid), null, 2));
    return true;
  });
  writeQueue = operation;
  return operation;
}

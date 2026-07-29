// Case history.
//
// This is the first piece of the decision memory the architecture calls for: a
// case is not only an answer, it is the question, the sources it stood on, the
// comparisons that were made and when. Keeping it lets a later reviewer see how
// a conclusion was reached rather than only what it was.
//
// Files under data/runtime, so a hosted container loses them on redeploy unless
// a volume is mounted. That is a deployment choice, not something to hide.

import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CASE_DIR = join(ROOT, "data", "runtime", "cases");
const INDEX_PATH = join(CASE_DIR, "index.json");
const MAX_CASES = 200;

let writeQueue = Promise.resolve();

function safeId(id) {
  // Ids are generated internally, but this is a filesystem path — never trust
  // a caller-supplied value to stay inside the directory.
  return /^CASE-[A-Z0-9]{1,24}$/.test(String(id)) ? String(id) : null;
}

async function readIndex() {
  try { return JSON.parse(await readFile(INDEX_PATH, "utf8")); }
  catch { return []; }
}

async function writeAtomic(path, contents) {
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, contents);
  await rename(temp, path);
}

export async function saveCase(result, question, locale) {
  const id = safeId(result?.id);
  if (!id) return null;
  const operation = writeQueue.catch(() => {}).then(async () => {
    await mkdir(CASE_DIR, { recursive: true });
    await writeAtomic(join(CASE_DIR, `${id}.json`), JSON.stringify({ ...result, question, locale }, null, 2));

    const entry = {
      id,
      createdAt: result.createdAt,
      locale,
      mode: result.mode,
      question: String(question).slice(0, 240),
      headline: result.synthesis?.headline || "",
      overallRisk: result.synthesis?.overallRisk || "unknown",
      agents: result.agents || [],
      listMatchCount: result.grounding?.listMatchCount || 0,
      sourceCount: (result.sources || []).length
    };
    const index = [entry, ...(await readIndex()).filter((item) => item.id !== id)];

    // Trim the oldest so a long-running prototype cannot fill the disk.
    for (const dropped of index.slice(MAX_CASES)) {
      await unlink(join(CASE_DIR, `${dropped.id}.json`)).catch(() => {});
    }
    await writeAtomic(INDEX_PATH, JSON.stringify(index.slice(0, MAX_CASES), null, 2));
    return entry;
  });
  writeQueue = operation;
  return operation;
}

export async function listCases(limit = 50) {
  return (await readIndex()).slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
}

export async function readCase(id) {
  const safe = safeId(id);
  if (!safe) return null;
  try { return JSON.parse(await readFile(join(CASE_DIR, `${safe}.json`), "utf8")); }
  catch { return null; }
}

export async function deleteCase(id) {
  const safe = safeId(id);
  if (!safe) return false;
  const operation = writeQueue.catch(() => {}).then(async () => {
    await unlink(join(CASE_DIR, `${safe}.json`)).catch(() => {});
    await writeAtomic(INDEX_PATH, JSON.stringify((await readIndex()).filter((item) => item.id !== safe), null, 2));
    return true;
  });
  writeQueue = operation;
  return operation;
}

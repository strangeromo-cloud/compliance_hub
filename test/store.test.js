import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

// A database of its own, so these tests neither read nor disturb the one the
// development server keeps. It has to be set before the module is imported,
// because the path is resolved when the module loads.
const DIR = mkdtempSync(join(tmpdir(), "hub-store-"));
process.env.HUB_DB_PATH = join(DIR, "test.db");

const { closeDb } = await import("../src/data-layer/db.js");
const storage = await import("../src/data-layer/storage.js");
const cases = await import("../src/case-store.js");
const pages = await import("../src/data-layer/page-cache.js");

after(() => { closeDb(); rmSync(DIR, { recursive: true, force: true }); });

const bytes = (text) => Buffer.from(text, "utf8");

test("a synced source round-trips with its records in the order it published them", async () => {
  const records = Array.from({ length: 250 }, (_, index) => ({ recordId: `R${index}`, name: `Party ${index}`, country: "CN" }));
  const saved = await storage.saveSourceData({ sourceId: "t-list", extension: "csv", bytes: bytes("raw,csv\n"), records, metadata: { syncScope: "test" } });
  assert.match(saved.checksumSha256, /^[a-f0-9]{64}$/);

  const read = await storage.readNormalized("t-list");
  assert.equal(read.provenance, "live_sync");
  assert.equal(read.records.length, 250);
  // Order is part of what a control list publishes, so it is stored, not
  // reconstructed from whatever order rows come back in.
  assert.deepEqual(read.records.map((item) => item.recordId).slice(0, 3), ["R0", "R1", "R2"]);
  assert.equal(read.records.at(-1).recordId, "R249");
  assert.equal(read.metadata.syncScope, "test");
});

test("a page of records costs a page, not the whole source", async () => {
  const page = await storage.readRecordsPage("t-list", 100, 5);
  assert.deepEqual(page.map((item) => item.recordId), ["R100", "R101", "R102", "R103", "R104"]);
  const meta = await storage.readSnapshotMeta("t-list");
  assert.equal(meta.recordCount, 250, "the count comes from the snapshot, without reading the rows");
});

test("re-syncing replaces a source rather than accumulating it", async () => {
  await storage.saveSourceData({ sourceId: "t-list", extension: "csv", bytes: bytes("raw,csv,v2\n"), records: [{ recordId: "ONLY" }] });
  const read = await storage.readNormalized("t-list");
  assert.deepEqual(read.records.map((item) => item.recordId), ["ONLY"]);

  // The superseded capture keeps its checksum even though its bytes are gone,
  // which is what answers "did this list actually change".
  const history = await storage.readSnapshotHistory("t-list");
  assert.equal(history.length, 2);
  assert.notEqual(history[0].checksumSha256, history[1].checksumSha256);
});

test("the raw bytes stay with the snapshot they produced", async () => {
  const raw = await storage.readRawSnapshot("t-list");
  assert.equal(raw.bytes.toString("utf8"), "raw,csv,v2\n");
  assert.equal(raw.extension, "csv");
});

test("an unsynced source falls through to the bundled copy, still tagged as one", async () => {
  // china-dual-use ships a bundled fallback; nothing has been synced for it here.
  const read = await storage.readNormalized("china-dual-use");
  assert.ok(read, "the bundled copy should answer");
  assert.equal(read.provenance, "bundled_fallback_snapshot");
  assert.equal(read.isFallback, true, "a point-in-time copy must never present as the current list");
});

test("sync status merges instead of replacing", async () => {
  await storage.updateSyncStatus("t-list", { status: "syncing", startedAt: "2026-01-01T00:00:00.000Z" });
  const merged = await storage.updateSyncStatus("t-list", { status: "success", recordCount: 1 });
  assert.equal(merged.startedAt, "2026-01-01T00:00:00.000Z", "an earlier field must survive a later update");
  assert.equal((await storage.readSyncStatus())["t-list"].status, "success");
});

const result = (id, createdAt, risk = "high") => ({
  id, createdAt, mode: "rules",
  synthesis: { headline: `Headline ${id}`, overallRisk: risk },
  sources: [{ sourceId: "t-list" }]
});

test("a case and its thread are saved together and read back whole", async () => {
  await cases.saveCase(result("CASE-AAA1", "2026-02-01T00:00:00.000Z"), "第一个问题", "zh", null);
  const [thread] = await cases.listThreads(10);
  assert.equal(thread.title, "第一个问题");
  assert.equal(thread.turnCount, 1);

  await cases.saveCase(result("CASE-AAA2", "2026-02-02T00:00:00.000Z", "medium"), "追问", "zh", thread.threadId);
  const reopened = await cases.readThread(thread.threadId);
  assert.equal(reopened.turns.length, 2, "a follow-up joins the enquiry it followed");
  assert.deepEqual(reopened.turns.map((turn) => turn.id), ["CASE-AAA1", "CASE-AAA2"]);
  assert.equal(reopened.turns[0].synthesis.headline, "Headline CASE-AAA1", "the whole result is kept, not a summary of it");
});

test("deleting a thread takes its cases with it", async () => {
  const [thread] = await cases.listThreads(1);
  await cases.deleteThread(thread.threadId);
  assert.equal(await cases.readThread(thread.threadId), null);
  // The file store could leave case files behind that no index referenced.
  const { db } = await import("../src/data-layer/db.js");
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM turns WHERE thread_id = ?").get(thread.threadId).n, 0);
});

test("an id that is not an id is refused rather than queried", async () => {
  assert.equal(await cases.readThread("../../etc/passwd"), null);
  assert.equal(await cases.deleteThread("TH-'; DROP TABLE threads;--"), false);
  assert.equal(await cases.saveCase({ id: "not-a-case" }, "q", "zh", null), null);
});

test("cached page text carries the time it was captured", async () => {
  await pages.writeCachedPage("https://example.gov/rule", "the text", "etag-1");
  const entry = await pages.readCachedPage("https://example.gov/rule");
  assert.equal(entry.text, "the text");
  assert.equal(entry.etag, "etag-1");
  assert.ok(entry.ageMs < 60_000, "a page just written is not old");
  assert.equal(await pages.readCachedPage("https://example.gov/never-fetched"), null);
});

test("every China source ships a fallback, and every fallback says it is one", async () => {
  // PRC hosts time out from some regions — the deployment's boot log is nothing
  // but ETIMEDOUT for them. A source with no bundled copy is simply absent
  // there, which is how PRC classification had nothing to work from.
  const { readdir, readFile } = await import("node:fs/promises");
  const dir = new URL("../data/fallback/", import.meta.url);
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json"));

  const { DATA_SOURCE_REGISTRY } = await import("../src/data-source-registry.js");
  const { ADAPTERS } = await import("../src/data-layer/adapters.js");
  // The vendor tables are here for the same reason: a host that cannot reach
  // amd.com has no other way to answer an AMD part number.
  const needsFallback = DATA_SOURCE_REGISTRY
    .filter((source) => (source.country === "CN" || ["nvidia-export", "amd-export"].includes(source.sourceId))
      && ADAPTERS[source.sourceId]?.sync)
    .map((source) => source.sourceId);
  for (const sourceId of needsFallback) {
    assert.ok(names.includes(`${sourceId}.json`), `${sourceId} has a sync adapter but no bundled fallback`);
  }

  for (const name of names) {
    const snapshot = JSON.parse(await readFile(new URL(name, dir), "utf8"));
    assert.equal(snapshot.provenance, "bundled_fallback_snapshot", `${name} must declare what it is`);
    assert.ok(snapshot.bundledAt, `${name} must carry its capture date`);
    assert.ok(snapshot.records?.length, `${name} must actually contain records`);
    assert.match(snapshot.note, /re-sync|point-in-time/i, `${name} must state its limits`);
  }
});

test("the documented boot-sync list matches the sources that can be snapshotted", async () => {
  // This list is copied into a deployment's environment by hand, so it drifts
  // silently: three snapshot sources were added after it was written and a
  // deployment configured from it simply never fetched them.
  const { readFile } = await import("node:fs/promises");
  const { DATA_SOURCE_REGISTRY } = await import("../src/data-source-registry.js");
  const { ADAPTERS } = await import("../src/data-layer/adapters.js");

  // Tens-of-megabytes downloads belong on demand, not on every cold start.
  const HEAVY = new Set(["trade-csl", "ofac-sls", "un-consolidated", "uk-sanctions"]);
  // gleif-lei stores only a sample and answers live queries, so a boot sync of
  // it would suggest a corpus that is not there.
  const SAMPLE_ONLY = new Set(["gleif-lei"]);

  const expected = DATA_SOURCE_REGISTRY
    .filter((source) => ADAPTERS[source.sourceId]?.sync && !HEAVY.has(source.sourceId) && !SAMPLE_ONLY.has(source.sourceId))
    .map((source) => source.sourceId);

  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  // Matched as "a line that is only comma-separated source ids", not by anchoring
  // on one id: anchoring on bis-ear-732 silently dropped everything before it
  // the first time the list was reordered, and the test then reported the
  // README as missing an entry that was sitting right there.
  const documented = readme.match(/^[a-z0-9-]+(?:,[a-z0-9-]+){10,}$/m)?.[0].split(",") || [];
  assert.ok(documented.length, "the README should carry a SYNC_ON_BOOT value");
  const missing = expected.filter((id) => !documented.includes(id));
  const extra = documented.filter((id) => !expected.includes(id));
  assert.deepEqual(missing, [], `README's SYNC_ON_BOOT is missing: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `README's SYNC_ON_BOOT lists sources that cannot be snapshotted: ${extra.join(", ")}`);
});

test("the vendor classification parsers read their real published shapes", async () => {
  const { parseNvidiaParts, parseAmdParts } = await import("../src/data-layer/adapters-vendor.js");

  // NVIDIA writes the string "NULL" for an absent value. Storing it would put
  // the word NULL in front of a reviewer as though it were a classification.
  const nvidia = parseNvidiaParts([
    { id: 1, part_number: "900-21010-0000-000", part_description: "H100 PCIe", part_type: "NULL", tpp: "12224", nv_hts: "8473.30", nveccn: "4A090.a", state: "PRODUCTION" }
  ]);
  assert.equal(nvidia.length, 1);
  assert.equal(nvidia[0].eccn, "4A090.a");
  assert.equal(nvidia[0].partType, null, '"NULL" is not a value');
  assert.equal(nvidia[0].tppPerGpu, "12224");

  // AMD's PDF extracts one table cell per line, so a row is assembled by
  // counting from the part number. A hyphenated token that is not a row start
  // must not take the next four lines with it.
  const amd = parseAmdParts([
    "Product Number", "US ECCN", "US HS", "CCATS", "Meets 3A090.a.1",
    "100-000000009", "5A992.c", "8542310045", "G177385", "N",
    "100-000000010", "EAR99", "8542310045", "G177386", "N",
    "some-heading-text", "not an eccn", "not an hs", "x", "y"
  ].join("\n"), "June 30th, 2026");
  assert.equal(amd.length, 2, "only real rows are assembled");
  assert.equal(amd[0].partNumber, "100-000000009");
  assert.equal(amd[0].eccn, "5A992.c");
  assert.equal(amd[0].ccats, "G177385");
  assert.equal(amd[0].meets3A090a1, "N");
  // "AMD says 5A992.c" means little without "as of when".
  assert.equal(amd[0].classificationDate, "June 30th, 2026");
});

test("no source file carries a control character where an escape was meant", async () => {
  // A \b written into a source file through a non-raw string becomes a literal
  // backspace, and the regex it was part of then silently matches nothing —
  // which is how a list tag stopped recognising "SDN" without any error.
  const { readFile } = await import("node:fs/promises");
  const { execFileSync } = await import("node:child_process");
  const files = execFileSync("git", ["ls-files", "*.js", "*.mjs", "*.css", "*.html", "*.json"], {
    cwd: new URL("..", import.meta.url).pathname, encoding: "utf8"
  }).split("\n").filter(Boolean);

  const bad = [];
  for (const name of files) {
    const text = await readFile(new URL(`../${name}`, import.meta.url), "utf8");
    if (/[\x07\x08\x0b\x0c]/.test(text)) bad.push(name);
  }
  assert.deepEqual(bad, [], `control characters found in: ${bad.join(", ")}`);
});

test("every registered source says what it is for", async () => {
  // The registry's notes answer "how do we fetch it". A reader looking at
  // thirty-four cards needs "what is it for" — and needs to see when the honest
  // answer is "nothing reads it yet", which is a fact about scope rather than a
  // fault, and is invisible without saying it.
  const { DATA_SOURCE_REGISTRY } = await import("../src/data-source-registry.js");
  const { SOURCE_PURPOSE } = await import("../src/source-purpose.js");

  const missing = DATA_SOURCE_REGISTRY.filter((source) => !SOURCE_PURPOSE[source.sourceId]).map((source) => source.sourceId);
  assert.deepEqual(missing, [], `no stated purpose for: ${missing.join(", ")}`);

  const stray = Object.keys(SOURCE_PURPOSE)
    .filter((id) => !DATA_SOURCE_REGISTRY.some((source) => source.sourceId === id));
  assert.deepEqual(stray, [], `purpose written for sources that do not exist: ${stray.join(", ")}`);

  for (const [id, purpose] of Object.entries(SOURCE_PURPOSE)) {
    assert.ok(purpose.zh?.length > 10 && purpose.en?.length > 10, `${id} needs both languages`);
    assert.ok(Array.isArray(purpose.usedIn), `${id} must state which steps read it, even if none`);
  }

  // A source claimed to be read by a step has to be referenced by the code that
  // runs it, or the page is describing an integration that does not exist.
  const { readFile } = await import("node:fs/promises");
  let code = "";
  for (const file of ["grounding.js", "lookup.js", "briefing.js", "ownership.js", "clearance.js", "analysis-path.js"]) {
    code += await readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
  }
  const claimedButAbsent = Object.entries(SOURCE_PURPOSE)
    .filter(([id, purpose]) => purpose.usedIn.length && !code.includes(`"${id}"`) && !/^methodology:/.test(purpose.usedIn[0]))
    .map(([id]) => id);
  assert.deepEqual(claimedButAbsent, [], `claimed as read but not referenced in the analysis: ${claimedButAbsent.join(", ")}`);
});

test("the official screening API is optional and degrades to the local snapshot", async () => {
  // A screening tool must not silently depend on a service it may not reach —
  // and developer.trade.gov has served an expired certificate since 2026-07-28,
  // so nobody can obtain a key at the moment. Without one, nothing changes.
  const { isConfigured, searchName, CREDENTIAL } = await import("../src/data-layer/csl-search.js");
  const previous = process.env[CREDENTIAL];
  delete process.env[CREDENTIAL];

  try {
    assert.equal(isConfigured(), false);
    assert.equal(await searchName("Huawei Technologies"), null,
      "with no key it does not call out, and does not pretend to have looked");

    // Screening still works, from the local snapshot, exactly as before.
    const { assessScenario } = await import("../src/orchestrator.js");
    const result = await assessScenario({ question: "请对交易方 Huawei Technologies 做受限方筛查", locale: "zh", mock: true });
    assert.ok(result.grounding.screening?.screenedSources?.length, "the local screening is unaffected");
    assert.equal(result.grounding.screening.official, null);
  } finally {
    if (previous === undefined) delete process.env[CREDENTIAL];
    else process.env[CREDENTIAL] = previous;
  }

  // And the page can say the option exists without it being switched on.
  const { SOURCE_PURPOSE } = await import("../src/source-purpose.js");
  const optional = SOURCE_PURPOSE["trade-csl"].optionalApi;
  assert.equal(optional.credential, CREDENTIAL);
  assert.match(optional.zh, /未配置时功能不减/);
});

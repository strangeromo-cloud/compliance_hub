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

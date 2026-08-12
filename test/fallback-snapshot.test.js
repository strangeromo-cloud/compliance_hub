import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readNormalized } from "../src/data-layer/storage.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FALLBACK_DIR = join(ROOT, "data", "fallback");

test("the bundled fallback covers the PRC sources that a host may not reach", async () => {
  const files = await readdir(FALLBACK_DIR);
  for (const sourceId of ["china-dual-use", "china-control-entities", "china-unreliable-entity", "china-licence-catalogue"]) {
    assert.ok(files.includes(`${sourceId}.json`), `${sourceId} has no bundled fallback`);
  }
});

// Gzipped or plain — a sanctions list is tens of thousands of records and goes
// to a tenth compressed, which is what let three of them be committed at all.
// The claims a fallback has to make are the same either way, so the test reads
// both forms rather than the compressed ones getting a pass by being unreadable.
const readSnapshot = async (file) => JSON.parse(file.endsWith(".gz")
  ? gunzipSync(await readFile(join(FALLBACK_DIR, file))).toString("utf8")
  : await readFile(join(FALLBACK_DIR, file), "utf8"));

test("every bundled snapshot declares itself as a point-in-time copy", async () => {
  const files = await readdir(FALLBACK_DIR);
  assert.ok(files.length, "there is at least one bundled snapshot to check");
  for (const file of files) {
    const snapshot = await readSnapshot(file);
    assert.equal(snapshot.provenance, "bundled_fallback_snapshot", file);
    assert.ok(snapshot.bundledAt, `${file} must record when it was captured`);
    assert.match(snapshot.note, /point-in-time|superseded/i, file);
    assert.ok(snapshot.records.length > 0, file);
  }
});

test("a snapshot read from the bundle is tagged, never returned as a live sync", async () => {
  // china-control-entities may or may not be synced on this machine; either way
  // the provenance must be stated rather than left ambiguous.
  const snapshot = await readNormalized("china-control-entities");
  assert.ok(snapshot, "expected either a live snapshot or the bundled fallback");
  assert.ok(["live_sync", "bundled_fallback_snapshot"].includes(snapshot.provenance));
  if (snapshot.provenance === "bundled_fallback_snapshot") assert.equal(snapshot.isFallback, true);
});

test("a source with neither a live sync nor a bundle returns null rather than empty data", async () => {
  assert.equal(await readNormalized("source-that-does-not-exist"), null);
});

test("designated entities survive the round trip into the bundle", async () => {
  const snapshot = JSON.parse(await readFile(join(FALLBACK_DIR, "china-control-entities.json"), "utf8"));
  const entities = snapshot.records.filter((record) => record.recordType !== "notice");
  assert.ok(entities.length >= 100, `expected a substantive entity set, got ${entities.length}`);
  for (const entity of entities) {
    assert.ok(entity.entityName, "every designation needs a name");
    assert.equal(entity.matchDisposition, "potential_match_requires_identity_review");
  }
  // The parser self-check must still hold in the bundled copy.
  for (const notice of snapshot.records.filter((record) => record.recordType === "notice" && record.declaredEntityCount)) {
    assert.equal(notice.extractionComplete, true, `${notice.noticeNumber} extraction is incomplete in the bundle`);
  }
});

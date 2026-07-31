// Refresh the bundled PRC snapshots from a host that can actually reach MOFCOM.
//
// The hosted deployment cannot: its boot log is nothing but ETIMEDOUT to
// 211.88.32.x, and no code change fixes a route that does not exist. The
// committed point-in-time copies in data/fallback are what stand in, so their
// freshness is now a thing somebody does deliberately rather than a thing that
// quietly rots.
//
//   npm run refresh-fallback            every PRC source that has an adapter
//   npm run refresh-fallback -- china-dual-use
//
// Two rules it will not break:
//
//   1. A fallback is only ever written from a live sync. Writing one from
//      another fallback would launder a stale copy into a fresher-looking date,
//      which is the single worst thing this file could do.
//
//   2. A source that fails to sync keeps the copy it already has. A failed
//      refresh must not leave a source with less than it started with.

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_SOURCE_REGISTRY } from "../src/data-source-registry.js";
import { ADAPTERS } from "../src/data-layer/adapters.js";
import { syncSource } from "../src/data-layer/service.js";
import { readNormalized } from "../src/data-layer/storage.js";
import { closeDb } from "../src/data-layer/db.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FALLBACK_DIR = join(ROOT, "data", "fallback");

const NOTE = "Committed fallback used only when the official source cannot be reached from the host. "
  + "It is a point-in-time copy and may be superseded by later notices; re-sync before relying on it.";

const digest = (records) => createHash("sha256").update(JSON.stringify(records)).digest("hex").slice(0, 12);

async function existing(sourceId) {
  try { return JSON.parse(await readFile(join(FALLBACK_DIR, `${sourceId}.json`), "utf8")); }
  catch { return null; }
}

const requested = process.argv.slice(2).filter((argument) => !argument.startsWith("-"));
const targets = DATA_SOURCE_REGISTRY
  .filter((source) => source.country === "CN" && ADAPTERS[source.sourceId]?.sync)
  .map((source) => source.sourceId)
  .filter((sourceId) => !requested.length || requested.includes(sourceId));

if (!targets.length) {
  console.error(requested.length ? `No PRC source with a sync adapter matches: ${requested.join(", ")}` : "No PRC sources with sync adapters.");
  process.exit(1);
}

console.log(`Refreshing ${targets.length} bundled PRC snapshot(s) from this host.\n`);

const outcomes = [];
for (const sourceId of targets) {
  const before = await existing(sourceId);
  process.stdout.write(`  ${sourceId.padEnd(30)}`);
  try {
    await syncSource(sourceId);
    const snapshot = await readNormalized(sourceId);
    // The guard that matters: readNormalized falls through to the bundled copy
    // when nothing was synced, so without this a failed sync would rewrite the
    // fallback from itself and stamp it with today's date.
    if (snapshot?.provenance !== "live_sync") throw new Error("sync reported success but no live snapshot is stored");
    if (!snapshot.records?.length) throw new Error("live snapshot contains no records");

    await writeFile(join(FALLBACK_DIR, `${sourceId}.json`), `${JSON.stringify({
      sourceId,
      capturedAt: snapshot.capturedAt,
      metadata: snapshot.metadata,
      records: snapshot.records,
      provenance: "bundled_fallback_snapshot",
      bundledAt: snapshot.capturedAt,
      note: NOTE
    }, null, 2)}\n`);

    const changed = !before || digest(before.records) !== digest(snapshot.records);
    const delta = before ? snapshot.records.length - before.records.length : null;
    console.log(`ok  ${String(snapshot.records.length).padStart(5)} records  ${
      before ? (changed ? `CHANGED${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : " (same count, different content)"}` : "unchanged") : "new"}`);
    outcomes.push({ sourceId, status: "ok", records: snapshot.records.length, changed });
  } catch (error) {
    const message = String(error.message || error).slice(0, 90);
    console.log(`FAILED  ${message}`);
    console.log(`  ${"".padEnd(30)}kept the existing copy${before ? ` (${before.records.length} records from ${String(before.bundledAt).slice(0, 10)})` : " — there is none"}`);
    outcomes.push({ sourceId, status: "failed", error: message, hadCopy: Boolean(before) });
  }
}

const ok = outcomes.filter((item) => item.status === "ok");
const changed = ok.filter((item) => item.changed);
const failed = outcomes.filter((item) => item.status === "failed");

console.log(`\n${ok.length} refreshed, ${changed.length} with new content, ${failed.length} failed.`);
if (ok.length) {
  // Worth committing even when no record changed: the date is the claim "this
  // was checked against the official source on that day", and a copy verified
  // today is not the same artefact as one last seen in July, whatever it
  // contains.
  console.log(changed.length
    ? `New content in: ${changed.map((item) => item.sourceId).join(", ")}. Commit data/fallback and deploy.`
    : "No records changed; the capture dates advanced. Commit data/fallback anyway — the date records that these were verified against the source today.");
}
if (failed.some((item) => !item.hadCopy)) {
  console.log(`\nNo copy at all for: ${failed.filter((item) => !item.hadCopy).map((item) => item.sourceId).join(", ")}`);
  console.log("Those sources are absent on any host that cannot reach them. Re-run from a host that can.");
}
if (failed.length) console.log("\nPRC hosts refuse or time out intermittently; re-running usually gets a different subset.");

closeDb();
process.exit(ok.length ? 0 : 1);

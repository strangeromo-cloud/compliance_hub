import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOwnershipGraph } from "../src/data-layer/adapters-ownership.js";

// One entity per line, entities and the edges between them in the same stream —
// which is why this reads the FollowTheMoney graph rather than the flat CSV the
// other OpenSanctions sources use. That CSV has no relationships in it at all.
const line = (obj) => JSON.stringify(obj);
const GRAPH = [
  line({ id: "own-1", schema: "Ownership", properties: { owner: ["p-1"], asset: ["p-2"], role: ["Owned or Controlled By"] } }),
  line({ id: "own-2", schema: "Ownership", properties: { owner: ["p-1"], asset: ["p-3"] } }),
  // An edge whose ends are not in this dataset says nothing that can be read.
  line({ id: "own-3", schema: "Ownership", properties: { owner: ["missing"], asset: ["p-2"] } }),
  line({ id: "p-1", schema: "Company", properties: { name: ["Designated Holding"], country: ["ir"], alias: ["DH"] } }),
  line({ id: "p-2", schema: "Organization", properties: { name: ["Held Co"], country: ["ae"] } }),
  line({ id: "p-3", schema: "Organization", properties: { name: ["Unlisted Sub"] } }),
  line({ id: "s-1", schema: "Sanction", properties: { entity: ["p-1", "p-2"] } })
].join("\n");

test("ownership edges are resolved to the names at both ends", () => {
  const records = parseOwnershipGraph(GRAPH);
  assert.equal(records.length, 2, "an edge with an end outside the dataset is dropped, not half-written");

  const [first] = records;
  // The owned company is what a reader screens, so it is the record's name.
  assert.equal(first.entityName, "Held Co");
  assert.equal(first.ownerName, "Designated Holding");
  assert.equal(first.role, "Owned or Controlled By");
  assert.equal(first.country, "ae");
  // A Sanction attached to a party is what makes it designated, and that is the
  // difference between "a company owns another" and "a designated party owns
  // this company" — the only version worth reporting.
  assert.equal(first.ownerDesignated, true);
  assert.equal(first.assetDesignated, true);
  assert.equal(records[1].assetDesignated, false, "an unlisted end must not be assumed designated");
  // An edge with no role still says what it is.
  assert.equal(records[1].role, "Owned or Controlled By");
});

test("no ownership edge is presented as a share", async () => {
  // The 50 Percent Rule turns on percentages and this source has none — not one
  // of OFAC's 5,047 edges carries a share. A field that quietly defaulted to a
  // number would be the single most dangerous thing this file could do.
  const records = parseOwnershipGraph(GRAPH);
  assert.ok(records.every((record) => record.percentage === null));

  const { SOURCE_PURPOSE } = await import("../src/source-purpose.js");
  const purpose = SOURCE_PURPOSE["ofac-ownership"];
  // Both languages have to say what it cannot do, because a source that looks
  // like it answers the question is worse than one that is absent.
  assert.match(purpose.zh, /50%|持股比例/);
  assert.match(purpose.en, /50 Percent Rule|percentage/);
  assert.ok(purpose.usedIn.includes("ownership"));

  const { DATA_SOURCE_REGISTRY } = await import("../src/data-source-registry.js");
  const entry = DATA_SOURCE_REGISTRY.find((source) => source.sourceId === "ofac-ownership");
  assert.equal(entry.commercialUseBlocked, true, "CC-BY-NC travels with the data");
  assert.match(entry.notes, /cannot compute aggregate holdings|No percentages/i);
});

test("a stated relationship is read from either end", async () => {
  // A reader wants to know who holds this party and what this party holds, and
  // one query should answer both.
  const { statedOwnership } = await import("../src/ownership.js");
  const { readNormalized, saveSourceData } = await import("../src/data-layer/storage.js");
  const { db } = await import("../src/data-layer/db.js");

  // saveSourceData replaces a source outright, so whatever this machine had
  // synced is read out first and written back afterwards. A test that quietly
  // empties a real source leaves the next run screening against nothing.
  const existing = await readNormalized("ofac-ownership").catch(() => null);
  await saveSourceData({
    sourceId: "ofac-ownership", extension: "json", bytes: Buffer.from(GRAPH, "utf8"),
    records: parseOwnershipGraph(GRAPH), metadata: {}
  });
  try {
    const held = await statedOwnership("Held Co");
    assert.equal(held.hits.length, 1);
    assert.equal(held.hits[0].side, "owned_by");
    assert.equal(held.hits[0].owner, "Designated Holding");
    assert.match(held.meaning, /不含持股比例/);

    const holder = await statedOwnership("Designated Holding");
    assert.equal(holder.hits.length, 2);
    assert.ok(holder.hits.every((hit) => hit.side === "owns"));

    assert.equal(await statedOwnership("Someone Else Ltd"), null, "no relationship is not an empty one");
    assert.equal(await statedOwnership("ab"), null, "a fragment is not a query");
  } finally {
    if (existing?.records?.length && existing.provenance !== "bundled_fallback_snapshot") {
      await saveSourceData({
        sourceId: "ofac-ownership", extension: "json", bytes: Buffer.from("restored", "utf8"),
        records: existing.records, metadata: {}
      });
    } else {
      db().prepare("DELETE FROM records WHERE source_id = 'ofac-ownership'").run();
      db().prepare("DELETE FROM snapshots WHERE source_id = 'ofac-ownership'").run();
    }
  }
});

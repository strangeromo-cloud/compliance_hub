import { strict as assert } from "node:assert";
import test from "node:test";
import { DATA_SOURCE_REGISTRY } from "../src/data-source-registry.js";
import { OPENSANCTIONS_SETS } from "../src/data-layer/adapters-os.js";
import { ADAPTERS } from "../src/data-layer/adapters.js";

test("every OpenSanctions source declares its licence and its commercial limit", () => {
  // CC-BY-NC is a real constraint on what this data may be used for. A constraint
  // that only lives in a comment is one nobody sees, so it is a field, and the
  // interface renders it.
  assert.ok(!Object.keys(OPENSANCTIONS_SETS).includes("tw-shtc"),
    "Taiwan comes from the issuing ministry, not the mirror — the mirror has fewer rows and a stricter licence");
  for (const sourceId of Object.keys(OPENSANCTIONS_SETS)) {
    const source = DATA_SOURCE_REGISTRY.find((item) => item.sourceId === sourceId);
    assert.ok(source, `${sourceId} is not in the registry`);
    assert.equal(source.licence, "CC-BY-NC 4.0", `${sourceId} must state its licence`);
    assert.equal(source.commercialUseBlocked, true, `${sourceId} must state the commercial limit`);
    assert.match(source.attribution || "", /OpenSanctions/, `${sourceId} must carry the required attribution`);
    assert.equal(source.officialSource, false, `${sourceId} is a mirror, not the issuing authority`);
    assert.ok(ADAPTERS[sourceId]?.sync, `${sourceId} has no sync adapter`);
  }
});

test("a CSV whose shape has changed fails loudly rather than screening clean", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  // Rows parse, but the name column is gone. Silently producing zero records
  // would present a list that matches nothing as a list that found nothing.
  globalThis.fetch = async () => new Response(
    "\"id\",\"schema\",\"full_name\"\n\"a\",\"Company\",\"Some Entity\"\n",
    { status: 200, headers: { "content-type": "text/csv" } }
  );
  await assert.rejects(() => ADAPTERS["eu-fsf"].sync(), /shape has changed/);
});

test("targets are normalized into the shape screening already understands", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => new Response(
    '"id","schema","name","aliases","countries","addresses","identifiers","program_ids","dataset","first_seen","last_seen","last_change"\n'
    + '"NK-1","Company","Huawei Device Co., Ltd.","Huawei Device;Shenzhen Huawei","cn","Bantian, Shenzhen","91440300","prog-1","Taiwan SHTC","2025-08-09","2026-07-30","2025-12-11"\n',
    { status: 200, headers: { "content-type": "text/csv" } }
  );
  const { records, syncScope } = await ADAPTERS["eu-fsf"].sync();
  assert.equal(records.length, 1);
  const [record] = records;
  assert.equal(record.entityName, "Huawei Device Co., Ltd.");
  assert.deepEqual(record.aliases, ["Huawei Device", "Shenzhen Huawei"]);
  assert.deepEqual(record.countries, ["cn"]);
  assert.equal(record.matchDisposition, "potential_match_requires_review");
  assert.equal(record.licence, "CC-BY-NC 4.0");
  // OpenSanctions' dates are about its own observation, not the designation, and
  // must not be readable as "listed on".
  assert.equal(record.firstObservedAt, "2025-08-09");
  assert.equal(record.designatedOn, undefined);
  assert.match(syncScope, /opensanctions_eu_fsf/);
});

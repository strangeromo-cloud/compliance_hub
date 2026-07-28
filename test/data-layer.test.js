import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, rowsToObjects, xmlTag, xmlTags } from "../src/data-layer/parsers.js";
import { getDataSourceCoverage } from "../src/data-layer/service.js";

test("CSV parser preserves quoted commas, quotes, and line breaks", () => {
  const rows = parseCsv('id,name,notes\n1,"Acme, Ltd.","line 1\nline 2"\n2,"A ""quoted"" name",ok\n');
  const records = rowsToObjects(rows);
  assert.equal(records[0].name, "Acme, Ltd.");
  assert.equal(records[0].notes, "line 1\nline 2");
  assert.equal(records[1].name, 'A "quoted" name');
});

test("XML helpers extract repeated official-list blocks", () => {
  const xml = "<root><ENTITY><NAME>A &amp; B</NAME></ENTITY><ENTITY><NAME>C</NAME></ENTITY></root>";
  const blocks = xmlTags(xml, "ENTITY");
  assert.equal(blocks.length, 2);
  assert.equal(xmlTag(blocks[0], "NAME"), "A & B");
});

test("coverage API exposes implemented, syncable, queryable, and credential states", async () => {
  const coverage = await getDataSourceCoverage();
  const csl = coverage.sources.find((source) => source.sourceId === "trade-csl");
  const sam = coverage.sources.find((source) => source.sourceId === "sam-exclusions");
  const manual = coverage.sources.find((source) => source.sourceId === "china-company-registry");
  assert.equal(csl.adapter.syncable, true);
  assert.equal(sam.adapter.queryable, true);
  assert.equal(sam.adapter.credential, "SAM_GOV_API_KEY");
  assert.equal(manual.adapter.implemented, false);
  assert.ok(coverage.syncCounts.not_synced >= 1 || coverage.syncCounts.success >= 1);
});

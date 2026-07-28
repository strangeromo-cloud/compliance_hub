import test from "node:test";
import assert from "node:assert/strict";
import { ADAPTERS } from "../src/data-layer/adapters.js";
import { DATA_SOURCE_REGISTRY } from "../src/data-source-registry.js";
import { findBom, findProducts, internalMasterSummary, loadSeed, manufacturerFactsFor } from "../src/internal-data.js";

test("every adapter maps to a registered data source and vice versa", () => {
  const registered = new Set(DATA_SOURCE_REGISTRY.map((source) => source.sourceId));
  for (const sourceId of Object.keys(ADAPTERS)) {
    assert.ok(registered.has(sourceId), `adapter ${sourceId} has no registry entry`);
  }
});

test("the China export-control sources all have implemented adapters", () => {
  for (const sourceId of ["china-dual-use", "china-control-entities", "china-unreliable-entity", "china-licence-catalogue"]) {
    assert.ok(ADAPTERS[sourceId]?.sync, `${sourceId} has no sync adapter`);
  }
});

test("the EAR parts needed before a licence conclusion are all ingestible", () => {
  for (const sourceId of ["bis-ear-734", "bis-ear-740", "bis-ear-744", "bis-ccl", "bis-country-chart"]) {
    assert.ok(ADAPTERS[sourceId]?.sync, `${sourceId} has no sync adapter`);
  }
});

test("internal master data is present and labelled as synthetic throughout", async () => {
  const summary = await internalMasterSummary();
  assert.equal(summary.available, true, "run: node scripts/generate-seed.mjs");
  assert.ok(summary.counts.products >= 300);
  assert.ok(summary.counts.businessPartners >= 200);

  for (const name of ["products", "business-partners", "vendors", "transactions", "bom"]) {
    const file = await loadSeed(name);
    assert.equal(file.dataClass, "synthetic", `${name} envelope`);
    assert.match(file.disclaimer, /SYNTHETIC DEMO DATA/);
    assert.equal(file.recordCount, file.records.length);
    for (const record of file.records) assert.equal(record.dataClass, "synthetic", `${name} record ${record.partNumber || record.partyId || record.documentId}`);
  }
});

test("synthetic classifications are marked unverified so they cannot be quoted as real", async () => {
  const products = await loadSeed("products");
  for (const product of products.records) {
    assert.equal(product.classificationConfidence, "unverified_demo_value", product.partNumber);
  }
});

test("the scenario fixtures required by the test matrix are all seeded", async () => {
  const [partners, vendors, products, transactions] = await Promise.all([
    loadSeed("business-partners"), loadSeed("vendors"), loadSeed("products"), loadSeed("transactions")
  ]);
  const refs = new Set([...partners.records, ...vendors.records, ...products.records, ...transactions.records]
    .map((record) => record.scenarioRef).filter(Boolean).flatMap((ref) => ref.split("/")));
  for (const scenario of ["T02", "T03", "P01", "P02", "P03", "D01", "D02", "D03", "X01", "X02", "X03", "DM01"]) {
    assert.ok(refs.has(scenario), `scenario ${scenario} has no seeded fixture`);
  }
});

test("the de minimis fixture actually sits above the threshold it is meant to exercise", async () => {
  const [product] = await findProducts("TS-6200-DM");
  assert.ok(product.usContentPercent > 25, "US controlled content should exceed the de minimis threshold");
  assert.equal(product.originCountry, "CN");
  const bom = await findBom("TS-6200-DM");
  assert.ok(bom.levels.some((level) => level.origin === "US" && level.eccnUs !== "EAR99"));
});

test("manufacturer classification facts resolve from the reference file, not from a prompt string", async () => {
  const facts = await manufacturerFactsFor("H100 PCIe 的 TPP 是多少");
  assert.equal(facts.length, 1);
  assert.equal(facts[0].tppPerGpu, 12224);
  assert.equal(facts[0].eccn, "4A090.a");
  assert.equal(facts[0].appValueAvailable, false, "the manufacturer table publishes TPP per GPU, not APP");
});

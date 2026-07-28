import test from "node:test";
import assert from "node:assert/strict";
import { DATA_SOURCE_REGISTRY, dataSourceCoverage } from "../src/data-source-registry.js";

const allowedAutomationStatuses = new Set(["api_available", "download_available", "scraping_available", "manual_only", "blocked", "not_started"]);
const allowedFeasibility = new Set(["can_build_now", "can_build_with_limitations", "manual_only", "not_recommended"]);

test("data source registry uses the approved automation and feasibility vocabularies", () => {
  for (const source of DATA_SOURCE_REGISTRY) {
    assert.ok(allowedAutomationStatuses.has(source.automationStatus), `${source.sourceId} automation status`);
    assert.ok(allowedFeasibility.has(source.feasibility), `${source.sourceId} feasibility`);
    assert.match(source.websiteUrl, /^https:\/\//);
    assert.ok(Array.isArray(source.dataCaptured));
    assert.ok(Array.isArray(source.targetData));
  }
});

test("coverage summary distinguishes real current capability from planned sources", () => {
  const coverage = dataSourceCoverage();
  assert.equal(coverage.counts.total, DATA_SOURCE_REGISTRY.length);
  assert.ok(coverage.counts.query_context > 0);
  assert.ok(coverage.counts.verified_lookup > 0);
  assert.ok(coverage.counts.planned > 0);
  assert.match(coverage.importantDisclosure, /raw official-source snapshot/i);
});

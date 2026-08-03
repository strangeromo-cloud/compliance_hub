import { test } from "node:test";
import assert from "node:assert/strict";

test("every capability names the provision that makes its answer binding", async () => {
  // A capability that cannot cite a rule is this system's opinion wearing an
  // agent's name. The registry checks itself at load, so this is the guard on
  // the guard — and on the parts a load-time check cannot see.
  const { CAPABILITIES, describeCapabilities } = await import("../src/agent-capabilities.js");

  for (const [id, capability] of Object.entries(CAPABILITIES)) {
    assert.ok(capability.cite, `${id} must cite a provision`);
    assert.ok(capability.title.zh && capability.title.en, `${id} needs both languages`);
    assert.ok(capability.summary.zh && capability.summary.en, `${id} needs a summary in both`);
    assert.ok(id.startsWith(`${capability.provider}.`), `${id} must be namespaced under its lane`);
    for (const field of capability.input) {
      assert.ok(field.name && field.type, `${id} input must be named and typed`);
      assert.ok(field.zh && field.en, `${id} input ${field.name} needs both languages`);
    }
  }

  // The catalogue is what a published tool list would state, so it has to be
  // serialisable and carry the provision with it — a capability must not be
  // exposable without the rule that makes its answer binding.
  for (const locale of ["zh", "en"]) {
    const listed = describeCapabilities(locale);
    assert.equal(listed.length, Object.keys(CAPABILITIES).length);
    assert.deepEqual(JSON.parse(JSON.stringify(listed)), listed, "the catalogue must be plain JSON");
    for (const entry of listed) {
      assert.ok(entry.cite && entry.title && entry.summary && entry.providerName, `${entry.id} in ${locale}`);
      assert.ok(Array.isArray(entry.input));
    }
  }
});

test("a capability is pure over its declared inputs", async () => {
  // run() takes named arguments rather than reaching into a run's context. That
  // is what lets the same capability be served outside this process later
  // without being rewritten — only the adapter that fills the inputs changes.
  const { invokeCapability } = await import("../src/agent-capabilities.js");

  const clean = invokeCapability("trade.party_status", {
    caller: "test", args: { matches: [], parentHits: [], sourcesSearched: 9 }
  });
  assert.equal(clean.answer, "no_match");
  assert.match(clean.zh, /9 个/);
  assert.match(clean.en, /9 synced/);

  const listed = invokeCapability("trade.party_status", {
    caller: "test", args: { matches: [{ entityName: "Designated Co" }], parentHits: [], sourcesSearched: 9 }
  });
  assert.equal(listed.answer, "potential_match");
  assert.equal(listed.subject, "Designated Co");

  // A screening that could not run is not a screening that found nothing, and
  // the caller has to be able to tell those apart before relying on "no match".
  const unsearched = invokeCapability("trade.party_status", {
    caller: "test", args: { matches: [], parentHits: [], sourcesSearched: 0 }
  });
  assert.equal(unsearched.answer, "not_searched");

  // Silence about the item resolves the jurisdiction question in neither
  // direction.
  assert.equal(invokeCapability("product.item_jurisdiction", { args: {} }).answer, "unknown");
  assert.equal(invokeCapability("product.item_jurisdiction", { args: { usContent: "< 10%" } }).answer, "not_subject");
  assert.equal(invokeCapability("product.item_jurisdiction", { args: { eccn: "4A090.a" } }).answer, "subject");
});

test("a call records who was asked, what they said, and under which rule", async () => {
  const { invokeCapability } = await import("../src/agent-capabilities.js");
  const call = invokeCapability("product.item_jurisdiction", {
    caller: "name_match", args: { eccn: "4A090.a" }
  });
  assert.equal(call.caller, "name_match");
  assert.equal(call.provider, "product");
  assert.match(call.line.zh, /调用 产品出口管制 Agent/);
  assert.match(call.line.zh, /§ 734\.3/);
  assert.match(call.line.en, /Asked the product export control agent/);
  assert.match(call.line.en, /§ 734\.3/);
});

test("a capability may not depend on its own answer", async () => {
  const { invokeCapability } = await import("../src/agent-capabilities.js");
  assert.throws(() => invokeCapability("trade.party_status", {
    args: { matches: [], sourcesSearched: 1 }, stack: ["trade.party_status"]
  }), /cycle/i, "a lane asking itself must be refused, not unwound");

  assert.throws(() => invokeCapability("trade.party_status", {
    args: { matches: [], sourcesSearched: 1 }, stack: ["a", "b", "c", "d"]
  }), /too deep/i);

  assert.throws(() => invokeCapability("nope.nothing", { args: {} }), /No such capability/);
  assert.throws(() => invokeCapability("trade.party_status", { args: { matches: [] } }),
    /requires input "sourcesSearched"/, "a declared input is required, not defaulted silently");
});

test("a designated party actually closes the licence exceptions", async () => {
  // The dependency graph could state this rule and nothing enforced it: the
  // licence-exception step went on saying "awaiting an earlier step" while a
  // designated party sat in the same answer. It is a rule, not a judgement, so
  // it is computed rather than left to the model.
  const { planAnalysisPath, resolveAnalysisPath } = await import("../src/analysis-path.js");
  const { localizeLines } = await import("../src/path-i18n.js");
  const question = "客户 Designated Co，请做受限方筛查与产品出口";
  const grounding = {
    screening: { screenedSources: [{ sourceId: "trade-csl", recordCount: 3, capturedAt: "2026-07-31" }], unsyncedSources: [] },
    listMatches: [{ entityName: "Designated Co", matchScore: 1, matchBasis: "normalized_name_identical", sourceId: "trade-csl" }],
    internalParties: [], limitations: [], partyCandidates: []
  };
  const facts = { eccn: "4A090.a" };

  const path = resolveAnalysisPath(
    planAnalysisPath({ agents: ["trade", "product"], question, declaredFacts: facts }),
    { question, grounding, declaredFacts: facts, final: true }
  );
  const steps = path.lanes.flatMap((lane) => lane.steps);

  const exception = steps.find((item) => item.id === "licence_exception");
  assert.equal(exception.status, "evidence_needed", "a designated party must reopen this step, not leave it unreached");
  assert.ok(localizeLines(exception.basis, "zh").some((line) => /调用 贸易合规 Agent/.test(line)),
    "and the step must say which lane it asked");
  assert.ok(localizeLines(exception.needs, "en").some((line) => /744\.11/.test(line)),
    "citing the provision that closes the exceptions");

  // The other direction: what a match means depends on the item, so the trade
  // lane asks the product lane rather than assuming.
  const match = steps.find((item) => item.id === "name_match");
  assert.ok(localizeLines(match.basis, "zh").some((line) => /调用 产品出口管制 Agent/.test(line)));

  // And with nothing designated, the step is not forced open on a rule that
  // does not apply.
  const clean = resolveAnalysisPath(
    planAnalysisPath({ agents: ["trade", "product"], question, declaredFacts: facts }),
    { question, grounding: { ...grounding, listMatches: [] }, declaredFacts: facts, final: true }
  );
  const openStep = clean.lanes.flatMap((lane) => lane.steps).find((item) => item.id === "licence_exception");
  assert.notEqual(openStep.status, "evidence_needed");
});

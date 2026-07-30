import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DECLARABLE_FIELDS, planAnalysisPath, resolveAnalysisPath } from "../src/analysis-path.js";

const ALL_LANES = ["trade", "product", "tpdd"];

test("every field a step can ask for is one the server will accept", () => {
  // The regression this pins: the path asked for `endUse` on the general
  // prohibitions step while the server kept its own hand-written allowlist that
  // did not contain it. The answer was dropped on arrival, the step never
  // settled, and the same question came back after a full run.
  const path = planAnalysisPath({ agents: ALL_LANES });
  const asked = new Set(path.lanes.flatMap((lane) => lane.steps.flatMap((step) => step.inputs.map((input) => input.field))));
  const accepted = new Set(DECLARABLE_FIELDS);
  const missing = [...asked].filter((field) => !accepted.has(field));
  assert.deepEqual(missing, [], `fields asked for but not accepted: ${missing.join(", ")}`);
});

test("the server derives its allowlist rather than restating it", async () => {
  // A second copy of this list is what drifted. If one is ever written out
  // again, this fails before the mismatch can reach a user.
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.match(source, /DECLARABLE_FIELDS/, "server.js should import the field list");
  assert.ok(
    !/new Set\(\[\s*"legalName"/.test(source),
    "server.js should not contain a hand-written copy of the declarable fields"
  );
});

test("a declared value moves its step off evidence_needed", () => {
  const grounding = { screening: { screenedSources: [], unsyncedSources: [] }, facts: [], listMatches: [], internalParties: [], limitations: [] };
  const question = "我们计划向一家新加坡代理商出口高性能计算服务器，最终用户在中国";
  const before = resolveAnalysisPath(planAnalysisPath({ agents: ALL_LANES }), { question, grounding, declaredFacts: {}, final: true });
  const blocked = before.lanes.flatMap((lane) => lane.steps).filter((step) => step.status === "evidence_needed");
  assert.ok(blocked.length, "the fixture should leave something to declare");

  // Answer every question the path asks, using the fields it asks them under.
  const declaredFacts = Object.fromEntries(blocked.flatMap((step) => step.inputs.map((input) => [input.field, "已提供"])));
  const after = resolveAnalysisPath(planAnalysisPath({ agents: ALL_LANES }), { question, grounding, declaredFacts, final: true });

  for (const step of blocked) {
    const now = after.lanes.flatMap((lane) => lane.steps).find((item) => item.id === step.id);
    if (!step.inputs.length) continue;
    assert.notEqual(now.status, "evidence_needed",
      `${step.title} was answered through ${step.inputs.map((i) => i.field).join(", ")} but is still asking`);
  }
});

test("the run stops at the first question a user can answer", async () => {
  const { assessScenario } = await import("../src/orchestrator.js");
  const question = "我们计划向一家新加坡代理商出口高性能计算服务器，最终用户在中国，由一家咨询公司代为付款";

  const stopped = await assessScenario({ question, locale: "zh", mock: true });
  assert.ok(stopped.awaitingInput, "a run with an unanswered question should be waiting");
  assert.equal(stopped.synthesis, null, "no conclusion is drawn over a gap the run stopped at");
  // The question was already knowable from retrieval, so no specialist was spent
  // on arriving at it.
  assert.equal(stopped.results.length, 0, "no specialist runs to reach a question already on the path");

  const asked = stopped.analysisPath.lanes.flatMap((lane) => lane.steps).find((step) => step.id === stopped.awaitingInput.step);
  assert.equal(asked.status, "evidence_needed");
  assert.ok(asked.inputs.length, "the step it stopped at is one the user can actually answer");
});

test("answering every question lets the run reach a conclusion", async () => {
  const { assessScenario } = await import("../src/orchestrator.js");
  const question = "我们计划向一家新加坡代理商出口高性能计算服务器，最终用户在中国，由一家咨询公司代为付款";
  const declaredFacts = Object.fromEntries(DECLARABLE_FIELDS.map((field) => [field, "已提供"]));

  const done = await assessScenario({ question, locale: "zh", mock: true, declaredFacts });
  assert.equal(done.awaitingInput, null, "nothing left to ask");
  assert.ok(done.synthesis, "a conclusion is drawn once the run finishes");
  assert.equal(done.results.length, 3, "every lane ran");
});

test("triage only shortens a path on a stated fact and a stated provision", async () => {
  const { planAnalysisPath: plan, resolveAnalysisPath: resolve } = await import("../src/analysis-path.js");
  const grounding = { screening: { screenedSources: [], unsyncedSources: [] }, facts: [], listMatches: [], internalParties: [], limitations: [] };
  const q = "我们直销一台服务器给德国最终用户，无中间商";

  // EAR99 closes the Country Chart and licence exception, because neither arises
  // for an item with no ECCN — and says so with the provision.
  const path = resolve(plan({ agents: ["trade", "product"], question: q, declaredFacts: { eccn: "EAR99" } }),
    { question: q, grounding, declaredFacts: { eccn: "EAR99" }, final: true });
  const steps = path.lanes.flatMap((lane) => lane.steps);
  for (const id of ["destination_chart", "licence_exception"]) {
    const step = steps.find((item) => item.id === id);
    assert.equal(step.status, "not_applicable", `${id} should not arise for EAR99`);
    assert.match(step.basis[0], /EAR99/);
    assert.match(step.basis[0], /依据/, "a dropped step must cite the rule that dropped it");
  }
  // The general prohibitions do not depend on classification, so they stay.
  assert.notEqual(steps.find((item) => item.id === "prohibitions").status, "not_applicable");
});

test("an undecidable fact never shortens the path", async () => {
  const { planAnalysisPath: plan, resolveAnalysisPath: resolve } = await import("../src/analysis-path.js");
  const grounding = { screening: { screenedSources: [], unsyncedSources: [] }, facts: [], listMatches: [], internalParties: [], limitations: [] };
  const q = "我们通过代理商出口一台服务器";
  // "不确定" is an answer that decides nothing; the steps must all stand.
  const path = resolve(plan({ agents: ["trade", "product", "tpdd"], question: q, declaredFacts: { usContent: "不确定", eccn: "" } }),
    { question: q, grounding, declaredFacts: { usContent: "不确定" }, final: true });
  const dropped = path.lanes.flatMap((lane) => lane.steps).filter((item) => item.status === "not_applicable" && item.id !== "identity_resolution");
  assert.deepEqual(dropped, [], "nothing may be dropped on an undecided fact");
  assert.ok(path.lanes.some((lane) => lane.lane === "tpdd"), "the third-party lane stays when a third party is mentioned");
});

test("triage never leaves a question with nothing to analyse", async () => {
  const { planAnalysisPath: plan } = await import("../src/analysis-path.js");
  // Routed to tpdd alone, and then the same sentence closes the third-party gate.
  const path = plan({ agents: ["tpdd"], question: "本次交易没有代理商、经销商或中介" });
  const analysisLanes = path.lanes.filter((lane) => lane.lane !== "review");
  assert.ok(analysisLanes.length, "a narrowed review is still a review");
});

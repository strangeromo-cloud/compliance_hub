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
    // In both languages: a shortened path has to explain itself to whoever is
    // reading it, and the explanation was written in Chinese only.
    assert.match(step.basis[0].zh, /EAR99/);
    assert.match(step.basis[0].en, /EAR99/);
    assert.match(step.basis[0].zh, /依据 § 738\.3/, "a dropped step must cite the rule that dropped it");
    assert.match(step.basis[0].en, /under § 738\.3/, "and cite it in English too");
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

// A conversation, driven the way a user drives one: answer or decline whatever is
// asked, and require that it always ends. These pin the four ways the flow broke.
async function walk(question, { mode = "answer", cap = 20 } = {}) {
  const { assessScenario } = await import("../src/orchestrator.js");
  const declaredFacts = {};
  const unavailableFacts = [];
  const asked = [];
  for (let round = 0; round < cap; round += 1) {
    const result = await assessScenario({ question, locale: "zh", mock: true, declaredFacts, unavailableFacts });
    if (!result.awaitingInput) return { asked, concluded: Boolean(result.synthesis), result };
    const steps = result.analysisPath.lanes.flatMap((lane) => lane.steps.map((step) => ({ step, lane: lane.lane })));
    const found = steps.find((item) => item.step.id === result.awaitingInput.step);
    // The step being asked about must be one the page can draw, or the run has
    // stopped on a question that is nowhere on screen.
    assert.ok(found, `${result.awaitingInput.step} is not in the path it was asked from`);
    assert.equal(found.step.status, "evidence_needed", `${found.step.title} is asked but not drawable`);
    assert.ok(found.step.inputs.length, `${found.step.title} is asked but has nothing to fill in`);
    asked.push(found.lane);
    if (mode === "skip") unavailableFacts.push(...found.step.inputs.map((input) => input.field));
    else for (const input of found.step.inputs) declaredFacts[input.field] = "已提供";
  }
  throw new Error(`did not converge in ${cap} rounds; asked ${asked.join(" → ")}`);
}

const LANE_ORDER = ["trade", "product", "tpdd", "review"];
const TRANSACTION = "我们通过新加坡代理商向中国最终用户出口高性能计算服务器，由咨询公司代为付款";

test("a conversation converges whether questions are answered or declined", async () => {
  for (const mode of ["answer", "skip"]) {
    const { concluded } = await walk(TRANSACTION, { mode });
    assert.ok(concluded, `${mode}: the run must reach a conclusion`);
  }
});

test("declining a question moves the run on instead of asking it again", async () => {
  // The break this pins: declining collapsed the form and did nothing else, so
  // the only way forward was to type something the user had just said they
  // did not have.
  const { asked } = await walk(TRANSACTION, { mode: "skip" });
  assert.ok(asked.length, "something should have been asked");
});

test("questions are asked one lane at a time, in path order", async () => {
  const { asked } = await walk(TRANSACTION);
  const seen = [...new Set(asked)];
  assert.deepEqual(seen, [...seen].sort((left, right) => LANE_ORDER.indexOf(left) - LANE_ORDER.indexOf(right)),
    `lanes were asked out of order: ${seen.join(" → ")}`);
  // And a lane's questions are finished before the next lane is reached.
  const firstOf = seen.map((lane) => asked.indexOf(lane));
  const lastOf = seen.map((lane) => asked.lastIndexOf(lane));
  seen.forEach((lane, index) => {
    if (index === 0) return;
    assert.ok(firstOf[index] > lastOf[index - 1],
      `${lane} was asked before ${seen[index - 1]} was finished`);
  });
});

test("an informational question is answered rather than interrogated", async () => {
  // Stopping these to demand a part number made them unanswerable: the run halted
  // on a question that had nothing to do with what was asked.
  for (const question of ["中国两用物项出口管制的法规依据是什么？", "H100 的 ECCN 是多少？"]) {
    const { assessScenario } = await import("../src/orchestrator.js");
    const result = await assessScenario({ question, locale: "zh", mock: true });
    assert.equal(result.awaitingInput, null, `${question} should not stop to ask`);
    assert.ok(result.synthesis, `${question} should reach a conclusion`);
  }
});

test("history durability is reported, never assumed", async () => {
  // An emptied history has two very different causes — nothing was ever asked,
  // or the disk it was on went away with the container. The page can only tell
  // the difference if the server says which disk it is on.
  const { storageDurability } = await import("../src/case-store.js");
  const state = await storageDurability();
  assert.ok(["boolean", "object"].includes(typeof state.persistent), "persistent is true, false, or null");
  assert.ok(state.reason, "the verdict comes with its ground");
  // Development runs on an ordinary disk, so nothing here may claim otherwise.
  assert.equal(state.persistent, true);
  assert.equal(state.reason, "host_filesystem");

  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.match(source, /historyPersistent: storage\.persistent/, "the capability endpoint must publish it");
});

test("the rail marks the running lane even when its steps are already settled", async () => {
  // Grounding closes the screening steps before the specialist writes a word
  // about them, so a lane can be running with every one of its steps settled.
  // Returning "no current step" then left the rail marking nothing at all while
  // the body showed that lane working — two panels three feet apart disagreeing
  // about whether anything was happening.
  const { currentStepId } = await import("../public/status-vocabulary.js");

  const settled = { lanes: [{ lane: "trade", steps: [
    { id: "identify_party", status: "confirmed" },
    { id: "search_lists", status: "confirmed" }
  ] }] };
  assert.equal(currentStepId(settled, { activeLane: "trade" }), "search_lists",
    "a running lane with nothing open still has to point somewhere");

  // An open step wins over the fallback, because that is where the work is.
  const partly = { lanes: [{ lane: "trade", steps: [
    { id: "identify_party", status: "confirmed" },
    { id: "ownership", status: "evidence_needed", inputs: [{ field: "ownership" }] },
    { id: "search_lists", status: "confirmed" }
  ] }] };
  assert.equal(currentStepId(partly, { activeLane: "trade" }), "ownership");

  // A step the procedure never reaches for is folded out of the rail, so it must
  // not be what the rail lands on.
  const folded = { lanes: [{ lane: "trade", steps: [
    { id: "identify_party", status: "confirmed" },
    { id: "parent_screening", status: "not_applicable" }
  ] }] };
  assert.equal(currentStepId(folded, { activeLane: "trade" }), "identify_party");

  // Before any specialist starts, the work belongs to the first lane rather than
  // to a question waiting on the reader.
  assert.equal(currentStepId(settled, { stage: "grounding" }), "search_lists");
  // And with nothing running, the rail falls back to what the caller computed.
  assert.equal(currentStepId(settled, { firstBlocked: "ownership" }), "ownership");
  assert.equal(currentStepId(settled, {}), null);
});

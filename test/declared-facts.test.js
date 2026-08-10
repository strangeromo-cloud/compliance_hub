import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { DECLARABLE_FIELDS, planAnalysisPath, resolveAnalysisPath } from "../src/analysis-path.js";
import { startStubModel } from "./helpers/stub-model.js";

// One stub endpoint for the file. These tests assert on what the deterministic
// layers computed — routing, path resolution, declared facts, clearance — and
// used to reach them with `mock: true`. That flag is gone, so what they need is
// a model to be reachable, not a stand-in for its answer.
let stub;
before(async () => { stub = await startStubModel(); });
after(async () => { await stub?.stop(); });

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

test("a question it cannot answer is reported beside the conclusion, not instead of it", async () => {
  const { assessScenario } = await import("../src/orchestrator.js");
  const question = "我们计划向一家新加坡代理商出口高性能计算服务器，最终用户在中国，由一家咨询公司代为付款";

  // The run used to stop at the first unanswerable step and return nothing.
  // Four runs in five stopped, and every continuation re-ran the lanes that had
  // already reported — so the reader waited through the whole procedure again to
  // learn one more fact. The protection it bought is kept and moved: the answer
  // is written, labelled interim, with what is missing named beside it.
  const result = await assessScenario({ question, locale: "zh", config: stub.config });

  assert.ok(result.synthesis, "the reader gets the assessment that could be made");
  assert.equal(result.results.length, 3, "every lane reports before the answer is written");
  assert.ok(result.awaitingInput, "and what could not be closed is still named");

  const named = result.analysisPath.lanes.flatMap((lane) => lane.steps).find((step) => step.id === result.awaitingInput.step);
  assert.equal(named.status, "evidence_needed");
  assert.ok(named.inputs.length, "what is reported outstanding is something a person can actually supply");

  // The sixth gate holds regardless: an unclosed step must never read as cleared.
  assert.notEqual(result.grounding?.clearance?.cleared, true, "an outstanding step cannot clear");
});

test("answering every question lets the run reach a conclusion", async () => {
  const { assessScenario } = await import("../src/orchestrator.js");
  const question = "我们计划向一家新加坡代理商出口高性能计算服务器，最终用户在中国，由一家咨询公司代为付款";
  const declaredFacts = Object.fromEntries(DECLARABLE_FIELDS.map((field) => [field, "已提供"]));

  const done = await assessScenario({ question, locale: "zh", config: stub.config, declaredFacts });
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
    const result = await assessScenario({ question, locale: "zh", config: stub.config, declaredFacts, unavailableFacts });
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
    const result = await assessScenario({ question, locale: "zh", config: stub.config });
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

test("a step that is still asking is told apart from one that was passed over", async () => {
  // This is the branch the rail crashed in: stepState reached for isAskable and
  // the earlier test never got that far, because it always found an open step
  // before the fallback ran. A step waiting on the reader and a step the reader
  // declined look identical by status alone — the difference is which fields
  // they have already passed over, which is why that has to be an argument
  // rather than a global the module reaches for.
  const { stepState, isAskable, currentStepId } = await import("../public/status-vocabulary.js");

  const asking = { id: "identity_resolution", status: "evidence_needed", inputs: [{ field: "registrationNumber" }, { field: "address" }] };
  assert.equal(stepState(asking, []), "asking");
  assert.equal(stepState(asking, ["registrationNumber"]), "asking", "one field declined is not the step declined");
  assert.equal(stepState(asking, ["registrationNumber", "address"]), "skipped");
  assert.equal(isAskable(asking, []), true);
  assert.equal(isAskable(asking, ["registrationNumber", "address"]), false);
  assert.equal(isAskable({ status: "confirmed" }, []), false);

  // And the fallback path that calls it, with a lane whose only open step was
  // passed over — the rail must still point somewhere rather than throwing.
  const path = { lanes: [{ lane: "trade", steps: [{ id: "search_lists", status: "confirmed" }, asking] }] };
  assert.equal(currentStepId(path, { activeLane: "trade", declined: ["registrationNumber", "address"] }), "identity_resolution");
  assert.doesNotThrow(() => currentStepId(path, { activeLane: "trade" }));
});

test("both panels fold the same steps, and both let you see them", async () => {
  // The body's fold was a disclosure that named what was inside; the rail's was
  // a dead count line. A reader who skipped ownership could see it named on the
  // left and had no way to reach it on the right — the two sides agreeing on the
  // number while disagreeing about whether you may look.
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /<details class="fl-folded">/, "the rail's fold has to open");
  const open = app.match(/view\.shown\.map\(\(item\) => flowStepRow\(item, \{([^}]*)\}\)\)/);
  const folded = app.match(/laneFolded\.map\(\(item\) => flowStepRow\(item, \{([^}]*)\}\)\)/);
  assert.ok(open && folded, "both lists build their rows through flowStepRow");
  assert.deepEqual(
    folded[1].split(",").map((part) => part.trim()).filter((part) => part && part !== "muted: true"),
    open[1].split(",").map((part) => part.trim()).filter(Boolean),
    "and hold the same rows the open list holds, muting aside");

  // One row template for both, because a fold that describes a step differently
  // from the list is the same fault in a new place.
  assert.equal([...app.matchAll(/<li class="fl-step /g)].length, 1,
    "there must be exactly one step-row template");
  assert.match(app, /function flowStepRow\(item, \{[^}]*muted = false \} = \{\}\) \{/);

  // A folded step is not the step the run is waiting on, so it must never be
  // marked current inside the fold.
  assert.match(app, /const current = !muted && item\.id === asking;/);
});

test("both panels draw the same lanes and the same steps, by construction", async () => {
  // Sharing the step rule was not enough. The body also revealed lane by lane —
  // closing is not drawn while a question is outstanding, nothing past the lane
  // holding that question is drawn at all — while the rail drew every lane
  // always. So the two lists still differed by whole sections, which is what a
  // reader sees when they say the panels do not match.
  const { laneView, visibleLanes, firstBlockedStep } = await import("../public/status-vocabulary.js");

  const path = {
    lanes: [
      { lane: "trade", steps: [
        { id: "identify_party", status: "confirmed" },
        { id: "identity_resolution", status: "evidence_needed", inputs: [{ field: "registrationNumber" }] },
        { id: "ownership", status: "not_reached" }
      ] },
      { lane: "product", steps: [{ id: "identify_item", status: "not_reached" }] },
      { lane: "review", steps: [{ id: "human_review", status: "review_required" }] }
    ]
  };

  // A question is outstanding, so nothing past its lane is drawn and closing
  // waits for something to close.
  assert.deepEqual(visibleLanes(path, {}).map((lane) => lane.lane), ["trade"]);
  assert.equal(firstBlockedStep(path, []), "identity_resolution");
  assert.deepEqual(laneView(path.lanes[0], { question: "identity_resolution" }).shown.map((s) => s.id),
    ["identify_party", "identity_resolution"], "a step nobody has reached says nothing about this question");

  // Declining it moves the run on, and the step stays where it is. It is not the
  // same as a step the procedure never reached for: the reader was asked, said
  // they did not have it, and the gap is still open. Folding it away would hide
  // a gap the reader had just created, behind a line that reads like tidying up.
  const declined = ["registrationNumber"];
  const view = laneView(path.lanes[0], { question: "ownership", declined });
  assert.deepEqual(view.shown.map((s) => s.id), ["identify_party", "identity_resolution", "ownership"],
    "a declined step stays in place, styled as skipped");
  assert.deepEqual(view.folded.map((s) => s.id), [], "and nothing folds that the reader decided about");

  // What does fold is a step whose conditions never arose. It needs no reading
  // and no action, so it keeps its place in the record without keeping its
  // height — and it must still fold on both panels.
  const withNa = { lane: "trade", steps: [...path.lanes[0].steps, { id: "parent_screening", status: "not_applicable" }] };
  const naView = laneView(withNa, { question: "ownership", declined });
  assert.deepEqual(naView.folded.map((s) => s.id), ["parent_screening"]);

  // With nothing outstanding, closing is drawn and every lane with settled work
  // appears — the shape a finished run has on both sides.
  const done = { lanes: [
    { lane: "trade", steps: [{ id: "identify_party", status: "confirmed" }] },
    { lane: "product", steps: [{ id: "identify_item", status: "declared" }] },
    { lane: "review", steps: [{ id: "human_review", status: "review_required" }] }
  ], awaitingInput: null, final: true };
  assert.deepEqual(visibleLanes(done, {}).map((lane) => lane.lane), ["trade", "product", "review"]);

  // And the counts stay over the whole lane, because "what is still ahead" is a
  // number rather than a list of steps nobody has reached.
  assert.equal(laneView(path.lanes[0], {}).total, 3);
});

test("a lane with nothing reached shows its plan rather than an empty frame", async () => {
  // A continuation replans before it re-resolves, so for a moment every step is
  // pending — and "show what has happened" reads that as "show nothing". The
  // rail went blank the instant a declaration was submitted, which is exactly
  // when the reader most wants to see what is coming.
  const { laneView, visibleLanes } = await import("../public/status-vocabulary.js");

  const plan = { lanes: [
    { lane: "trade", steps: [{ id: "identify_party", status: "pending" }, { id: "search_lists", status: "pending" }] },
    { lane: "review", steps: [{ id: "human_review", status: "pending" }] }
  ] };
  assert.deepEqual(laneView(plan.lanes[0], {}).shown.map((s) => s.id), ["identify_party", "search_lists"]);
  assert.deepEqual(visibleLanes(plan, {}).map((l) => l.lane), ["trade", "review"],
    "an unresolved plan is what there is to show, and showing it is why it is sent first");

  // Once anything has happened, the rule goes back to what happened.
  const started = { lanes: [
    { lane: "trade", steps: [{ id: "identify_party", status: "confirmed" }, { id: "search_lists", status: "pending" }] }
  ] };
  assert.deepEqual(laneView(started.lanes[0], {}).shown.map((s) => s.id), ["identify_party"]);

  // Closing is never drawn on its own: a rail holding only "human review"
  // describes a run that has not started as though it were nearly over.
  const onlyClosing = { lanes: [
    { lane: "trade", steps: [{ id: "identify_party", status: "evidence_needed", inputs: [{ field: "legalName" }] }] },
    { lane: "review", steps: [{ id: "human_review", status: "review_required" }] }
  ] };
  assert.deepEqual(visibleLanes(onlyClosing, {}).map((l) => l.lane), ["trade"]);
});

test("a continuation's bare replan never reaches either panel", async () => {
  // The body ignored it and kept the path the reader was reading; the rail took
  // it and reset to an unresolved plan until the resolved one arrived. Ignoring
  // it outright matters because the stage handler read it back out of the
  // collected path a moment later.
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /if \(resuming && event\.path\?\.planned\) return;\n\s*collected\.path = event\.path;/,
    "the bare replan is dropped before anything downstream can pick it up");
});

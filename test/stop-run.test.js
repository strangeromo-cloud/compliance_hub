import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startStubModel } from "./helpers/stub-model.js";

// A database of this run's own. Nothing here depends on what happens to be
// synced locally, and nothing here writes to the real one.
const DIR = mkdtempSync(join(tmpdir(), "hub-stop-"));
process.env.HUB_DB_PATH = join(DIR, "test.db");

const { assessScenario } = await import("../src/orchestrator.js");
const { closeDb } = await import("../src/data-layer/db.js");

let stub;
before(async () => { stub = await startStubModel(); });
after(async () => { await stub?.stop(); closeDb(); });

const QUESTION = "我们要向德国 Customer Rhein Systeme GmbH 出口一批 GPU 服务器，请做出口管制审查。";

// Enough declared to keep the path from stopping to ask, so what these tests
// observe is the stop and not the questionnaire. Grounding makes live lookups,
// so how far an undeclared run gets is not fixed run to run — the assertions
// below are written to hold whichever lanes ran.
const DECLARED = {
  legalName: "Customer Rhein Systeme GmbH",
  registrationNumber: "HRB 214553",
  country: "DE",
  partNumber: "SXM-H100",
  usContent: "> 25%",
  eccn: "3A090.a",
  destination: "德国",
  endUse: "商业数据中心训练集群",
  ownership: "Rhein Holding 持股 100%",
  ubo: "Klaus Rhein",
  registrationDocs: "已取得注册证明",
  fees: "按台报价",
  payee: "同一主体，德国账户"
};

// Model calls, which is the thing stopping is supposed to save. Counted from the
// stub rather than inferred: a stop that still spends four calls has stopped
// nothing, and would look identical from the outside.
const spent = () => stub.calls.length;

test("stopping before the first specialist spends nothing at all", async () => {
  const from = spent();
  const result = await assessScenario({ question: QUESTION, config: stub.config, declaredFacts: DECLARED, shouldStop: () => true });

  assert.equal(result.stopped, true, "the caller has to be able to tell a stop from a conclusion");
  assert.equal(result.synthesis, null, "a stopped run has no conclusion to show");
  assert.equal(spent() - from, 0, "no specialist and no synthesis should have been asked for");
});

test("a stop never pays for the synthesis", async () => {
  // Synthesis is the fourth call and the one that produces the answer. The guard
  // before it is what stops a run being charged for a conclusion nobody will
  // read — and what keeps a half-finished review from acquiring one.
  let sawSpecialist = false;
  const from = spent();
  const result = await assessScenario({
    question: QUESTION, config: stub.config, declaredFacts: DECLARED,
    onEvent: (event) => { if (event.type === "agent") sawSpecialist = true; },
    shouldStop: () => sawSpecialist
  });

  assert.equal(result.stopped, true);
  assert.equal(result.synthesis, null);
  assert.ok(result.results.length >= 1, "the specialist that did run is kept, not thrown away");
  // One call per specialist that reported, and nothing more. Any extra is the
  // synthesis, which a stopped run must not reach.
  assert.equal(spent() - from, result.results.length,
    `a stopped run should cost one call per specialist that ran, not ${spent() - from} for ${result.results.length}`);
});

test("a run nobody stopped still concludes", async () => {
  // The guard has to be inert when nothing is stopping it, or it would be a way
  // of silently truncating reviews.
  const result = await assessScenario({ question: QUESTION, config: stub.config, declaredFacts: DECLARED });
  assert.notEqual(result.stopped, true);
  assert.ok(result.results.length >= 1);
  assert.ok(result.synthesis, "an unstopped run produces the conclusion the stop withholds");
});

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A database of this run's own, as elsewhere in the suite.
const DIR = mkdtempSync(join(tmpdir(), "hub-parallel-"));
process.env.HUB_DB_PATH = join(DIR, "test.db");

const { assessScenario } = await import("../src/orchestrator.js");
const { closeDb } = await import("../src/data-layer/db.js");

// A model that answers nobody until every specialist has asked.
//
// This is the whole test, and it needs no clock. Sequential lanes deadlock
// against a barrier like this — the second request never arrives, because the
// first is still waiting for it — so the run either finishes, which can only
// happen if the lanes went out together, or it hangs. Nothing here passes on a
// fast machine and fails on a slow one.
//
// How many lanes to wait for is counted from the run's own agent_start events
// rather than hard-coded: which specialists open depends on the question and on
// what grounding could reach, and a barrier set to the wrong number would hang
// on a correct run.
let server;
let expected = 0;
let arrived = 0;
let target = 0;   // how many the barrier waits for, frozen when the first request lands
let opened = 0;   // how many were waiting when it let go — read by the assertions
let release = null;

// Re-arming does not touch the counters: the barrier is re-armed by the request
// that opens it, and zeroing there would erase the very number being asserted.
// Each test resets them itself.
function armBarrier() {
  return new Promise((resolve) => { release = resolve; });
}
function resetBarrier() {
  expected = 0; arrived = 0; target = 0; opened = 0;
  return armBarrier();
}
let barrier = armBarrier();

before(async () => {
  server = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw || "{}");
    const asked = JSON.stringify(body).toLowerCase();
    const lane = /\bproduct\b/.test(asked) ? "product" : /\btpdd\b|\bethics\b/.test(asked) ? "tpdd" : "trade";

    // How many the barrier holds for is frozen at the first request, not read
    // live. Read live, it would rise in step with a sequential run — one lane
    // announced, one request, barrier satisfied — and let the very thing this
    // test exists to catch straight through.
    if (arrived === 0) target = expected;

    // The synthesis is a fourth call, made after the specialists have all
    // answered, and must not wait on a barrier only specialists can open.
    if (arrived < target) {
      arrived += 1;
      if (arrived === target) { opened = arrived; release(); barrier = armBarrier(); }
      else await barrier;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        agent: lane, summary: "测试桩", findings: [], risk: "medium", citations: []
      }) } }]
    }));
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
});

after(async () => {
  release?.();
  await new Promise((done) => server.close(done));
  closeDb();
});

const config = () => ({
  baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
  model: "stub",
  apiKey: "stub-none"
});

// Undeclared on purpose. Declaring the facts closes most of the path, and a run
// that opens one lane cannot show whether lanes overlap.
const QUESTION = "我们要向新加坡一家分销商出口一批 GPU 服务器，最终用户未知，请做出口管制审查。";

test("the specialists go out together, not one after another", async () => {
  barrier = resetBarrier();
  const started = [];
  const result = await assessScenario({
    question: QUESTION, locale: "zh", config: config(), history: [],
    onEvent: (event) => {
      // Counted before any answer comes back, which is only possible because the
      // orchestrator announces every lane before awaiting any of them.
      if (event.type === "agent_start") { expected += 1; started.push(event.agent); }
    }
  });

  assert.ok(started.length > 1, `the question has to open more than one lane to prove anything, opened ${started}`);
  // Reaching here at all is the assertion: the barrier opened only because every
  // specialist's request was outstanding at the same moment.
  assert.equal(opened, started.length, "every specialist reached the model before any was answered");
  assert.ok(result.synthesis, "and the run still closed with a synthesis");
});

test("every specialist is announced before any of them has answered", async () => {
  // Sequential lanes announce, answer, announce, answer. Announcing them all up
  // front is what lets the reader watch three boxes fill at once instead of two
  // empty ones waiting their turn — the visible half of the same change.
  barrier = resetBarrier();
  const order = [];
  await assessScenario({
    question: QUESTION, locale: "zh", config: config(), history: [],
    onEvent: (event) => {
      if (event.type === "agent_start") { expected += 1; order.push("start"); }
      if (event.type === "agent") order.push("done");
    }
  });

  const lanes = order.filter((entry) => entry === "start").length;
  assert.ok(lanes > 1, "the question has to open more than one lane to prove anything");
  assert.deepEqual(order.slice(0, lanes), Array(lanes).fill("start"),
    "the starts all come before the first result");
});

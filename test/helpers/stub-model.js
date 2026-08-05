// A model endpoint for the tests to run against.
//
// The suite used to reach the deterministic layers — routing, path resolution,
// declared facts, clearance — by passing `mock: true`, which swapped the model
// for canned prose. That flag is gone: a system that emits templated text when
// it cannot reach a model presents boilerplate as analysis, and deleting the
// flag meant the tests needed a model rather than a substitute for one.
//
// So this speaks the OpenAI Chat Completions surface and nothing else, over
// loopback, and returns the smallest valid answer for whatever was asked. It is
// deliberately incurious about the prompt: these tests assert on what the
// deterministic layers computed, and a stub that shaped its answers to the
// question would start deciding their outcomes.

import { createServer } from "node:http";

const AGENT = (agent) => ({
  agent,
  riskLevel: "medium",
  summary: "stub",
  findings: [],
  missingInfo: [],
  recommendedActions: []
});

const SYNTHESIS = {
  overallRisk: "unknown",
  headline: "stub",
  executiveSummary: "stub",
  nextStep: "stub"
};

// The master agent is the one call that asks for an overallRisk, and the
// specialists are the ones that name a lane. That is enough to tell them apart
// without reading the prompt for meaning.
function answerFor(body) {
  const text = JSON.stringify(body?.messages || []);
  if (/overallRisk/.test(text)) return SYNTHESIS;
  const lane = ["trade", "product", "tpdd"].find((name) => new RegExp(`"agent"\\s*:\\s*"${name}"|\\b${name}\\b`).test(text));
  return AGENT(lane || "trade");
}

// Every test that starts one has to close it, or `node --test` hangs on an open
// handle rather than failing — so the caller gets a stop() it can put in a
// finally, and t.after() is the shape that survives an assertion throwing.
export function startStubModel({ answer = answerFor } = {}) {
  return new Promise((resolve) => {
    const calls = [];
    const server = createServer(async (request, response) => {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw || "{}");
      calls.push(body);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer(body)) } }] }));
    });
    server.listen(0, "127.0.0.1", () => resolve({
      calls,
      config: {
        baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        model: "stub",
        apiKey: "stub-none"
      },
      stop: () => new Promise((done) => server.close(done))
    }));
  });
}

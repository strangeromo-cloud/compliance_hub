import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { callJsonModel, callJsonModelStream, readableProjection } from "../src/llm.js";

// A stand-in for `vllm serve` — the OpenAI-compatible surface only, with the
// ways a self-hosted server differs from api.openai.com. This exists so the
// on-premise path is a tested route rather than an assumption: the whole reason
// an open-weights model matters here is that a compliance tool nobody may give
// real transaction data to is working at a permanent discount.
const ANSWER = { agent: "trade", riskLevel: "medium", summary: "已完成筛查", findings: [], missingInfo: [], recommendedActions: [] };

function serve(handler) {
  return new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      handler(JSON.parse(raw || "{}"), response);
    });
    server.listen(0, "127.0.0.1", () => resolve({
      server, config: { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: `m-${server.address().port}`, apiKey: "local-none" }
    }));
  });
}
const json = (response, body, status = 200) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

test("a self-hosted OpenAI-compatible server serves the run", async () => {
  const seen = [];
  const { server, config } = await serve((body, response) => {
    seen.push(body);
    json(response, { choices: [{ message: { content: JSON.stringify(ANSWER) } }] });
  });
  try {
    const result = await callJsonModel(config, [{ role: "user", content: "hi" }]);
    assert.equal(result.riskLevel, "medium");
    // Nothing provider-specific goes out: model, messages, and two parameters
    // that are dropped when refused.
    assert.deepEqual(Object.keys(seen[0]).sort(), ["messages", "model", "response_format", "temperature"]);
  } finally { server.close(); }
});

test("a server that refuses response_format is retried without it", async () => {
  // Older vLLM and TGI builds 400 on response_format. Dropping it and
  // remembering per model costs one failed request rather than one per call —
  // and the alternative, pinning to one provider's dialect, is what makes a
  // deployment impossible to move.
  let refusals = 0;
  const { server, config } = await serve((body, response) => {
    if (body.response_format) {
      refusals += 1;
      return json(response, { error: { message: "response_format is not supported by this model" } }, 400);
    }
    json(response, { choices: [{ message: { content: JSON.stringify(ANSWER) } }] });
  });
  try {
    assert.equal((await callJsonModel(config, [{ role: "user", content: "hi" }])).riskLevel, "medium");
    assert.equal(refusals, 1);
    // Remembered, so the second call does not pay for the discovery again.
    await callJsonModel(config, [{ role: "user", content: "hi" }]);
    assert.equal(refusals, 1);
  } finally { server.close(); }
});

test("a reasoning model's working is not mistaken for its answer", async () => {
  // Hermes and the other open-weights models with a thinking mode state their
  // working before the answer, and that working is prose about the problem —
  // so it contains braces, because the problem is about JSON. Matching the first
  // "{" to the last "}" spliced the tail of the explanation onto the head of the
  // answer and failed with a parse error that read like a model malfunction.
  const think = "<think>\nConsider {party, item, destination} and answer in JSON.\n</think>\n";
  const { server, config } = await serve((body, response) =>
    json(response, { choices: [{ message: { content: think + JSON.stringify(ANSWER) } }] }));
  try {
    assert.equal((await callJsonModel(config, [{ role: "user", content: "hi" }])).summary, "已完成筛查");
  } finally { server.close(); }

  // And trailing prose after the object, which is the other half of the same
  // habit.
  const { server: second, config: secondConfig } = await serve((body, response) =>
    json(response, { choices: [{ message: { content: `${JSON.stringify(ANSWER)}\n\nHope that helps! {see above}` } }] }));
  try {
    assert.equal((await callJsonModel(secondConfig, [{ role: "user", content: "hi" }])).agent, "trade");
  } finally { second.close(); }
});

test("streaming arrives as it is written", async () => {
  // Long enough to span several chunks: the projection only pushes when the
  // readable text changes, so a summary short enough to arrive whole would
  // legitimately produce one update and prove nothing about streaming.
  const text = JSON.stringify({ ...ANSWER, summary: "已完成名单筛查，交易方在九个已同步来源中未发现命中；分类与目的地均已确定，在所述事实下不产生许可要求。" });
  const { server, config } = await serve((body, response) => {
    assert.equal(body.stream, true, "the streaming call must ask for a stream");
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    for (let i = 0; i < text.length; i += 12) {
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 12) } }] })}\n\n`);
    }
    response.write("data: [DONE]\n\n");
    response.end();
  });
  try {
    const seen = [];
    const result = await callJsonModelStream(config, [{ role: "user", content: "hi" }], (partial) => seen.push(partial));
    assert.match(result.summary, /九个已同步来源/);
    assert.ok(seen.length > 1, "the reader sees it being written, not only the finished object");
    assert.equal(seen.at(-1), readableProjection(text));
  } finally { server.close(); }
});

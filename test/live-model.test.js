import test from "node:test";
import assert from "node:assert/strict";
import { assessScenario } from "../src/orchestrator.js";
import { classifyModelError } from "../src/llm.js";

test("model connection errors are classified without exposing credentials", () => {
  assert.deepEqual(classifyModelError(Object.assign(new Error("unauthorized"), { status: 401 })), { code: "model_auth_error", providerStatus: 401 });
  assert.deepEqual(classifyModelError(Object.assign(new Error("forbidden"), { status: 403 })), { code: "model_permission_error", providerStatus: 403 });
  assert.deepEqual(classifyModelError(Object.assign(new Error("not found"), { status: 404 })), { code: "model_endpoint_or_name_not_found", providerStatus: 404 });
  assert.deepEqual(classifyModelError(Object.assign(new Error("limited"), { status: 429 })), { code: "model_quota_or_rate_limit", providerStatus: 429 });
  assert.deepEqual(classifyModelError(Object.assign(new Error("aborted"), { name: "AbortError" })), { code: "model_timeout", providerStatus: null });
  assert.deepEqual(classifyModelError(new TypeError("fetch failed")), { code: "model_network_error", providerStatus: null });
  assert.deepEqual(classifyModelError(new Error("Model API returned no message content.")), { code: "model_invalid_response", providerStatus: null });
});

test("live-model path routes, grounds, and synthesizes different questions", async (t) => {
  const originalFetch = globalThis.fetch;
  const modelPrompts = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (!url.startsWith("https://fake-model.local/")) {
      return new Response(`<html><body>${"Official public-source policy content. ".repeat(20)}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
    }
    const request = JSON.parse(options.body);
    const system = request.messages[0].content;
    const user = request.messages[1].content;
    modelPrompts.push({ system, user });
    const policyQuestion = user.includes("中国两用物项的policy");
    const isMaster = system.includes("Compliance Hub Master Agent");
    const content = isMaster
      ? (policyQuestion
        ? { overallRisk: "unknown", headline: "LIVE 中国两用物项政策", executiveSummary: "统一清单、临时管制和风险兜底要求适用于问题中的政策查询。", nextStep: "提供产品技术参数后继续判断。" }
        : { overallRisk: "unknown", headline: "LIVE 产品受限判断", executiveSummary: "必须结合型号、技术指标、目的地和最终用途判断。", nextStep: "补充准确型号。" })
      : (policyQuestion
        ? { agent: "product", riskLevel: "unknown", summary: "具体政策回答", findings: [{ title: "政策", detail: "统一清单和风险兜底。", evidenceSourceIds: ["china-dual-use-regulation"] }], missingInfo: [], recommendedActions: ["核对现行清单"] }
        : { agent: "product", riskLevel: "unknown", summary: "具体产品判断", findings: [{ title: "产品", detail: "型号不足。", evidenceSourceIds: ["china-dual-use-list-faq"] }], missingInfo: ["型号"], recommendedActions: ["补充型号"] });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const config = { baseUrl: "https://fake-model.local/v1", model: "test-model", apiKey: "test-key" };
  const policy = await assessScenario({ question: "中国两用物项的policy是什么？", locale: "zh", config, mock: false });
  const product = await assessScenario({ question: "这个工业控制器是否属于中国受限产品？", locale: "zh", config, mock: false });

  assert.equal(policy.mode, "live-model");
  assert.deepEqual(policy.agents, ["product"]);
  assert.match(policy.synthesis.headline, /LIVE 中国两用物项政策/);
  assert.match(product.synthesis.headline, /LIVE 产品受限判断/);
  assert.notEqual(policy.synthesis.executiveSummary, product.synthesis.executiveSummary);
  assert.ok(modelPrompts.some((prompt) => prompt.user.includes("Structured grounding:")));
  assert.ok(modelPrompts.some((prompt) => prompt.user.includes("china-dual-use-regulation")));
  assert.ok(modelPrompts.some((prompt) => prompt.system.includes("first sentence must contain the actual answer")));
});

test("live H100 ECCN query removes route analysis from specialist trace", async (t) => {
  const originalFetch = globalThis.fetch;
  const prompts = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (!url.startsWith("https://fake-model.local/")) {
      return new Response(`<html><body>${"Official classification content. ".repeat(20)}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
    }
    const request = JSON.parse(options.body);
    prompts.push(request.messages[0].content);
    const isMaster = request.messages[0].content.includes("Compliance Hub Master Agent");
    const content = isMaster
      ? { overallRisk: "low", headline: "H100 ECCN 4A090.a", executiveSummary: "NVIDIA records list ECCN 4A090.a.", nextStep: "Confirm the form factor." }
      : {
          agent: "product",
          riskLevel: "low",
          summary: "H100 is listed as ECCN 4A090.a.",
          findings: [
            { title: "H100 ECCN", detail: "NVIDIA lists ECCN 4A090.a. TPP is 12,224.", evidenceSourceIds: ["nvidia-export"] },
            { title: "Shipping route", detail: "Confirm transit and destination.", evidenceSourceIds: ["bis-end-user"] }
          ],
          missingInfo: ["Exact H100 form factor", "Destination and end user"],
          recommendedActions: ["Confirm the ECCN against the part number", "Complete route and license analysis"]
        };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await assessScenario({
    question: "请告诉我英伟达 H100 的 ECCN 值是多少？",
    locale: "zh",
    config: { baseUrl: "https://fake-model.local/v1", model: "test-model", apiKey: "test-key" },
    mock: false
  });

  assert.deepEqual(result.agents, ["product"]);
  assert.equal(result.intent, "product_metric");
  assert.equal(result.results[0].riskLevel, "unknown");
  assert.equal(result.synthesis.overallRisk, "unknown");
  assert.doesNotMatch(JSON.stringify(result.results[0]), /Shipping route|transit|destination|TPP|route and license/i);
  assert.match(result.results[0].findings[0].detail, /4A090\.a/);
  assert.doesNotMatch(result.results[0].findings[0].detail, /4A090\. a/);
  assert.deepEqual(result.sources.map((source) => source.id), ["bis-classify", "nvidia-export"]);
  assert.ok(prompts.some((prompt) => prompt.includes("narrow factual product-classification query")));
});

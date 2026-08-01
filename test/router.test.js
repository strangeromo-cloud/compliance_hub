import test from "node:test";
import assert from "node:assert/strict";
import { routeQuestion } from "../src/router.js";
import { createMockAgentResult, createMockSynthesis } from "../src/mock.js";
import { classifyQuestionIntent } from "../src/question-intent.js";
import { collectGrounding } from "../src/grounding.js";
import { sourcesForAgents } from "../src/sources.js";

test("routes named restricted party to Trade Compliance", () => {
  assert.deepEqual(routeQuestion("我们能否与华为签订技术支持服务合同？"), ["trade"]);
});

test("routes H100 transit scenario to Product Compliance", () => {
  assert.deepEqual(routeQuestion("H100 从美国经加拿大出口到墨西哥是否需要许可证？"), ["product"]);
});

test("routes distributor diversion scenario to Product and TPDD", () => {
  assert.deepEqual(
    routeQuestion("H100 经墨西哥经销商最终提供给中国客户，有哪些风险？"),
    ["product", "tpdd"]
  );
});

test("routes third-party fee and offshore payment to TPDD", () => {
  assert.deepEqual(routeQuestion("新顾问要求15%成功费并付款到BVI离岸账户"), ["tpdd"]);
});

test("ambiguous questions fan out to all agents", () => {
  assert.deepEqual(routeQuestion("请评估这个业务安排"), ["trade", "product", "tpdd"]);
});

test("router can defer fallback for conversational context", () => {
  assert.deepEqual(routeQuestion("那这种情况下呢？", false), []);
});

test("rules-demo output preserves risk and uses question-specific synthesis", () => {
  const result = createMockAgentResult("trade", "zh");
  const synthesis = createMockSynthesis([result], "zh");
  assert.equal(result.agent, "trade");
  assert.equal(result.riskLevel, "high");
  assert.equal(synthesis.overallRisk, "high");
  assert.equal(synthesis.headline, "交易方筛查");
  assert.match(synthesis.executiveSummary, /受限交易方/);
});

test("China dual-use policy query returns concrete framework instead of default answer", async () => {
  const question = "中国两用物项的policy是什么？";
  const grounding = await collectGrounding(question, ["product"]);
  const result = createMockAgentResult("product", "zh", question, grounding);
  const synthesis = createMockSynthesis([result], "zh", question, grounding);
  assert.equal(classifyQuestionIntent(question), "policy_lookup");
  assert.match(result.summary, /统一清单/);
  assert.match(result.findings[0].detail, /2024年12月1日/);
  assert.match(result.findings[2].detail, /临时管制/);
  assert.match(synthesis.headline, /统一清单/);
  assert.doesNotMatch(synthesis.executiveSummary, /Prototype 已识别/);
});

test("product restriction query requests classification and transaction facts", () => {
  const question = "这个工业控制器是否属于中国受限产品？";
  const context = { intent: classifyQuestionIntent(question), facts: [], listMatches: [], limitations: [] };
  const result = createMockAgentResult("product", "zh", question, context);
  const synthesis = createMockSynthesis([result], "zh", question, context);
  assert.equal(context.intent, "product_restriction");
  assert.match(result.findings[0].detail, /技术指标/);
  assert.match(synthesis.headline, /产品是否受限/);
});

test("China policy sources are prioritized for a dual-use policy question", () => {
  const sources = sourcesForAgents(["product"], "中国两用物项的policy是什么？");
  assert.equal(sources[0].id, "china-dual-use-regulation");
  assert.ok(sources.slice(0, 4).some((source) => source.id === "china-dual-use-list-faq"));
  assert.ok(sources.every((source) => source.id.startsWith("china-dual-use-")));
  assert.match(sources.find((source) => source.id === "china-dual-use-license-directory").title, /2026/);
});

test("mock output adds scenario-specific findings", () => {
  const encryption = createMockAgentResult("product", "zh", "含VPN和高强度加密设备出口印度");
  const shellIndicators = createMockAgentResult("tpdd", "en", "Distributor uses a shared office and refuses UBO");
  assert.equal(encryption.findings[0].title, "加密产品分类");
  assert.equal(shellIndicators.findings[0].title, "Business-substance indicators");
});

test("H100 APP query gives model-specific TPP values instead of hiding the answer", () => {
  const result = createMockAgentResult("product", "zh", "请告诉我英伟达H100的APP值是多少？");
  const synthesis = createMockSynthesis([result], "zh", "请告诉我英伟达H100的APP值是多少？");
  assert.equal(result.riskLevel, "unknown");
  assert.match(result.findings[0].detail, /PCIe 为 12,224/);
  assert.match(result.findings[0].detail, /NVL 为 14,144/);
  assert.match(result.findings[0].detail, /SXM5 为 15,840/);
  assert.match(synthesis.headline, /没有一个通用的 APP 值/);
  assert.match(synthesis.executiveSummary, /4A090\.a/);
});

test("H100 ECCN query stays within classification scope and excludes route analysis", () => {
  const question = "英伟达H100的ECCN值是多少？";
  const context = { intent: classifyQuestionIntent(question), facts: [], listMatches: [], limitations: [] };
  const result = createMockAgentResult("product", "zh", question, context);
  const synthesis = createMockSynthesis([result], "zh", question, context);
  const sourceIds = sourcesForAgents(["product"], question).map((source) => source.id);
  assert.equal(context.intent, "product_metric");
  assert.equal(result.findings.length, 1);
  assert.match(result.summary, /4A090\.a/);
  assert.match(synthesis.headline, /4A090\.a/);
  assert.doesNotMatch(JSON.stringify(result), /运输路线|加拿大|墨西哥|最终用户|最终用途/);
  assert.deepEqual(sourceIds, ["bis-classify", "nvidia-export"]);
});

const acceptanceScenarios = [
  ["T01", "华为体系内公司签订远程技术支持、软件更新和技术访问合同", ["trade"]],
  ["T02", "客户未上制裁名单，但受制裁股东合计持股55%，需要UBO及所有权资料", ["trade", "tpdd"]],
  ["T03", "客户与限制名单名称近似，可能是false positive，地址与注册号不同", ["trade"]],
  ["P01", "H100从美国经加拿大中转到墨西哥是否需要许可证", ["product"]],
  ["P02", "含VPN和高强度加密功能的网络设备出口印度，需要确认ECCN", ["product"]],
  ["P03", "中国两用物项镓材料出口欧盟，核查最终用户和最终用途", ["trade", "product"]],
  ["D01", "新顾问要求15%成功费并付款到BVI离岸账户", ["tpdd"]],
  ["D02", "新经销商使用共享办公地址且拒绝提供UBO", ["tpdd"]],
  ["D03", "顾问帮助政府招标，要求成功费付到个人账户", ["tpdd"]],
  ["X01", "H100经墨西哥经销商供给中国最终用户", ["trade", "product", "tpdd"]],
  ["X02", "出口订单被拒后改由新加坡货代收货，最终用户不明且第三方付款", ["trade", "product", "tpdd"]],
  ["X03", "含加密芯片和两用物项BOM，需要交易方screening并付款到关联公司", ["trade", "product", "tpdd"]]
];

for (const [id, question, expected] of acceptanceScenarios) {
  test(`${id} routes to expected agents`, () => {
    assert.deepEqual(routeQuestion(question), expected);
  });
}

test("only an assessment carries a risk level", async () => {
  // Stamping 待定 on a briefing or a lookup claims an assessment was attempted
  // and came back inconclusive. None was attempted: these answer a question of
  // fact, and the risk of a transaction is not among the facts.
  const { assessScenario } = await import("../src/orchestrator.js");
  const noRisk = [
    { gemId: "reg-brief", question: "汇总最近 6 个月的公告变化" },
    { gemId: "case-memo", question: "把本会话整理成案件备忘录" },
    { gemId: "eccn-watch", question: "100-000000009 的 ECCN 是什么？" }
  ];
  for (const { gemId, question } of noRisk) {
    const result = await assessScenario({ question, locale: "zh", mock: true, gemId });
    assert.ok(result.synthesis, `${gemId} must answer rather than ask`);
    assert.equal(result.synthesis.overallRisk, null, `${gemId} must state no risk level`);
    assert.ok(result.synthesis.headline, `${gemId} still answers`);
  }

  // A review gem still assesses, and still says so — the contrast is the point.
  const review = await assessScenario({
    question: "客户 Rhein Systeme GmbH，注册号 HRB 214553，德国杜塞尔多夫。直销一批办公笔记本，最终用途为该公司自身办公使用。",
    locale: "zh", mock: true,
    declaredFacts: {
      legalName: "Rhein Systeme GmbH", registrationNumber: "HRB 214553", country: "DE",
      address: "Kölner Str. 12, 40211 Düsseldorf, Germany",
      ownership: "创始人 Anna Reinhardt 个人持股 100%，无被列名主体直接或间接持股",
      partNumber: "TP-14-G3", usContent: "0%", eccn: "EAR99", destination: "德国",
      endUse: "该公司自身办公使用，无转售、无军事或核相关用途"
    }
  });
  assert.ok(review.synthesis, "a review run with the facts to hand reaches a conclusion");
  assert.ok(["low", "medium", "high", "unknown"].includes(review.synthesis.overallRisk),
    "and that conclusion states a risk level");
});

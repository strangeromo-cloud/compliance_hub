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

test("a run says what it is doing before it does it", async () => {
  // Retrieval and screening are the longest silent stretch of a review: the plan
  // is on screen and nothing moves while official sources are fetched and the
  // whole restricted-party corpus is searched. Both stages were announced only
  // after finishing, which is the wrong end of the work — a reader watching a
  // static framework cannot tell a slow run from a hung one.
  const { assessScenario } = await import("../src/orchestrator.js");
  const seen = [];
  await assessScenario({
    question: "客户 Aveox Technologies (Shenzhen) Co., Ltd.，直销，请做受限方筛查",
    locale: "zh", mock: true,
    onEvent: (event) => seen.push(event.type === "stage" ? `stage:${event.key}` : event.type)
  });

  const order = seen.filter((name) => name.startsWith("stage:") || name === "sources" || name === "grounding" || name === "path");
  assert.ok(order.indexOf("stage:sources") > -1, "the run announces retrieval");
  assert.ok(order.indexOf("stage:grounding") > -1, "and screening");
  // Announced before the result of that work arrives, not after — which is the
  // whole point: the announcement has to cover the wait, not follow it.
  assert.ok(order.indexOf("stage:sources") < order.indexOf("sources"), "retrieval is announced before its result");
  assert.ok(order.indexOf("stage:grounding") < order.indexOf("grounding"), "screening is announced before its result");
  // And the plan is up before either, so there is something to announce against.
  assert.ok(order.indexOf("path") < order.indexOf("stage:sources"), "the plan goes up first");
});

test("the page and the run judge a question the same way", async () => {
  // The composer had its own copy of the routing rules, so it announced a
  // compliance review for questions the run answers as a lookup and never routes
  // to an agent at all, and selecting a briefing gem changed nothing about what
  // it claimed. One copy now, in public/, imported by both — this checks the
  // server still reaches the shared rules and that the judgement matches the
  // order assessScenario actually decides in.
  const { judgeIntent } = await import("../public/intent.js");
  const { routeQuestion } = await import("../src/router.js");
  const { lookupSubject } = await import("../src/lookup.js");
  const { GEM_KINDS } = await import("../src/gem-kinds.js");

  const cases = [
    { q: "100-000000009 的 ECCN 是什么？", kind: "lookup", agents: [] },
    { q: "华为是否在实体清单上？", kind: "lookup", agents: [] },
    { q: "新顾问要求 15% 成功费并付款到 BVI 账户", kind: "review", agents: ["tpdd"] },
    { q: "交易方 Aveox Technologies 的产品出口审查", kind: "review", agents: ["trade", "product"] }
  ];
  for (const item of cases) {
    const verdict = judgeIntent({ question: item.q });
    assert.equal(verdict.kind, item.kind, item.q);
    assert.deepEqual(verdict.agents, item.agents, item.q);
    // And the halves agree: a lookup is exactly what lookupSubject matches,
    // because resolveLookup answers everything it matches.
    assert.equal(Boolean(lookupSubject(item.q)), item.kind === "lookup", item.q);
    if (item.kind === "review") assert.deepEqual(routeQuestion(item.q, false), verdict.agents, item.q);
  }

  // A gem that produces a briefing or a memo settles it before the question is
  // read at all — those name no counterparty and no item.
  for (const gemId of ["reg-brief", "case-memo"]) {
    const verdict = judgeIntent({ question: "华为是否在实体清单上？", gemKind: GEM_KINDS[gemId] });
    assert.equal(verdict.review, false, gemId);
    assert.deepEqual(verdict.agents, [], `${gemId} opens no review procedure`);
  }

  // Nothing matched means every lane runs, and the page is told so rather than
  // being handed three tags that look like a decision.
  const vague = judgeIntent({ question: "这个能做吗" });
  assert.equal(vague.matched, false);
  assert.deepEqual(vague.agents, ["trade", "product", "tpdd"]);
});

test("the routing rules exist in exactly one place", async () => {
  // Two copies of a rule diverge — that is what put an agent tag under a lookup
  // question for months. The page must not grow a second set.
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /function estimatedRoute/, "the page must ask the shared judgement, not re-derive it");
  assert.match(app, /from "\/intent\.js"/, "and it has to import it");

  for (const [file, symbol] of [["../src/router.js", "routeQuestion"], ["../src/question-intent.js", "classifyQuestionIntent"]]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /from "\.\.\/public\/intent\.js"/, `${file} must re-export the shared rules`);
    assert.match(source, new RegExp(symbol), `${file} must still expose ${symbol}`);
  }
});

test("the Chinese half of the routing rules is as wide as the English", async () => {
  // "screening" put a question on the trade lane and 筛查 did not; "entity list"
  // did and 实体清单 did not. So a question whose entire subject was restricted-
  // party screening matched no rule at all and fell through to the "nothing
  // matched, run everything" fallback — which reads like a decision and is not.
  const { judgeIntent } = await import("../public/intent.js");

  const onlyTrade = [
    "客户 Aveox Technologies，直销，请做受限方筛查",
    "请对这家公司做名单筛查",
    "该交易对手是否需要做受限方筛查？",
    "对方在不可靠实体名单里吗"
  ];
  for (const question of onlyTrade) {
    const verdict = judgeIntent({ question });
    assert.equal(verdict.matched, true, `${question} must match a rule, not fall back`);
    assert.deepEqual(verdict.agents, ["trade"], question);
  }

  // 清单 stays ambiguous between the Entity List and the Control List, so it is
  // deliberately not matched bare: 管制清单 is the CCL and must not put a question
  // on the party-screening lane. (It matches no rule at all today, so it falls
  // back to every lane — the fallback is a separate gap, not this rule firing.)
  const ccl = judgeIntent({ question: "CCL 管制清单里这一项的管制理由是什么" });
  assert.equal(ccl.reasons.trade, undefined, "管制清单 must not match the party-screening rule");

  // And a question that names both still gets both.
  const both = judgeIntent({ question: "对这个产品出口做受限方筛查" });
  assert.deepEqual(both.agents, ["trade", "product"]);
});

test("a question about a lane's own subject matches that lane", async () => {
  // The rules were written in English first and the Chinese half never caught
  // up, on any of the three lanes. A licence question, a Country Chart question,
  // a beneficial-ownership question and an ownership-aggregation question all
  // matched nothing at all and fell through to "run everything" — which reads
  // like a routing decision and is the absence of one.
  const { judgeIntent } = await import("../public/intent.js");

  const PROBE = [
    ["product", "需要许可证吗？"], ["product", "有没有可用的许可例外"],
    ["product", "这个料号的 CCL 管制清单条目是什么"], ["product", "查一下国别矩阵怎么读"],
    ["product", "de minimis 门槛怎么算"], ["product", "外国直接产品规则适用吗"],
    ["product", "这个型号的管制编码是多少"], ["product", "该物项属于哪一类管制"],
    ["tpdd", "这家代理的商业合理性怎么判断"], ["tpdd", "合同里服务范围写得太笼统"],
    ["tpdd", "对方要求打款到第三国账户"], ["tpdd", "需要做背景调查吗"],
    ["tpdd", "受益所有人没有披露"],
    ["trade", "这家公司的股权穿透到底是谁"], ["trade", "母公司是不是被列名主体"],
    ["trade", "50% 规则怎么算合计持股"], ["trade", "请对这家公司做名单筛查"]
  ];
  for (const [lane, question] of PROBE) {
    const verdict = judgeIntent({ question });
    assert.equal(verdict.matched, true, `${question} must match a rule rather than fall back`);
    assert.ok(verdict.agents.includes(lane), `${question} belongs on ${lane}, got [${verdict.agents}]`);
    assert.ok((verdict.reasons[lane] || []).length, `${question} must be able to name why ${lane} is on the path`);
  }

  // Widening must not blur the lanes into each other. 管制 is matched only in a
  // compound: bare, it is as much 出口管制管控名单 as 管制编码.
  assert.equal(judgeIntent({ question: "CCL 管制清单里这一项的管制理由是什么" }).reasons.trade, undefined);
  assert.equal(judgeIntent({ question: "这家公司的股权穿透到底是谁" }).reasons.product, undefined);
});

test("a source record reads as a record, not as its storage", async () => {
  // An address arrives from the publisher as a structured value, and the browser
  // was printing the structure: {"address":"172 Xibin Rd…","city":"Daqing",
  // "state":null,"postal_code":"163453","country":"CN"}. That is the field a
  // reader most often opens a source to read, rendered as the thing they least
  // wanted to see.
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const { fieldValue, PARTY_FIELDS } = await import(`data:text/javascript,${encodeURIComponent(
    source.slice(source.indexOf("const PARTY_FIELDS"), source.indexOf("\nfunction recordMarkup"))
      .replace("const PARTY_FIELDS", "export const PARTY_FIELDS")
      .replace("function fieldValue", "export function fieldValue"))}`);

  assert.equal(
    fieldValue([{ address: "172 Xibin Rd", city: "Daqing", state: null, postal_code: "163453", country: "CN" }]),
    "172 Xibin Rd, Daqing, 163453, CN"
  );
  assert.equal(fieldValue("EAR99"), "EAR99");
  assert.equal(fieldValue(null), "");
  assert.equal(fieldValue([]), "");
  // A truncated list says how much was cut rather than trailing off and letting
  // the reader assume they saw all of it.
  assert.equal(fieldValue(["a", "b", "c", "d", "e", "f"]), "a · b · c · d · +2");

  // Every field label is written in both languages, like everything else the
  // interface says for itself.
  for (const [, label] of PARTY_FIELDS) {
    assert.ok(label.zh && label.en, `${JSON.stringify(label)} needs both languages`);
  }
});

test("a disposition with no translation is not shown as its own key", async () => {
  // The OpenSanctions adapters emit a disposition the copy table never had, so
  // the reader was handed "disp_potential_match_requires_review". Saying nothing
  // beats showing an identifier.
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const adapters = await readFile(new URL("../src/data-layer/adapters-os.js", import.meta.url), "utf8");

  for (const [, value] of adapters.matchAll(/matchDisposition: "([a-z_]+)"/g)) {
    assert.ok(app.includes(`disp_${value}:`), `disp_${value} has no translation`);
  }
  assert.doesNotMatch(app, /\|\| record\.matchDisposition/, "an untranslated key must not fall through to the reader");
});

test("the composer never refuses a click it should accept", async () => {
  // Two ways this went wrong. An empty box in lookup mode is a request to browse
  // the whole source — the placeholder says exactly that — and it sat behind a
  // button that behaved as though there were nothing to send. And assigning to
  // .value fires no input event, so prefilling a question and then refusing to
  // send it was one keystroke away every time.
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function syncSubmitState\(\)/, "one definition of whether send is available");
  assert.match(app, /state\.busy \|\| \(empty && !state\.sourceQuery\)/,
    "an empty box only blocks send outside lookup mode");

  // Every programmatic fill goes through setComposer, because hunting call sites
  // is how the state drifted apart to begin with.
  const direct = [...app.matchAll(/\$\("questionInput"\)\.value = /g)].length;
  assert.equal(direct, 1, "only setComposer may assign the composer's value");
  assert.match(app, /function setComposer\(value\) \{\n  \$\("questionInput"\)\.value = value;\n  syncSubmitState\(\);/);
});

test("a lookup's output is the panel, and leaves the thread alone", async () => {
  // A lookup is not a turn in a conversation — nobody asked the system anything,
  // they opened a drawer. Paging through 25,921 records must not fill the thread
  // with a record of clicks.
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const lookup = app.slice(app.indexOf("async function runSourceQuery"), app.indexOf("\nasync function analyze"));

  assert.doesNotMatch(lookup, /threadInner/, "a lookup must not write to the thread");
  assert.match(lookup, /\$\("flowPanel"\)/, "it writes to the panel");
  assert.match(lookup, /sourcePanelMarkup\(source\)/, "with the source's own terms above the records");

  // The buttons moved with it, so the handler has to hear them there.
  assert.match(app, /\$\("flowPanel"\)\.addEventListener\("click", onWorkspaceClick\)/);
  assert.match(app, /\$\("threadInner"\)\.addEventListener\("click", onWorkspaceClick\)/);
});

test("the closing summary is not written inside a step it is not about", async () => {
  // A continuation streams into the box under the form the reader just
  // submitted — that box is where a continuation should be read. But the closing
  // summary is not about that step, and writing the final conclusion inside
  // "ownership aggregation" said the run was still working on a step it had
  // finished with two turns earlier.
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /const box = lane === "review"\n\s*\? synthesisBox\(\)/,
    "the synthesis is routed to its own box before the resume box is considered");
  assert.match(app, /function synthesisBox\(\)/);
  // Created next to the conclusion it is producing, which is outside every step.
  assert.match(app, /live\.querySelector\("\.conclusion"\) \|\| live\.querySelector\("\.analysis-path"\)/);

  // And the closing lane must not receive the same text a second time: two boxes
  // writing at once is indistinguishable from two things running at once.
  assert.match(app, /lane !== "review" && lane === progress\.activeLane/);
  assert.match(app, /progress\.activeLane !== "review" && progress\.text\[progress\.activeLane\]/);

  // The scaffold goes when the finished answer replaces it.
  assert.match(app, /live\.querySelector\("\[data-live-synthesis\]"\)\?\.remove\(\);/);
});

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { routeQuestion } from "../src/router.js";
import { classifyQuestionIntent } from "../src/question-intent.js";
import { collectGrounding } from "../src/grounding.js";
import { sourcesForAgents } from "../src/sources.js";
import { startStubModel } from "./helpers/stub-model.js";

// One stub endpoint for the file. These tests assert on what the deterministic
// layers computed — routing, path resolution, declared facts, clearance — and
// used to reach them with `mock: true`. That flag is gone, so what they need is
// a model to be reachable, not a stand-in for its answer.
let stub;
before(async () => { stub = await startStubModel(); });
after(async () => { await stub?.stop(); });

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

// What survives from three tests that asserted on the canned rules-mode text.
// That text is gone, and with it the only thing those tests were checking about
// it — but the intent classification underneath still decides how the question
// is scoped, and it is not covered anywhere else.
test("a policy question and a restriction question are scoped differently", async () => {
  assert.equal(classifyQuestionIntent("中国两用物项的policy是什么？"), "policy_lookup");
  assert.equal(classifyQuestionIntent("这个工业控制器是否属于中国受限产品？"), "product_restriction");
  // A policy question still has to ground against something, or the scoping
  // decision has nothing to apply to.
  const grounding = await collectGrounding("中国两用物项的policy是什么？", ["product"]);
  assert.equal(grounding.intent, "policy_lookup");
});

test("China policy sources are prioritized for a dual-use policy question", () => {
  const sources = sourcesForAgents(["product"], "中国两用物项的policy是什么？");
  assert.equal(sources[0].id, "china-dual-use-regulation");
  assert.ok(sources.slice(0, 4).some((source) => source.id === "china-dual-use-list-faq"));
  assert.ok(sources.every((source) => source.id.startsWith("china-dual-use-")));
  assert.match(sources.find((source) => source.id === "china-dual-use-license-directory").title, /2026/);
});

// A narrow classification question is scoped to classification, and the scoping
// is applied to whatever the model returned rather than to a canned answer. The
// version of this test that read the canned answer went with rules mode; this
// one hands the model's place a reply that wanders into route analysis and
// checks it does not survive.
test("a narrow classification question is scoped to classification", async () => {
  const question = "英伟达H100的ECCN值是多少？";
  assert.equal(classifyQuestionIntent(question), "product_metric");
  assert.deepEqual(sourcesForAgents(["product"], question).map((source) => source.id),
    ["bis-classify", "nvidia-export"]);

  const wanders = await startStubModel({
    answer: (body) => (/overallRisk/.test(JSON.stringify(body.messages))
      ? { overallRisk: "unknown", headline: "4A090.a", executiveSummary: "stub", nextStep: "stub" }
      : {
        agent: "product", riskLevel: "high", summary: "分类为 4A090.a",
        findings: [
          { title: "分类", detail: "该型号对应 4A090.a", evidenceSourceIds: [] },
          { title: "运输路线", detail: "经加拿大转运至墨西哥，最终用户未知", evidenceSourceIds: [] }
        ],
        missingInfo: ["最终用途"], recommendedActions: ["核对运输路线"]
      })
  });
  try {
    const { assessScenario } = await import("../src/orchestrator.js");
    const result = await assessScenario({ question, locale: "zh", config: wanders.config });
    const product = result.results.find((item) => item.agent === "product");
    assert.ok(product, "the product lane ran");
    // Route, destination and end-use belong to a transaction question. This one
    // asked for a published field, and answering it with a transit analysis the
    // user never asked about is what the scoping exists to stop.
    assert.doesNotMatch(JSON.stringify(product.findings), /运输路线|加拿大|墨西哥/);
    assert.equal(product.riskLevel, "unknown", "a factual lookup carries no risk verdict");
  } finally { await wanders.stop(); }
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
    { gemId: "eccn-watch", question: "100-000000009 的 ECCN 是什么？" }
  ];
  for (const { gemId, question } of noRisk) {
    const result = await assessScenario({ question, locale: "zh", config: stub.config, gemId });
    assert.ok(result.synthesis, `${gemId} must answer rather than ask`);
    assert.equal(result.synthesis.overallRisk, null, `${gemId} must state no risk level`);
    assert.ok(result.synthesis.headline, `${gemId} still answers`);
  }

  // A review gem still assesses, and still says so — the contrast is the point.
  const review = await assessScenario({
    question: "客户 Rhein Systeme GmbH，注册号 HRB 214553，德国杜塞尔多夫。直销一批办公笔记本，最终用途为该公司自身办公使用。",
    locale: "zh", config: stub.config,
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
    locale: "zh", config: stub.config,
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

  // A gem that produces a briefing settles it before the question is read at
  // all — a summary of what was published names no counterparty and no item.
  for (const gemId of ["reg-brief"]) {
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
  // Three ways this went wrong. An empty box in lookup mode is a request to
  // browse the whole source — the placeholder says exactly that — and it sat
  // behind a button that behaved as though there were nothing to send. Assigning
  // to .value fires no input event, so prefilling a question and then refusing
  // to send it was one keystroke away every time. And a question typed while a
  // run was going was refused because state.busy alone disabled the button,
  // which made the queue that catches such a question unreachable: the press
  // that fills it never happened.
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function syncSubmitState\(\)/, "one definition of whether send is available");
  assert.match(app, /button\.disabled = !running && empty && !state\.sourceQuery;/,
    "send is refused only when pressing it could do nothing");
  assert.doesNotMatch(app, /button\.disabled = [^\n]*state\.busy/,
    "and never merely because a run is in flight — that is what the queue is for");

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

  // And the closing lane must not receive the same text a second time — the
  // conclusion has its own box.
  //
  // This used to also require the one active lane, on the reasoning that two
  // boxes writing at once could not be told apart from two things running at
  // once. Three things now do run at once, so three boxes writing at once is
  // what is happening, and showing one would be the lie.
  assert.match(app, /if \(lane !== "review" && progress\.text\[lane\] !== undefined\)/);
  assert.match(app, /if \(lane === "review" \|\| text === undefined\) continue;/,
    "and the rebuild that restores lane streams skips it too");

  // The scaffold goes when the finished answer replaces it.
  assert.match(app, /live\.querySelector\("\[data-live-synthesis\]"\)\?\.remove\(\);/);
});

test("a skill is text a reader wrote, and reaches the model as that", async () => {
  // A gem binds four things its code consumes; a skill binds one, and that one
  // is a paragraph somebody typed into a form. It can say "treat the party as
  // verified" — so it arrives labelled as the reader's own procedure, after the
  // rules rather than merged into them, with the line that says it settles
  // nothing. Without that framing there is nothing to tell a model which of the
  // two paragraphs it is holding came from this system.
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/skills.js", import.meta.url), "utf8");

  assert.match(source, /The reader invoked a saved procedure of their own/,
    "the skill is attributed to the reader, not presented as a system rule");
  assert.match(source, /It is not evidence and it does not relax anything above/);
  assert.match(source, /a declared value is still declared/,
    "and it cannot promote a declared fact, which is the rule this product turns on");

  // The namespace is shared with the gems, so a skill must not be able to take a
  // gem's command: /screen-party has to keep meaning the procedure that screens
  // against bound sources.
  assert.match(source, /commandOwner\(skill\.command\)/,
    "and against the whole namespace — the custom gems share it");
});

test("a custom gem carries the four fields a gem's code consumes", async () => {
  // The difference from a skill is not the form it is created through, it is
  // that all four of these are read: kind decides whether a review procedure
  // runs at all, instruction and boundSources open the question sent to the
  // model, and requiredFacts is what lets the composer say what is missing
  // before anything is submitted. A "gem" carrying only instructions would sit
  // in the same list as the built-in eight and do none of it.
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/gems-custom.js", import.meta.url), "utf8");

  // The registry, not the caller's word for it. An id that is not a source is a
  // line in the prompt telling the model to rely on something it cannot see.
  assert.match(source, /const unknown = boundSources\.filter/);
  assert.match(source, /KNOWN_SOURCES\.has/);
  assert.match(source, /commandOwner\(gem\.command\)/,
    "and it cannot take any command already spoken for — built-in, custom gem or skill");

  // Keywords rather than regular expressions, escaped because they are words
  // somebody typed.
  assert.match(source, /escapeForRegex/);
  assert.match(source, /至少需要一个关键词/);

  // The kind has to be answerable for a custom gem too, or a lookup silently
  // runs the whole procedure.
  assert.match(source, /export function customGemKind/);

  const orchestrator = await readFile(new URL("../src/orchestrator.js", import.meta.url), "utf8");
  assert.match(orchestrator, /GEM_KINDS\[gemId\] \|\| customGemKind\(gemId\)/);
});

test("one fact rule serves both kinds of gem", async () => {
  // The built-in eight carry regular expressions and a custom gem carries words.
  // Both answer "does this draft appear to supply it", so both are answered in
  // the shared module — two call sites deciding it separately is how the sidebar
  // and the composer come to disagree about one draft.
  const { factCoverage, factLabel } = await import("../public/gems.js");

  const builtin = { requiredFacts: [{ key: "a", zh: "注册号", en: "Registration", match: /注册号|[0-9A-Z]{9,20}/ }] };
  const custom = { requiredFacts: [{ key: "b", label: "最终用户", keywords: ["最终用户", "end user"] }] };

  assert.equal(factCoverage(builtin, "统一社会信用代码 91440300778812XKA")[0].met, true);
  assert.equal(factCoverage(builtin, "客户在深圳")[0].met, false);
  assert.equal(factCoverage(custom, "最终用户为某数据中心")[0].met, true);
  assert.equal(factCoverage(custom, "END USER is a data centre")[0].met, true, "keywords match case-insensitively");
  assert.equal(factCoverage(custom, "经香港转口")[0].met, false);

  assert.equal(factLabel(builtin.requiredFacts[0], "zh"), "注册号");
  assert.equal(factLabel(custom.requiredFacts[0], "zh"), "最终用户");
});

test("gems and skills share one slash namespace and one check on it", async () => {
  // They are different things — a gem becomes the mode the composer is in, a
  // skill stays in the text and is parsed off the question — but both are found
  // by typing / and both answer to one token, so they share a namespace whether
  // or not they share a mechanism.
  //
  // They did not share a check. Each refused the built-in commands and its own
  // and never asked the other, so a skill and a custom gem could both claim
  // /tpdd-quick: the palette would list both and the parser would reach whichever
  // it looked for first.
  const { readFile } = await import("node:fs/promises");
  const registry = await readFile(new URL("../src/command-registry.js", import.meta.url), "utf8");

  assert.match(registry, /custom_gems/);
  assert.match(registry, /skills/);
  assert.match(registry, /GEMS\.map/, "and the built-in eight");

  // Read from the tables rather than through the two modules: having each import
  // the other's list is a cycle held together by nothing but where the calls sit.
  assert.doesNotMatch(registry, /from "\.\/skills\.js"/);
  assert.doesNotMatch(registry, /from "\.\/gems-custom\.js"/);
});

test("every gem sits at a desk, and the desks are the lanes", async () => {
  // The eight were one flat list of peers, and four of them led the same lane —
  // GEM_LEAD_LANE said so before anything in the interface did. So the desks are
  // the three lanes the whole product is built on, and the rest are the same
  // lane with the question already pointed at part of it.
  const { GEMS, DESK_BY_LANE, DEFAULT_GEM_ID, deskFor } = await import("../public/gems.js");
  const { GEM_LEAD_LANE } = await import("../src/analysis-path.js");

  const desks = GEMS.filter((gem) => gem.desk && !gem.coordinator);
  assert.deepEqual(desks.map((gem) => gem.lane).sort(), ["product", "tpdd", "trade"],
    "one desk per lane, and a lane with no desk is a lane with no way in but a narrow one");
  assert.equal(new Set(desks.map((gem) => gem.id)).size, desks.length);

  // Exactly one coordinator, it leads no lane, and it is what a reader who has
  // picked nothing is talking to. Two would make "the default" ambiguous; none
  // would put back the unnameable state this replaced.
  const coordinators = GEMS.filter((gem) => gem.coordinator);
  assert.equal(coordinators.length, 1);
  assert.equal(coordinators[0].id, DEFAULT_GEM_ID);
  assert.equal(coordinators[0].lane, null, "the coordinator leads no lane — it fans out to all three");
  assert.equal(coordinators[0].requiredFacts.length, 0, "and it takes any question, so it demands nothing");
  for (const [lane, id] of Object.entries(DESK_BY_LANE)) {
    assert.equal(GEMS.find((gem) => gem.id === id)?.lane, lane, `${id} must be the ${lane} desk`);
  }

  for (const gem of GEMS) {
    // The group is the lane, so the palette cannot file a gem under one desk
    // while the plan leads another.
    assert.ok(gem.lane || gem.coordinator, `${gem.id} must say which lane it is about`);
    assert.equal(GEM_LEAD_LANE[gem.id], gem.lane,
      "the plan's lead lane is read off the catalogue, not kept as a second copy");
    if (gem.desk) assert.equal(gem.group, "desk");
    else assert.equal(gem.group, gem.lane, `${gem.id} is grouped under the desk it belongs to`);
    assert.equal(deskFor(gem), gem.desk ? gem.id : DESK_BY_LANE[gem.lane]);
    assert.ok(gem.summary, `${gem.id} needs a one-line description — the sidebar rows carry it`);
  }

  // Every entry is a place to work from. /case-memo was the one that was not —
  // it took a thread that had already been analysed and wrote it up — and it is
  // gone: the answer a run already produces is the write-up.
  assert.equal(GEMS.filter((gem) => gem.kind === "memo").length, 0);
  assert.ok(GEMS.every((gem) => deskFor(gem)), "every gem sits at a desk");

  const app = await (await import("node:fs/promises")).readFile(new URL("../public/app.js", import.meta.url), "utf8");

  // The sidebar holds the three whatever the pin store says. Making them a
  // default pin would mean telling "never touched" from "unpinned all three",
  // and workspaceGemIds cannot: getItem gives null for the first and JSON.parse
  // gives [] for the second, and both leave that function as []. The reader who
  // removed all three would have found them back after a reload.
  assert.match(app, /const desks = allGems\(\)\.filter\(\(gem\) => gem\.desk\)/);
  assert.match(app, /allGems\(\)\.filter\(\(gem\) => !gem\.desk\s*\n?\s*&& \(pinned\.includes/,
    "and the pinned list holds everything else, so a desk is never listed twice");
});

test("a gem's own example satisfies its own required facts", async () => {
  // The scenario library shows each gem's placeholder as its worked example, and
  // nobody had ever run one past the check the gem performs on it. Seven of the
  // nine came back incomplete — /licence at 1 of 4 — so the product was
  // demonstrating its own entries by handing the reader a draft it then marked
  // as missing things.
  //
  // Most of it was the matcher rather than the example: the destination fact
  // accepted 出口到 and not 出口至, and the country fact listed 中国 and 德国 but
  // not China or Germany, so the English half of the same sentence failed where
  // the Chinese half passed. Those are gaps a real draft falls into too, which
  // is what makes this worth a test rather than a one-off correction.
  const { GEMS, factCoverage, factLabel } = await import("../public/gems.js");

  for (const locale of ["zh", "en"]) {
    for (const gem of GEMS) {
      const example = String(gem.placeholder?.[locale] || "").replace(/^(例：|e\.g\. )/, "");
      if (!gem.requiredFacts.length) continue;
      assert.ok(example, `${gem.command} has no ${locale} example`);
      const missing = factCoverage(gem, example).filter((fact) => !fact.met).map((fact) => factLabel(fact, locale));
      assert.deepEqual(missing, [],
        `${gem.command} (${locale}) shows an example its own composer marks incomplete: ${missing.join(", ")}`);
    }
  }
});

test("the live progress line does not report a screening that never happened", async () => {
  // The grounding handler was written for the review and then reached by all
  // five paths. Two things came out of that on a question answered rather than
  // reviewed: "专业 Agent 分析" as the stage, over a run where no specialist would
  // ever speak, and "已筛查 0 个名单来源 · undefined 条潜在命中 · undefined 条内部主
  // 数据关联" — three fields the answer paths do not carry.
  const app = await (await import("node:fs/promises"))
    .readFile(new URL("../public/app.js", import.meta.url), "utf8");

  // The counts, not the screening object. A review whose question named no party
  // carries screening: null with real counts of zero, so gating on the object
  // would take the line off the runs it belongs to as well.
  assert.match(app, /if \(typeof g\.listMatchCount === "number"\) \{/,
    "the screening line is drawn only where there are counts");
  assert.doesNotMatch(app, /\.replace\("\{matches\}", g\.listMatchCount\)/,
    "and never from a field that may be undefined");

  // screening is null on a review that named no party, which is the same case
  // that made the count the right thing to gate on. Reading through it without
  // the optional chain took the whole run down with "Cannot read properties of
  // null (reading 'screenedSources')" — a crash introduced by the fix for the
  // undefined above, in the line the fix rewrote.
  assert.match(app, /g\.screening\?\.screenedSources\?\.length \|\| 0/,
    "and it reads through a screening that may be null");
  assert.doesNotMatch(app, /g\.screening\.screenedSources/,
    "never straight off it");

  // And the stage only advances to the specialists when specialists are coming.
  assert.match(app, /progress\.specialists = event\.agents\.some/);
  assert.match(app, /if \(progress\.specialists\) renderSteps\(live, done, "agents"\)/);

  // Four of the five paths route to a lane that is not a specialist, which is
  // what made this reachable rather than theoretical.
  const orchestrator = await (await import("node:fs/promises"))
    .readFile(new URL("../src/orchestrator.js", import.meta.url), "utf8");
  for (const lane of ["briefing", "memo", "lookup", "consult"]) {
    assert.match(orchestrator, new RegExp(`type: "routed", id, agents: \\["${lane}"\\]`),
      `${lane} routes to itself, not to a specialist`);
  }
});

test("a turn that ran no procedure leaves the run panel alone", async () => {
  // The panel holds the analysis a follow-up is asking about. Clearing it when
  // the answer arrives takes away the thing the answer is about — and the reader
  // asked for it not to go. Three states, three different rules:
  //
  //   answered        the panel stays exactly as the review left it
  //   reviewed again  it is replaced, because there is a new procedure to show
  //   new conversation  it is emptied, which is the one case that should empty it
  const app = await (await import("node:fs/promises"))
    .readFile(new URL("../public/app.js", import.meta.url), "utf8");

  // No else-branch on the finish: a turn with no path falls through untouched.
  assert.match(app, /if \(finished\.analysisPath\) renderFlowPanel\(finished\.analysisPath[^\n]*\n(?![^\n]*else clearFlowPanel)/,
    "an answered turn does not clear the flow panel");
  assert.match(app, /if \(finished\.analysisPath \|\| \(finished\.sources \|\| \[\]\)\.length\) renderEvidence/,
    "nor blank the evidence list");

  // Reopening a case shows the last turn that actually ran one, which is not
  // always the last turn: a case can end on a question answered from the
  // analysis above it.
  assert.match(app, /if \(turn\.analysisPath\) reviewed = turn;/);
  assert.match(app, /if \(reviewed\) renderFlowPanel\(reviewed\.analysisPath/);

  // And a new conversation still empties it — the defect this rule must not
  // bring back. Not pinned to the first line: stopping the run it is leaving
  // comes before this, and where in the function it sits is not the rule.
  assert.match(app.slice(app.indexOf("function newConversation()")), /^[\s\S]{0,900}?clearFlowPanel\(\);/);
});

test("a question typed while a step is asking is a question, not that step's answer", async () => {
  // The composer routes what you type into a step still waiting on a value, so
  // the review carries on with one more fact rather than starting a second one.
  // The only guard was "does this read as a new transaction" — and a question is
  // neither a transaction nor a fact.
  //
  // So a follow-up asked after supplying a value was recorded as the value of
  // whichever field the next step wanted. That path resumes into the previous
  // message instead of adding one, which is why the reader's own words never
  // appeared anywhere: no bubble, no answer of its own, and the run reported
  // against a step nobody had been asked about.
  const { readsAsQuestion } = await import("../public/intent.js");

  for (const asked of [
    "补充上述三个信息就可以得出最终结论了吗，",
    "那一般来说 de minimis 门槛是怎么算的",
    "这样就够了吗",
    "为什么跳过了那一步",
    "Would that be enough?"
  ]) assert.equal(readsAsQuestion(asked), true, asked);

  // And the values a step actually wants are still values. Guessing this way
  // costs a resumed review; guessing the other way silently records a sentence
  // as a fact.
  for (const supplied of [
    "10–25%", "< 10%", "Aveox Technologies (Shenzhen) Co., Ltd.",
    "91440300778812XKA", "中国深圳", "该数据中心自用"
  ]) assert.equal(readsAsQuestion(supplied), false, supplied);

  const app = await (await import("node:fs/promises"))
    .readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /const readsAsDeclaredFact = \(text\) => !readsAsNewScenario\(text\) && !readsAsQuestion\(text\);/);
  assert.match(app, /if \(pending && text\.length >= 2 && readsAsDeclaredFact\(text\)\)/,
    "and the composer checks all three cases before treating a message as a fact");
});

test("a question asked mid-run is asked, not used to abandon the run", async () => {
  // The send button doubles as the stop button while a run is going, so
  // submitting a typed question called stopRun: the analysis died with "已停止。
  // 本次分析未完成，也未存入案件历史" and the question went with it. A reader who
  // asks something while waiting loses both.
  const app = await (await import("node:fs/promises"))
    .readFile(new URL("../public/app.js", import.meta.url), "utf8");

  // Empty box means stop. Text in the box cannot also mean stop.
  assert.match(app, /if \(!\$\("questionInput"\)\.value\.trim\(\)\) return state\.run \? stopRun\(\) : undefined;/);
  assert.match(app, /state\.queued = true;/);

  // state.busy, not state.busy && state.run: a source query is busy with nothing
  // to abort, and falling past this into analyze returned on its own busy check
  // — a press that did nothing and said nothing.
  assert.match(app, /\$\("questionForm"\)\.addEventListener\("submit", \(event\) => \{\s*\n\s*if \(state\.busy\) \{/);

  // Released by whichever kind of run was in the way, and re-entered through the
  // form so the queued text takes the same path it would have taken at any other
  // moment — including the branch that hands text to a step still asking.
  assert.equal([...app.matchAll(/flushQueued\(\);/g)].length, 2,
    "both the analysis and the source query release it");
  assert.match(app, /function flushQueued\(\) \{[\s\S]*?requestSubmit\(\)/);
});

test("what the reader types is shown, whichever route it takes", async () => {
  // Two routes out of the composer: a question that starts a run, and a value
  // handed to a step that is still asking. Only the first left a trace. The
  // second cleared the box, resumed the analysis inside the answer already on
  // screen, and put what had been typed nowhere at all — "点击发送不显示用户输入"
  // is that, exactly, and it needs no run in flight and no unusual phrasing.
  const app = await (await import("node:fs/promises"))
    .readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function showUserMessage\(text, gem = null\) \{/,
    "one place that puts the reader's words on screen");
  // Both routes call it, and nothing else writes a user bubble by hand.
  assert.equal([...app.matchAll(/showUserMessage\(/g)].length, 3,
    "defined once, called from the run and from the step-answer branch");
  assert.equal([...app.matchAll(/class="msg msg-user"/g)].length, 2,
    "and the markup exists in that helper and in the case replay, nowhere else");

  // The value still reaches the step — it is shown as well, not instead.
  assert.match(app, /showUserMessage\(text, state\.activeGem\);\s*\n\s*state\.conversation\.push\(\{ role: "user", content: text \}\);\s*\n\s*setComposer\(""\);\s*\n\s*pending\.querySelector\("\.si-submit"\)\?\.click\(\);/);
});

test("a new conversation abandons the run it left behind", async () => {
  // Pressing 新对话 emptied the thread and left the analysis running. state.busy
  // stayed true with nothing on screen to account for it, so the next question
  // typed came back "本轮分析结束后自动发出" — queued behind a run the reader had
  // walked away from, in a thread that no longer existed. It then fired on its
  // own when that run finished.
  const app = await (await import("node:fs/promises"))
    .readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function newConversation\(\) \{[\s\S]{0,600}?\n  stopRun\(\);\n  state\.busy = false;\n  state\.queued = false;\n  syncSubmitState\(\);/,
    "a new conversation stops the run, clears the queue, and says so to the button");

  // Before clearFlowPanel, so nothing downstream of it runs against a state that
  // still claims to be busy.
  const body = app.slice(app.indexOf("function newConversation()"));
  assert.ok(body.indexOf("stopRun();") < body.indexOf("clearFlowPanel();"),
    "and does it first");

  // The queue itself is unchanged: a question typed while a run is going is
  // still held rather than discarded.
  assert.match(app, /state\.queued = true;/);
  assert.match(app, /function flushQueued\(\) \{/);
});

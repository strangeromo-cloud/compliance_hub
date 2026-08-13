import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { startStubModel } from "./helpers/stub-model.js";

// One stub endpoint for the file. These tests assert on what the deterministic
// layers computed — routing, path resolution, declared facts, clearance — and
// used to reach them with `mock: true`. That flag is gone, so what they need is
// a model to be reachable, not a stand-in for its answer.
let stub;
before(async () => { stub = await startStubModel(); });
after(async () => { await stub?.stop(); });

// A database of this test's own, seeded with what a clear outcome requires.
//
// The scenario test below used to run against whatever the developer happened
// to have synced, so it passed here and failed in a clean clone: clearance
// needs trade-csl screened, and a fresh checkout has screened nothing. A test
// that depends on ambient local data cannot gate anything.
const DIR = mkdtempSync(join(tmpdir(), "hub-clearance-"));
process.env.HUB_DB_PATH = join(DIR, "test.db");

const { assessClearance } = await import("../src/clearance.js");
const { findNamesMentioned } = await import("../src/entity-matching.js");
const { saveSourceData } = await import("../src/data-layer/storage.js");
const { closeDb } = await import("../src/data-layer/db.js");

// Two parties neither scenario names, so screening runs and finds nothing —
// which is the state a clear outcome has to be reachable from.
before(async () => {
  await saveSourceData({
    sourceId: "trade-csl",
    extension: "json",
    bytes: Buffer.from("[]"),
    records: [
      { recordId: "T1", entityName: "Kestrel Machine Works LLC", sourceList: "Entity List (EL) - Bureau of Industry and Security", country: "RU" },
      { recordId: "T2", entityName: "Orion Marine Holdings", sourceList: "Specially Designated Nationals (SDN) - Treasury Department", country: "IR" }
    ],
    metadata: { syncScope: "test_fixture" }
  });
});

after(() => { closeDb(); rmSync(DIR, { recursive: true, force: true }); });

// A screening pass that found nothing, over lists that were actually screened.
const CLEAN = { screening: { screenedSources: [{ sourceId: "trade-csl" }], unsyncedSources: [] }, listMatches: [] };
const CLEAR_FACTS = { eccn: "EAR99", destination: "德国", endUse: "该公司自身办公使用，无转售、无军事或核相关用途" };
const CLEAR_QUESTION = "我们直销一台笔记本给德国客户，无中间商、无代理。";

const clear = (overrides = {}) => assessClearance({
  question: overrides.question ?? CLEAR_QUESTION,
  facts: { ...CLEAR_FACTS, ...(overrides.facts || {}) },
  grounding: overrides.grounding || CLEAN,
  path: overrides.path ?? null
});

test("a file that meets every condition reaches a clear outcome", () => {
  const verdict = clear();
  assert.equal(verdict.cleared, true, verdict.unmet.map((check) => check.because?.zh ?? check.because).join(" | "));
  // A conclusion without its conditions is indistinguishable from an approval.
  assert.ok(verdict.conditions.length >= 3);
  // Carried in both languages: a conclusion states its conditions to whoever is
  // reading it.
  assert.ok(verdict.conditions.some((line) => /762/.test(line.zh)), "record-keeping survives a clear outcome");
  assert.ok(verdict.conditions.every((line) => line.zh && line.en), "each condition is written in both languages");
  for (const check of verdict.checks) assert.ok(check.cite, `${check.id} must name the provision it rests on`);
});

test("silence never clears", () => {
  // Each of these is a fact nobody stated. None may be read as favourable.
  const missing = [
    ["destination", { destination: "" }],
    ["end use", { endUse: "" }],
    ["classification", { eccn: "" }]
  ];
  for (const [what, facts] of missing) {
    assert.equal(clear({ facts }).cleared, false, `an unstated ${what} must not clear`);
  }
  // An intermediary nobody mentioned is not an intermediary nobody has.
  assert.equal(clear({ question: "我们向德国客户出口一台笔记本。" }).cleared, false,
    "a transaction that says nothing about routing must not clear");
});

test("a placeholder answer is not a fact", () => {
  for (const value of ["不确定", "已提供", "TBD", "—"]) {
    assert.equal(clear({ facts: { endUse: value } }).cleared, false, `"${value}" decides nothing`);
  }
});

test("an unscreened US list blocks a clear outcome", () => {
  const verdict = clear({ grounding: { screening: { screenedSources: [{}], unsyncedSources: ["trade-csl"] }, listMatches: [] } });
  assert.equal(verdict.cleared, false);
  // Named in both languages: a reader on either side has to be told which list
  // went unsearched, not just that one did.
  assert.match(verdict.unmet[0].because.zh, /trade-csl|综合筛查/, "the Chinese answer must name what was not screened");
  assert.match(verdict.unmet[0].because.en, /trade-csl|Consolidated Screening/, "the English answer must name what was not screened");
});

test("a potential list match blocks a clear outcome", () => {
  const verdict = clear({ grounding: { screening: { screenedSources: [{}], unsyncedSources: [] }, listMatches: [{ entityName: "X" }] } });
  assert.equal(verdict.cleared, false);
});

test("a step still waiting on an answer blocks a clear outcome", () => {
  const path = { lanes: [{ steps: [{ status: "evidence_needed", title: "所有权穿透" }] }] };
  const verdict = clear({ path });
  assert.equal(verdict.cleared, false, "an incomplete file does not clear");
  assert.deepEqual(verdict.openSteps, ["所有权穿透"]);
});

test("a stated denial of a sensitive end use is read as a denial", () => {
  // The regression: "无军事或核相关用途" contains 军事 and 核, so testing the
  // sentence for those words turned the declarant's denial into the reason the
  // case could not clear. Same family as the router reading "无中间商" as a
  // mention of an intermediary.
  for (const endUse of [
    "该公司自身办公使用，无转售、无军事或核相关用途",
    "该公司自有产线自用，非转售、非军事用途",
    "The company's own office use; no resale, no military or nuclear application",
    "Their own production line; not for resale, not a military application"
  ]) {
    assert.equal(clear({ facts: { endUse } }).cleared, true, `"${endUse}" is a denial, not an admission`);
  }
});

test("a denial elsewhere in the sentence does not excuse a real prohibited use", () => {
  for (const endUse of [
    "无转售，但最终用于导弹项目",
    "no resale, but the unit goes into a missile programme",
    "交付给某军事研究所用于测试",
    "for a military research institute"
  ]) {
    assert.equal(clear({ facts: { endUse } }).cleared, false, `"${endUse}" must not clear`);
  }
});

test("a destination nobody wrote a rule for does not fall through into fine", () => {
  // An allow-list, not a block-list. Iran must fail, and so must a country the
  // list simply does not mention.
  for (const destination of ["伊朗", "Iran", "白俄罗斯", "Kazakhstan"]) {
    assert.equal(clear({ facts: { destination }, question: "我们直销一台笔记本，无中间商。" }).cleared, false,
      `${destination} is not on the unrestricted list, so it must not clear`);
  }
});

test("a short alias matches a word, not a run of letters inside one", async () => {
  // Both of these were live screening hits: "IFIC" inside "classification"
  // reported Iran Foreign Investment Company, and "NADA" inside "Canada"
  // reported the DPRK's National Aerospace Development Administration.
  const records = [
    { entityName: "IRAN FOREIGN INVESTMENT COMPANY", aliases: ["IFIC"] },
    { entityName: "National Aerospace Development Administration", aliases: ["NADA"] }
  ];
  assert.deepEqual(findNamesMentioned("The classification is EAR99 and the buyer is in Canada.", records), []);
  // And it still finds the alias when it is actually used as one.
  assert.equal(findNamesMentioned("The counterparty is NADA in Pyongyang.", records).length, 1);
});

test("every scenario advertised as clearing actually clears", async () => {
  // The page offers these as cases that reach a conclusion. If one stops asking
  // for evidence instead, the offer is false — so it is checked here rather
  // than trusted.
  const { assessScenario } = await import("../src/orchestrator.js");
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const { scenarios } = await import(`data:text/javascript,${encodeURIComponent(
    source.slice(source.indexOf("const scenarios = {"), source.indexOf("\nconst state = {")).replace("const scenarios", "export const scenarios"))}`);

  for (const locale of ["zh", "en"]) {
    const clearing = scenarios[locale].filter((item) => item.id.startsWith("C"));
    assert.ok(clearing.length, `${locale} should offer scenarios that clear`);
    for (const item of clearing) {
      assert.ok(item.facts, `${item.id} carries the declarations it depends on`);
      const result = await assessScenario({ question: item.question, locale, config: stub.config, declaredFacts: item.facts });
      assert.equal(result.awaitingInput, null, `${locale} ${item.id} should not stop to ask`);
      // On the clearance decision, not on the risk level. The risk level is the
      // model's word for it and a stub has no opinion; whether every condition
      // was met is computed here and is the thing the offer actually promises.
      assert.equal(result.grounding?.clearance?.cleared, true, `${locale} ${item.id} should clear`);
    }
  }
});

test("the party step resolves a partial name instead of asking for the full one", async () => {
  // It used to settle only when the question carried a legal suffix, so
  // "客户 Aveox Technologies" stopped the run to ask for a name the corpus
  // already held — and typing it changed nothing the reader could see.
  const { fuzzyPartyCandidates } = await import("../src/entity-matching.js");
  const records = [
    { sourceId: "list", entityName: "艾维奥克斯公司", aliases: ["Aveox, Inc."], country: "US" },
    { sourceId: "list", entityName: "Red Cat Holdings, Inc.", country: "US" },
    { sourceId: "list", entityName: "Beijing China Aviation Technology Co., Ltd", aliases: ["B-CAT"], country: "CN" }
  ];

  const found = fuzzyPartyCandidates("客户 Aveox Technologies 通过新加坡代理商采购服务器", records);
  assert.equal(found.length, 1);
  assert.equal(found[0].entityName, "艾维奥克斯公司", "a partial name must still reach the register entry");

  // The failure this replaced: "B-CAT" normalises to the single token "cat", so
  // any question mentioning a cat matched a Beijing aviation company. One short
  // word is not evidence of an identity.
  assert.deepEqual(fuzzyPartyCandidates("向 Red Cat Holdings 出售 20 台服务器", records).map((item) => item.entityName),
    ["Red Cat Holdings, Inc."]);

  // And nothing at all when the question names nobody.
  assert.deepEqual(fuzzyPartyCandidates("出口一批服务器，请判断是否需要许可", records), []);
});

test("two candidates means two different entities", async () => {
  // The same company appears more than once across sources, differing in case or
  // punctuation or nothing. Returning it twice fills both slots with a choice
  // that is not a choice — the point of keeping two is a real ambiguity.
  const { fuzzyPartyCandidates } = await import("../src/entity-matching.js");
  const records = [
    { sourceId: "a", entityName: "HUAWEI TECHNOLOGIES CO., LTD." },
    { sourceId: "b", entityName: "Huawei Technologies Co., Ltd." },
    { sourceId: "c", entityName: "Huawei Device Co., Ltd." }
  ];
  const found = fuzzyPartyCandidates("请对交易方 Huawei Technologies 做受限方筛查", records, { limit: 2 });
  assert.equal(found.length, 2);
  const normalized = found.map((item) => item.entityName.toLowerCase().replace(/[^a-z]/g, ""));
  assert.notEqual(normalized[0], normalized[1], "the two candidates must not be the same company twice");
});

test("a resolved party carries its candidates into the step that disambiguates", async () => {
  const { planAnalysisPath, resolveAnalysisPath } = await import("../src/analysis-path.js");
  const question = "客户 Aveox Technologies 是我们的直销客户，请做受限方筛查";
  const grounding = {
    screening: { screenedSources: [{ sourceId: "list", recordCount: 3, capturedAt: "2026-07-31" }], unsyncedSources: [] },
    listMatches: [],
    internalParties: [],
    limitations: [],
    partyCandidates: [{ entityName: "艾维奥克斯公司", matchedName: "Aveox, Inc.", sourceId: "list", matchScore: 0.8 }]
  };
  const path = resolveAnalysisPath(planAnalysisPath({ agents: ["trade"], question }), { question, grounding, declaredFacts: {}, final: true });
  const steps = path.lanes.flatMap((lane) => lane.steps);

  const { localizeLines } = await import("../src/path-i18n.js");
  const shown = (step) => localizeLines(step.basis, "zh").concat(localizeLines(step.needs, "zh"));

  const party = steps.find((item) => item.id === "identify_party");
  assert.equal(party.status, "confirmed", "a resolved candidate settles the step rather than asking");
  assert.ok(shown(party).some((line) => line.includes("艾维奥克斯公司")), "the candidate is named in the basis");
  assert.ok(shown(party).some((line) => /名称相似不等于同一主体/.test(line)),
    "a similarity score must never read as an identification");

  // Nothing was screened as a designated name, but a candidate was found — so
  // there is something to disambiguate, and calling it not applicable would drop
  // what the previous step just produced.
  const resolution = steps.find((item) => item.id === "identity_resolution");
  assert.equal(resolution.status, "evidence_needed");
  assert.ok(shown(resolution).some((line) => line.includes("艾维奥克斯公司")));
});

test("a lookup is answered, not put through a review", async () => {
  // "what is this part's ECCN" has no counterparty, no destination and no
  // transaction, so there is nothing for a compliance procedure to work on.
  // Running one produced three lanes and a paragraph about routes and end users
  // instead of the value that was asked for.
  const { assessScenario } = await import("../src/orchestrator.js");
  const { lookupSubject } = await import("../src/lookup.js");

  for (const question of ["100-000000009 这个AMD 的ECCN是什么？", "1C351 是什么", "4A090.a 是什么意思"]) {
    assert.ok(lookupSubject(question), `${question} should be recognised as a lookup`);
    const result = await assessScenario({ question, locale: "zh", config: stub.config });
    assert.equal(result.intent, "data_lookup");
    assert.deepEqual(result.analysisPath.lanes.map((lane) => lane.lane), ["lookup"],
      "a lookup runs one lane and never reaches the closing step");
    assert.equal(result.results.length, 0, "no specialist is spent on a stored value");
    assert.equal(result.awaitingInput, null, "a lookup never stops to interrogate");
    assert.ok(result.synthesis, "it answers");
    // A completed search that found nothing is finished, not blocked.
    assert.equal(result.analysisPath.lanes[0].steps[0].status, "confirmed");
  }

  // A question that names a transaction is not a lookup, whatever else it holds.
  assert.equal(lookupSubject("我们把 100-000000009 出口到伊朗给某军事研究所，需要许可吗"), null);
  assert.equal(lookupSubject("向德国客户直销一台服务器，无中间商"), null);
});

test("a lookup answers from the data and says what it searched", async () => {
  const { resolveLookup } = await import("../src/lookup.js");

  const known = await resolveLookup("100-000000009 这个AMD 的ECCN是什么？");
  assert.equal(known.found[0]?.value, "5A992.c", "AMD's own table answers its own part number");
  assert.ok(known.searched.length, "it must say which records it read");

  // A part number nobody publishes is where the honest answer matters: absent
  // from this data and "no such classification" are different claims, and only
  // the first is one this system can make.
  const missing = await resolveLookup("ZZ-999999999 的 ECCN 是什么");
  assert.equal(missing.found.length, 0);
  assert.ok(missing.searched.length, "it must still say which records it read");
  assert.match(missing.elsewhere, /厂商|BIS/, "and where the answer actually lives");

  const { assessScenario } = await import("../src/orchestrator.js");
  const answer = await assessScenario({ question: "ZZ-999999999 的 ECCN 是什么", locale: "zh", config: stub.config });
  assert.ok(answer.grounding.limitations.some((line) => /未收录不等于不受管制/.test(line)));
});

test("a source that could not be searched is named, not omitted", async () => {
  // The report this pins: an AMD part number answered "not in the ingested data"
  // while AMD's own product master was unsynced and therefore never read. Both
  // read-and-absent and never-read produced the same sentence, and for a vendor
  // part number the second is the entire answer.
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "hub-lookup-"));
  const previous = process.env.HUB_DB_PATH;
  process.env.HUB_DB_PATH = join(dir, "test.db");

  try {
    // A fresh module graph, so the database path above is the one it opens.
    const storage = await import(`../src/data-layer/storage.js?no-amd`);
    await storage.saveSourceData({
      sourceId: "nvidia-export", extension: "json", bytes: Buffer.from("[]"),
      records: [{ partNumber: "900-21010-0000-000", eccn: "4A090.a", vendor: "NVIDIA" }], metadata: {}
    });

    const { resolveLookup } = await import(`../src/lookup.js?no-amd`);
    const lookup = await resolveLookup("100-000000009 这个AMD 的ECCN是什么？");
    // AMD ships a bundled copy, so the table is never simply absent — but an
    // answer taken from a point-in-time copy has to say that it is one.
    assert.ok(lookup.found.length, "the bundled copy answers when the live table is unsynced");
    assert.ok(lookup.found.every((item) => item.fallback), "every value must carry the tag");
    assert.ok(lookup.searched.some((source) => source.sourceId === "amd-export" && source.fallback),
      "and the source line must say it is a committed copy");

    const { assessScenario } = await import(`../src/orchestrator.js?no-amd`);
    const answer = await assessScenario({ question: "100-000000009 这个AMD 的ECCN是什么？", locale: "zh", config: stub.config });
    assert.ok(answer.grounding.limitations.some((line) => /时点副本/.test(line)),
      "a point-in-time copy must never answer as though it were the current table");
  } finally {
    if (previous === undefined) delete process.env.HUB_DB_PATH;
    else process.env.HUB_DB_PATH = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the ownership chain is taken from the register, never guessed at", async () => {
  const { resolveOwnership } = await import("../src/ownership.js");

  // GLEIF's name filter is not an exact match, and attributing another company's
  // parent to this counterparty is the worst thing this lookup could do. Asking
  // for "Volkswagen Financial AG" returns Volkswagen Financial Services AG and
  // its Swiss and overseas siblings — a containment score would accept any of
  // them; identity is required.
  const loose = await resolveOwnership("Volkswagen Financial AG");
  assert.ok(loose.noConfidentMatch, "a near name must not be used to attribute ownership");
  assert.ok(loose.rejected.some((item) => /Financial Services/.test(item.name)),
    "and what was rejected is named, so the reader sees a decision rather than an empty search");

  const exact = await resolveOwnership("Siemens Energy Global GmbH & Co. KG");
  assert.equal(exact.subject.name, "Siemens Energy Global GmbH & Co. KG");
  assert.ok(exact.directParent?.lei, "the register publishes the chain, so it is not asked for");
  // The distinction the whole thing rests on.
  assert.match(exact.meaning, /不含持股比例/);
});

test("a resolved chain does not become a 50 Percent Rule conclusion", async () => {
  const { planAnalysisPath, resolveAnalysisPath } = await import("../src/analysis-path.js");
  const question = "请对交易方 Acme GmbH 做受限方筛查";
  const chain = {
    subject: { name: "Acme GmbH", lei: "LEI0000000000000001", country: "DE" },
    directParent: { name: "Acme Holding AG", lei: "LEI0000000000000002" },
    ultimateParent: { name: "Acme Holding AG", lei: "LEI0000000000000002" },
    meaning: "GLEIF 的母公司关系指会计合并母公司，不含持股比例"
  };
  const base = {
    screening: { screenedSources: [{ sourceId: "trade-csl", recordCount: 2, capturedAt: "2026-07-31" }], unsyncedSources: [] },
    internalParties: [], limitations: [], partyCandidates: [], ownership: chain
  };

  const clean = resolveAnalysisPath(planAnalysisPath({ agents: ["trade"], question }),
    { question, grounding: { ...base, listMatches: [] }, declaredFacts: {}, final: true });
  const { localizeLines } = await import("../src/path-i18n.js");
  const zh = (step) => localizeLines(step.basis, "zh").concat(localizeLines(step.needs, "zh"));

  const settled = clean.lanes.flatMap((lane) => lane.steps).find((item) => item.id === "ownership");
  assert.equal(settled.status, "confirmed", "a chain plus no designated name leaves nothing to compute");
  assert.ok(zh(settled).some((line) => /不含持股比例/.test(line)),
    "what the register does not publish must be said where the chain is shown");

  // The moment a designated name is in play, the percentage is the question and
  // the register cannot answer it.
  const hit = resolveAnalysisPath(planAnalysisPath({ agents: ["trade"], question }),
    { question, grounding: { ...base, listMatches: [{ entityName: "Acme Holding AG", matchScore: 0.9 }] }, declaredFacts: {}, final: true });
  const open = hit.lanes.flatMap((lane) => lane.steps).find((item) => item.id === "ownership");
  assert.equal(open.status, "evidence_needed");
  assert.ok(zh(open).some((line) => /直接母公司/.test(line)), "the chain is still shown");
  assert.ok(zh(open).some((line) => /50%/.test(line)), "and the aggregate is still asked for");
});

test("a gem's kind decides whether a review procedure applies at all", async () => {
  // /reg-brief names no counterparty, no item and no destination. Running it
  // through the review procedure produced a party-screening step for a question
  // with no party in it: the gem said which lane to open with, and nothing said
  // whether to open any.
  const { assessScenario } = await import("../src/orchestrator.js");
  const { GEM_KINDS } = await import("../src/gem-kinds.js");
  const { GEMS } = await import("../public/gems.js");

  // Every gem declares one, so a new gem cannot be added without deciding.
  // "route" is a decision too — the coordinator's, that the question decides —
  // and it is a named value rather than a null so that it cannot be confused
  // with a gem whose author never said.
  for (const gem of GEMS) {
    assert.ok(["review", "lookup", "briefing", "route"].includes(gem.kind), `${gem.id} has no usable kind`);
    if (gem.kind === "route") assert.ok(gem.coordinator, "only the coordinator defers its kind to the question");
    assert.equal(GEM_KINDS[gem.id], gem.kind, "the server reads the same catalogue the page does");
  }

  const brief = await assessScenario({
    question: "汇总最近 6 个月中国出口管制管控名单和两用物项公告的变化",
    locale: "zh", config: stub.config, gemId: "reg-brief"
  });
  assert.deepEqual(brief.analysisPath.lanes.map((lane) => lane.lane), ["briefing"]);
  assert.equal(brief.awaitingInput, null, "a summary of published notices asks nobody anything");
  assert.equal(brief.results.length, 0);
  assert.ok(brief.grounding.limitations.some((line) => /属于审查而非汇总/.test(line)),
    "listing what was published is not the same as saying it applies");

  // A review gem still gets the procedure.
  const review = await assessScenario({
    question: "我们通过新加坡代理商向中国最终用户出口服务器", locale: "zh", config: stub.config, gemId: "screen-party"
  });
  assert.ok(review.analysisPath.lanes.some((lane) => lane.lane === "trade"));

  // The coordinator changes nothing about how a question is answered — it is
  // the behaviour of no gem at all, with a name. It is selected by default, so
  // anything it forced would be forced on every question asked without choosing.
  // What it could force is the lead lane: a lane here reorders the plan, and the
  // assertion below is the one that catches it.
  const asHub = await assessScenario({
    question: "我们通过新加坡代理商向中国最终用户出口服务器", locale: "zh", config: stub.config, gemId: "hub"
  });
  const asNone = await assessScenario({
    question: "我们通过新加坡代理商向中国最终用户出口服务器", locale: "zh", config: stub.config
  });
  assert.deepEqual(asHub.analysisPath.lanes.map((lane) => lane.lane), asNone.analysisPath.lanes.map((lane) => lane.lane),
    "the coordinator leads no lane, so the plan is the one an unselected question gets");
  assert.equal(asHub.analysisPath.lanes.filter((lane) => lane.leading).length, 0,
    "and nothing leads — fanning out to all three is what it means");
});

test("a briefing states its window and what it could not read", async () => {
  const { buildBriefing, windowFor } = await import("../src/briefing.js");
  const now = Date.parse("2026-07-31T00:00:00Z");

  // The period comes from the question. Answering "past two years" with a fixed
  // six-month window would silently ignore what was asked.
  assert.equal(windowFor("最近 6 个月有什么变化", now).days, 180);
  assert.equal(windowFor("过去 2 年的变化", now).days, 730);
  const defaulted = windowFor("有什么新公告", now);
  assert.equal(defaulted.stated, false, "an unstated window is reported as chosen, not as asked for");

  const brief = await buildBriefing("汇总最近 6 个月的公告变化", now);
  assert.ok(brief.searched.length, "it must say which sources it read");
  assert.ok(brief.items.every((item) => item.date >= brief.window.since), "nothing outside the window");
  // Ordered newest first, and every line traceable to a notice.
  const dates = brief.items.map((item) => item.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.ok(brief.items.every((item) => item.noticeNumber || item.sourceUrl),
    "a regulatory summary whose items cannot be traced back to a notice is worth nothing");
});

test("a briefing says what changed, not which files exist", async () => {
  // The first version listed notice numbers and dates. A list of file names is
  // not a summary of changes — and the titles state the change outright, so
  // classifying them is reading rather than inferring.
  const { classifyNotice, buildBriefing } = await import("../src/briefing.js");

  const added = classifyNotice("商务部公告2026年第27号 公布将20家日本实体列入出口管制管控名单");
  assert.equal(added.action, "added");
  assert.equal(added.list, "control");
  assert.equal(added.entityCount, 20);
  assert.equal(added.subjectCountry, "日本");

  assert.equal(classifyNotice("公布将某实体移出不可靠实体清单").action, "removed");
  assert.equal(classifyNotice("关于暂停实施出口管制措施的公告").action, "suspended");
  assert.equal(classifyNotice("关于进一步完善举报处理工作有关事项").action, "adjusted");

  const brief = await buildBriefing("汇总最近 6 个月的公告变化", Date.parse("2026-07-31T00:00:00Z"));
  assert.ok(brief.rollup, "the period has to add up to something");
  assert.equal(brief.rollup.added + brief.rollup.adjusted + brief.rollup.removed
    + brief.rollup.suspended + brief.rollup.repealed <= brief.items.length, true);

  // One notice is one change, whichever registers carry it. 第27号 appears in
  // both the dual-use notices and the control-list notices, and counting it once
  // per source turned twenty Japanese entities into eighty.
  const numbers = brief.items.map((item) => item.noticeNumber).filter(Boolean);
  assert.equal(numbers.length, new Set(numbers).size, "a notice must appear once");
  const multi = brief.items.filter((item) => item.sourceLabels?.length > 1);
  assert.ok(multi.length, "and the registers that carry it are still recorded");
});

test("a register is asked the way it records, not the way people write", async () => {
  // Volkswagen AG is registered with GLEIF as VOLKSWAGEN AKTIENGESELLSCHAFT.
  // Asking for the abbreviation returned six subsidiaries without the company
  // among them — the lookup was failing on the query, not on the matching.
  const { nameVariants, scoreNameMatch } = await import("../src/entity-matching.js");

  assert.deepEqual(nameVariants("Volkswagen AG"), ["Volkswagen AG", "Volkswagen Aktiengesellschaft"]);
  assert.deepEqual(nameVariants("Sakura KK"), ["Sakura KK", "Sakura Kabushiki Kaisha"]);
  assert.deepEqual(nameVariants("某某公司"), ["某某公司"], "nothing to expand is not an error");

  // And the two forms compare as the same entity, which they are.
  for (const [written, registered] of [
    ["Volkswagen AG", "VOLKSWAGEN AKTIENGESELLSCHAFT"],
    ["Siemens AG", "Siemens Aktiengesellschaft"],
    ["Acme BV", "Acme Besloten Vennootschap"],
    ["Acme Ltd", "Acme Limited"]
  ]) {
    assert.equal(scoreNameMatch(written, registered).basis, "normalized_name_identical", `${written} / ${registered}`);
  }

  // The expansion must not eat a word that is part of a name rather than a form.
  const real = "Gesellschaft für Nuklear-Service mbH";
  assert.ok(scoreNameMatch(real, real).basis === "normalized_name_identical");
  assert.notEqual(scoreNameMatch(real, "Nuklear-Service mbH").basis, "normalized_name_identical",
    "stripping a form must not turn two different names into one");
});

test("a record the register has retired is not a candidate", async () => {
  // Two LEIs carry the legal name VOLKSWAGEN AKTIENGESELLSCHAFT; GLEIF marks one
  // DUPLICATE. Which to use is published, so it is read rather than guessed at
  // or handed to the reader as an ambiguity.
  const { resolveOwnership } = await import("../src/ownership.js");
  const found = await resolveOwnership("Volkswagen AG");
  assert.ok(found.subject, "the abbreviation now reaches the register entry");
  assert.equal(found.subject.registrationStatus, "ISSUED");
  assert.equal(found.subject.status, "ACTIVE");
  assert.ok(!found.otherCandidates.some((item) => /DUPLICATE/i.test(item.registrationStatus || "")),
    "a duplicate registration must not be offered as an alternative either");
});

test("the English answer runs an English procedure", async () => {
  // The path was written in one language and stayed that way: lane names, step
  // titles and every input label came back in Chinese however the interface was
  // set, so an English reader got an English conclusion over a Chinese procedure.
  const { assessScenario } = await import("../src/orchestrator.js");
  const { TRANSLATABLE_TERMS } = await import("../src/path-i18n.js");
  const { planAnalysisPath } = await import("../src/analysis-path.js");
  const CJK = /[一-鿿]/;

  const english = await assessScenario({
    question: "We ship servers to a customer in Germany through a Singapore agent", locale: "en", config: stub.config
  });
  const steps = english.analysisPath.lanes.flatMap((lane) => lane.steps);
  assert.ok(steps.length);
  assert.deepEqual(english.analysisPath.lanes.filter((lane) => CJK.test(lane.label)).map((lane) => lane.label), []);
  assert.deepEqual(steps.filter((step) => CJK.test(step.title)).map((step) => step.title), []);
  assert.deepEqual(steps.flatMap((step) => step.inputs || []).filter((input) => CJK.test(input.label)).map((input) => input.label), []);

  // Chinese is untouched: the resolvers still write one language and only the
  // boundary translates.
  const chinese = await assessScenario({
    question: "我们通过新加坡代理商向德国客户出口服务器", locale: "zh", config: stub.config
  });
  assert.ok(chinese.analysisPath.lanes.every((lane) => CJK.test(lane.label)));

  // Every fixed term a plan can produce has a translation, so a new step cannot
  // be added without one.
  const planned = [];
  for (const agents of [["trade", "product", "tpdd"], ["lookup"], ["briefing"], ["memo"]]) {
    for (const lane of planAnalysisPath({ agents }).lanes) {
      planned.push(lane.label, ...lane.steps.map((step) => step.title));
      for (const input of lane.steps.flatMap((step) => step.inputs || [])) {
        planned.push(input.label, ...(input.options || []));
      }
    }
  }
  const untranslated = [...new Set(planned)].filter((term) => CJK.test(term) && !TRANSLATABLE_TERMS[term]);
  assert.deepEqual(untranslated, [], `no English for: ${untranslated.join(" / ")}`);

  // The explanation lines are built around data, so they cannot be mapped after
  // the fact — they carry both languages from where they are written. What is
  // left in Chinese on the English side must be data and nothing else: a
  // register's own entity name, a notice number. Translating those would be
  // inventing a name the register does not use.
  const lines = steps.flatMap((step) => [...(step.basis || []), ...(step.needs || [])]);
  const framed = lines.filter((line) => CJK.test(line));
  for (const line of framed) {
    const withoutData = line
      .replace(/[\u4e00-\u9fff]+(公司|集团|株式会社|研究所|大学|中心|银行)/g, "")
      .replace(/商务部公告\d{4}年第\d+号/g, "")
      .replace(/[（(][^）)]*[）)]/g, "");
    assert.ok(!/[\u4e00-\u9fff]{4,}/.test(withoutData),
      `an English line still carries Chinese wording of its own: ${line}`);
  }
});

test("a finding in one lane obliges a check in another", async () => {
  // The three lanes ran side by side and never spoke, which is wrong about the
  // subject: ownership resolution found a parent company and nothing screened
  // it. A company owned 50% or more in aggregate by designated parties is
  // restricted even when its own name is clean.
  const { LANE_DEPENDENCIES, triggeredDependencies } = await import("../src/lane-dependencies.js");

  // Every edge cites the rule that makes the check obligatory. A trigger with no
  // provision behind it is this system's opinion about what is prudent.
  for (const edge of LANE_DEPENDENCIES) {
    assert.ok(edge.cite, `${edge.id} must name the provision that requires it`);
    assert.ok(edge.zh && edge.en, `${edge.id} needs both languages`);
    assert.ok(edge.from?.step && edge.to?.step);
  }

  assert.deepEqual(triggeredDependencies({}), [], "nothing fires on nothing");

  const chain = { subject: { name: "Acme GmbH" }, ultimateParent: { name: "Acme Holding AG", lei: "L1" } };
  const fired = triggeredDependencies({ ownership: chain, listMatches: [] });
  assert.equal(fired.length, 1);
  assert.equal(fired[0].id, "parent_screening");
  assert.equal(fired[0].because, "Acme Holding AG", "the step says which finding put it there");

  const both = triggeredDependencies({ ownership: chain, listMatches: [{ entityName: "Designated Co" }] });
  assert.deepEqual(both.map((edge) => edge.id).sort(), ["listed_party_blocks_exceptions", "parent_screening"]);
});

test("the resolved parent is actually screened, not just named", async () => {
  const { planAnalysisPath, resolveAnalysisPath } = await import("../src/analysis-path.js");
  const { localizeLines } = await import("../src/path-i18n.js");
  const question = "请对交易方 Acme GmbH 做受限方筛查";
  const grounding = {
    screening: { screenedSources: [{ sourceId: "trade-csl", recordCount: 3, capturedAt: "2026-07-31" }], unsyncedSources: [] },
    listMatches: [], internalParties: [], limitations: [], partyCandidates: [],
    ownership: { subject: { name: "Acme GmbH", lei: "L0" }, ultimateParent: { name: "Acme Holding AG", lei: "L1" }, meaning: "不含持股比例" },
    parentScreening: [{ parent: { name: "Acme Holding AG" }, hits: [], screened: ["trade-csl", "eu-fsf"] }]
  };

  const path = resolveAnalysisPath(planAnalysisPath({ agents: ["trade"], question }),
    { question, grounding, declaredFacts: {}, final: true });
  const steps = path.lanes.flatMap((lane) => lane.steps);
  const screened = steps.find((item) => item.id === "parent_screening");
  assert.ok(screened, "the triggered step is added to the lane, not merely recorded");
  assert.equal(screened.status, "confirmed");
  assert.ok(localizeLines(screened.basis, "zh").some((line) => /Acme Holding AG/.test(line)));

  // A hit on the parent reopens the aggregation question.
  const withHit = resolveAnalysisPath(planAnalysisPath({ agents: ["trade"], question }), {
    question,
    grounding: { ...grounding, parentScreening: [{ parent: { name: "Acme Holding AG" }, hits: [{ entityName: "ACME HOLDING", matchScore: 0.9, sourceId: "trade-csl" }], screened: ["trade-csl"] }] },
    declaredFacts: {}, final: true
  });
  const blocked = withHit.lanes.flatMap((lane) => lane.steps).find((item) => item.id === "parent_screening");
  assert.equal(blocked.status, "evidence_needed");
  assert.ok(localizeLines(blocked.needs, "zh").some((line) => /50%/.test(line)));

  // And the path records why the step is there at all.
  assert.ok(path.triggered.some((edge) => edge.to.step === "parent_screening"));
});

test("an English answer is English all the way down", async () => {
  // The conclusion was translated and the procedure under it was not, so a
  // reader on the English side got an English verdict over Chinese reasoning:
  // gate explanations, clearance conditions, the action list. Checking one
  // string at a time only ever finds the leak someone noticed — this walks
  // everything the answer says in its own voice and fails on any CJK character.
  //
  // The scenario is deliberately European: no Chinese source data, no Chinese
  // party name, so every remaining CJK character is this system's own words
  // leaking through rather than data being quoted faithfully.
  const { assessScenario } = await import("../src/orchestrator.js");
  const CJK = /[　-〿㐀-䶿一-鿿＀-￯]/;

  const result = await assessScenario({
    question: "Customer Rhein Systeme GmbH, registration HRB 214553, Düsseldorf, Germany. Direct sale of EAR99 office laptops, no intermediary, for the customer's own office use.",
    locale: "en", config: stub.config,
    declaredFacts: {
      legalName: "Rhein Systeme GmbH", registrationNumber: "HRB 214553", country: "DE",
      address: "Kölner Str. 12, 40211 Düsseldorf, Germany",
      ownership: "Founder Anna Reinhardt holds 100%; no designated party holds an interest",
      partNumber: "TP-14-G3", usContent: "< 10%", eccn: "EAR99", destination: "Germany",
      endUse: "the customer's own office use, no resale, no military or nuclear application"
    }
  });

  const leaks = [];
  const walk = (value, where) => {
    if (typeof value === "string") { if (CJK.test(value)) leaks.push(`${where}: ${value.slice(0, 90)}`); return; }
    if (Array.isArray(value)) return value.forEach((item, index) => walk(item, `${where}[${index}]`));
    if (value && typeof value === "object") {
      for (const [key, inner] of Object.entries(value)) {
        // What the user typed is echoed back as they typed it, and a source's
        // own record is quoted as published. Neither is this system speaking.
        if (key === "declaredFacts" || key === "question") continue;
        walk(inner, `${where}.${key}`);
      }
    }
  };
  walk(result.analysisPath, "analysisPath");
  walk(result.actionPlan, "actionPlan");
  walk(result.synthesis, "synthesis");
  walk(result.grounding?.limitations, "limitations");
  walk(result.results, "results");

  assert.deepEqual(leaks, [], `English answer still carries Chinese:\n${leaks.join("\n")}`);
});

test("the five conditions reach the reader, met or not", async () => {
  // They decided the conclusion from the start and only ever reached the model.
  // A case that did not clear said so without saying which condition stopped it,
  // which is the one thing a reader can act on — so the projection the page
  // renders is checked here, in both directions.
  const { assessScenario } = await import("../src/orchestrator.js");
  const IDS = ["screening", "classification", "destination", "third_party", "end_use"];

  const bare = await assessScenario({ question: "我们要出口一批服务器", locale: "zh", config: stub.config });
  const blocked = bare.grounding?.clearance;
  assert.ok(blocked, "a review carries the clearance projection");
  assert.deepEqual(blocked.checks.map((check) => check.id), IDS, "all five conditions, in order");
  assert.equal(blocked.cleared, false, "a question with no facts in it cannot clear");
  assert.ok(blocked.checks.some((check) => !check.met), "and says which ones are unmet");
  for (const check of blocked.checks) {
    assert.ok(check.title, `${check.id} is named`);
    assert.ok(check.because, `${check.id} says why, rather than "insufficient"`);
    assert.ok(check.lanes.length, `${check.id} names the lane answering for it`);
    // A provision attaches to a condition that holds. An unmet one has nothing
    // yet for a provision to attach to, and inventing one would be a citation
    // for a finding that was not made.
    if (check.met) assert.ok(check.cite, `${check.id} carries the provision it rests on`);
  }
  // Three lanes across five conditions is what makes this the master agent's
  // decision. If they ever collapsed onto one lane, that lane could close a case
  // alone and the synthesis step would be decoration.
  assert.equal(new Set(blocked.checks.flatMap((check) => check.lanes)).size, 3);

  // All five met and still not cleared. This is the sixth gate, and it is the
  // one most likely to be quietly dropped by someone tidying up later: five
  // green ticks against an open step is exactly the shape of a file that looks
  // finished and is not.
  const met = await assessScenario({
    question: "我们直销一台 EAR99 笔记本给德国的长期客户，无中间商",
    locale: "zh", config: stub.config,
    declaredFacts: { eccn: "EAR99", destination: "德国", endUse: "客户自用办公，无转售，无军事或核相关用途" }
  });
  const all = met.grounding.clearance;
  assert.ok(all.checks.every((check) => check.met), "every condition is met on these facts");
  assert.ok(all.checks.every((check) => check.cite), "and each carries the provision it rests on");
  assert.ok(all.openSteps.length, "but steps are still waiting on evidence");
  assert.equal(all.cleared, false, "so the file does not clear — an open step blocks it");

  const en = await assessScenario({
    question: "Direct sale of an EAR99 laptop to a long-standing customer in Germany, no intermediary",
    locale: "en", config: stub.config,
    declaredFacts: { eccn: "EAR99", destination: "Germany", endUse: "the customer's own office use, no resale, no military or nuclear application" }
  });
  const CJK = /[一-鿿]/;
  const leaks = en.grounding.clearance.checks
    .flatMap((check) => [check.title, check.because, check.cite])
    .filter((line) => line && CJK.test(line));
  assert.deepEqual(leaks, [], `English clearance still carries Chinese:\n${leaks.join("\n")}`);
});

test("clearance does not depend on when it is computed", async () => {
  // It runs before the lanes. That is only safe while a step's status is decided
  // by the facts and the grounding alone — lane output reaches the resolver
  // through needsMatching, which appends to `needs` and must never move
  // `status`. If that ever changes, clearance computed early becomes a different
  // answer from clearance computed late, and the earlier one is the one the
  // reader is shown.
  const { assessScenario } = await import("../src/orchestrator.js");
  const { assessClearance } = await import("../src/clearance.js");

  // A stub that floods every lane with the missingInfo strings needsMatching
  // looks for: if lane output could move a status, this is what would do it.
  const loud = await startStubModel({
    answer: (body) => (/overallRisk/.test(JSON.stringify(body.messages))
      ? { overallRisk: "medium", headline: "stub", executiveSummary: "stub", nextStep: "stub" }
      : {
        agent: ["trade", "product", "tpdd"].find((lane) => new RegExp(`"agent":\\s*"${lane}"`).test(JSON.stringify(body.messages))) || "trade",
        riskLevel: "medium", summary: "stub", findings: [{ title: "f", detail: "d", evidenceSourceIds: [] }],
        missingInfo: ["法律实体全称", "准确型号 part number", "受控原产含量 de minimis", "关键技术参数 eccn",
          "最终目的地 国别矩阵", "最终用户与最终用途 禁令", "受益所有 股权 ubo"],
        recommendedActions: ["a"]
      })
  });
  try {
    // The case that would expose it: every condition met, steps still open. A
    // file with unmet conditions is blocked by those and never reaches the
    // question of when the open steps were counted.
    const question = "我们直销一台 EAR99 设备给德国的长期客户，无中间商、无代理商。";
    const declaredFacts = { eccn: "EAR99", destination: "德国", endUse: "客户自用办公，无转售，无军事或核相关用途" };
    const result = await assessScenario({ question, locale: "zh", config: loud.config, declaredFacts });

    const early = result.grounding.clearance;
    assert.ok(early.checks.every((check) => check.met), "the five conditions all hold on these facts");
    assert.ok(early.openSteps.length, "and steps are still open, which is the case that matters");

    const late = assessClearance({ question, facts: result.declaredFacts, grounding: result.grounding, path: result.analysisPath });
    assert.equal(early.cleared, late.cleared, "the verdict must not depend on when it was computed");
    assert.deepEqual(early.openSteps, late.openSteps, "nor must the open steps");
  } finally { await loud.stop(); }
});

test("a name that differs by a letter is still recalled", async () => {
  // Token overlap compares whole words, so a name misspelled by one character
  // has nothing in common with its target and scored zero. That is the wrong
  // answer for the case a screening list exists to catch: Gazprom and Gasprom,
  // Rosneft and Rosnefft are one party transliterated twice, and Cyrillic,
  // Arabic and Chinese each romanise more than one way.
  const { scoreNameMatch } = await import("../src/entity-matching.js");

  for (const [typo, real] of [["Gasprom Neft", "Gazprom Neft"], ["Rosnefft", "Rosneft"], ["Huawie Technologies", "Huawei Technologies"]]) {
    const result = scoreNameMatch(typo, real);
    assert.equal(result.basis, "character_similarity", `${typo} should be recalled on spelling`);
    assert.ok(result.score >= 0.55, `${typo} must clear the screening threshold`);
    // Capped below the token tier on purpose. A spelling resemblance is a reason
    // to put two names in front of a person, never a reason to treat them as one
    // party — identity resolution is what settles it.
    assert.ok(result.score < 0.8, `${typo} must stay weaker than a token match`);
  }

  // What it must not do. An abbreviation is not a misspelling; a partial name is
  // containment and scores higher through its own tier; and one character in
  // Chinese is usually a different name rather than a typo, so CJK is excluded.
  assert.equal(scoreNameMatch("ZTE", "Zhongxing Telecom").basis, "no_overlap");
  assert.equal(scoreNameMatch("华为技术", "华力技术").basis, "no_overlap");
  assert.equal(scoreNameMatch("Huawei", "Huawei Marine").basis, "one_normalized_name_contains_the_other");
  // The tiers above it are untouched.
  assert.equal(scoreNameMatch("Huawei Technologies Co., Ltd.", "Huawei Technologies").score, 1);
  assert.equal(scoreNameMatch("Technologies Huawei", "Huawei Technologies").basis, "token_overlap");
});

test("every hit carries its own verdict, in the reader's language", async () => {
  // Two names coming back from one search are two claims about two entities. A
  // list reporting only scores invites reading them as one finding with two
  // rows — and the basis was printed as the matcher's own key, so a Chinese
  // answer contained "token_overlap".
  //
  // Built from a constructed grounding rather than the synced snapshot: what is
  // under test is how a hit is rendered, and a test that needs a particular list
  // to have been downloaded fails on a fresh checkout for reasons of its own.
  const { planAnalysisPath, resolveAnalysisPath } = await import("../src/analysis-path.js");

  const hit = (entityName, matchBasis, matchDisposition, matchScore) => ({
    sourceId: "trade-csl", recordId: entityName, entityName, matchedName: entityName,
    matchScore, matchBasis, matchDisposition, identityComparisons: []
  });
  const question = "交易方 Gazprom Neft";
  const grounding = {
    intent: "party_screening",
    listMatches: [
      hit("Gazprom Neft", "normalized_name_identical", "potential_match_requires_identity_review", 1),
      hit("Gasprom Neft PAO", "character_similarity", "weak_potential_match_requires_identity_review", 0.69)
    ],
    screening: { screenedSources: [{ sourceId: "trade-csl", recordCount: 25921 }], unsyncedSources: [] },
    partyCandidates: [], internalParties: [], limitations: []
  };

  const path = resolveAnalysisPath(planAnalysisPath({ agents: ["trade"], question }),
    { question, grounding, results: [], declaredFacts: {}, final: true });
  const nameMatch = path.lanes.flatMap((lane) => lane.steps).find((step) => step.id === "name_match");
  const lines = nameMatch.basis.map((line) => (typeof line === "string" ? line : line.zh)).filter((line) => /相似度/.test(line));

  assert.equal(lines.length, 2, "both hits are reported");
  for (const line of lines) {
    assert.match(line, / — /, "each hit states its own verdict");
    assert.doesNotMatch(line, /token_overlap|character_similarity|normalized_name_identical|requires_identity_review/,
      "the matcher's keys must not reach the reader");
  }
  // And the two are told apart: one is the same name, the other only looks like it.
  assert.match(lines[0], /规范化后名称完全一致/);
  assert.match(lines[1], /拼写相近/, "a spelling resemblance says so, rather than reading as a name match");
  assert.match(lines[1], /弱命中/, "and carries the weaker verdict of its own");
});

test("a write-up is asked for in the conversation, and a transaction that mentions one is not", async () => {
  // /case-memo was the only way to the write-up, and removing it left that path
  // unreachable: the router has no memo terms, so "把上面的筛查整理成备忘录" came
  // back as a fresh trade review of a question that describes no transaction.
  //
  // The risk in the other direction is the one worth a test. "客户要求我们出一份
  // 备忻录说明该产品不受管制" is a transaction with the word in it, and writing it
  // up rather than reviewing it answers a question nobody asked.
  const { isMemoRequest, judgeIntent } = await import("../public/intent.js");
  const { assessScenario } = await import("../src/orchestrator.js");

  for (const asked of [
    "把上面的筛查整理成备忘录，供法务复核",
    "把以上分析写成一份备忘录",
    "生成案件备忘录",
    "整理成备忘录",
    "把刚才的结论做成备忘录",
    "turn this session into a memo for legal review",
    "draft a memo of the above"
  ]) {
    assert.ok(isMemoRequest(asked), asked);
    assert.equal(judgeIntent({ question: asked }).kind, "memo", `the composer must say so too: ${asked}`);
  }

  for (const notAsked of [
    // The phrasing is there; the question is a transaction. Length and the
    // absence of any reference to this session are what separate them.
    "客户要求我们出一份备忘录，说明 TS-6200-DM 不受美国管辖，能这么写吗",
    "We plan to sign a remote support contract with a Huawei affiliate; the memo from legal says it is fine",
    "我们通过新加坡代理商向中国最终用户出口服务器",
    "100-000000009 的 ECCN 是什么？",
    "汇总最近 6 个月的公告变化"
  ]) {
    assert.equal(isMemoRequest(notAsked), false, notAsked);
  }

  // And the run does what the hint said. A composer that reads "案件备忘录" over
  // a run performing a trade review is worse than no hint at all.
  const written = await assessScenario({
    question: "把上面的筛查整理成备忘录，供法务复核", locale: "zh", config: stub.config, history: []
  });
  assert.deepEqual(written.analysisPath.lanes.map((lane) => lane.lane), ["memo"]);
  assert.match(written.synthesis.headline, /尚无可整理/,
    "over an empty session it says so rather than inventing a document");

  const reviewed = await assessScenario({
    question: "客户要求我们出一份备忘录，说明 TS-6200-DM 不受美国管辖，能这么写吗",
    locale: "zh", config: stub.config
  });
  assert.ok(reviewed.analysisPath.lanes.some((lane) => lane.lane === "product"),
    "a transaction with the word in it is still reviewed");
});

test("a question about the review is answered, not turned into another review", async () => {
  // Everything that was not a memo or a lookup became a review, so "如果我把注册号
  // 补上，是不是就能拿到明确结论" opened a second full procedure over the same case
  // — four model calls to re-derive a state the previous turn already holds —
  // and never answered what was asked.
  const { consultKind, judgeIntent } = await import("../public/intent.js");
  const { assessScenario } = await import("../src/orchestrator.js");

  const asked = [
    ["如果我把注册号补上，是不是就能拿到明确结论？", true, "followup"],
    ["上面那一步为什么跳过了？", true, "followup"],
    ["你刚才说还缺最终用户，提供了之后能定论吗？", true, "followup"],
    ["If I provide the registration number, can you reach a firm conclusion?", true, "followup"],
    ["de minimis 是什么意思？", false, "general"],
    ["What is the difference between the Entity List and the SDN list?", false, "general"]
  ];
  for (const [question, hasHistory, kind] of asked) {
    assert.equal(consultKind(question, { hasHistory }), kind, question);
    assert.equal(judgeIntent({ question, hasHistory }).kind, "consult", `the composer must say so too: ${question}`);
  }

  // What must still get the review. The last two are the ones that make this
  // safe: a follow-up quoting the gap it was told about ("还缺最终用户") reads
  // like a transaction word by word, so what separates them is new material and
  // length — not vocabulary.
  const reviewed = [
    ["如果我把注册号补上，是不是就能拿到明确结论？", false],
    ["客户 Aveox Technologies (Shenzhen) Co., Ltd. 出口至印度，需要许可吗？", true],
    ["我们通过新加坡代理商向中国最终用户出口服务器", true],
    ["接着上面，客户改成 Orchard Networks Pte. Ltd.，还需要许可吗？", true],
    ["这个料号的 CCL 管制清单条目是什么", true],
    ["50% 规则怎么算合计持股", true]
  ];
  for (const [question, hasHistory] of reviewed) {
    assert.equal(consultKind(question, { hasHistory }), null, `${question} must not be treated as a question about the review`);
  }

  // And the run does it. A follow-up gets one lane, no risk level, and says
  // out loud that it did not re-examine anything.
  const history = [
    { role: "user", content: "客户 Aveox Technologies (Shenzhen) Co., Ltd.，深圳，直销客户，需要许可吗" },
    { role: "assistant", content: "尚不能定论：缺注册号，主体身份未确立。" }
  ];
  const followup = await assessScenario({
    question: "如果我把注册号补上，是不是就能拿到明确结论？", locale: "zh", config: stub.config, history
  });
  assert.deepEqual(followup.analysisPath.lanes.map((lane) => lane.lane), ["consult"]);
  assert.equal(followup.synthesis.overallRisk, null, "nothing here judged a transaction, so it carries no risk level");
  assert.equal(followup.awaitingInput, null, "and it asks for nothing — it was the one answering");
  assert.ok(followup.grounding.limitations.some((line) => /未对交易重新审查/.test(line)));

  // The same sentence with nothing to follow up on is a scenario nobody has
  // described yet, and it gets the review.
  const fresh = await assessScenario({
    question: "如果我把注册号补上，是不是就能拿到明确结论？", locale: "zh", config: stub.config, history: []
  });
  assert.ok(fresh.analysisPath.lanes.some((lane) => ["trade", "product", "tpdd"].includes(lane.lane)),
    "with no prior turn there is nothing to answer from, so the review runs");
});

test("a gem's instruction never rides in front of what the reader typed", async () => {
  // The composer used to send `${instruction}\n\n${sources}\n\n${raw}` as the
  // question, and everything downstream judged that string. It survived while a
  // gem was chosen deliberately and rarely, and stopped surviving the moment one
  // was always selected: the coordinator's instruction is a hundred and twenty
  // characters, and a follow-up is recognised partly by being short. Every
  // follow-up measured long enough to be a scenario and got the review it exists
  // to avoid.
  const { GEMS } = await import("../public/gems.js");
  const { consultKind } = await import("../public/intent.js");
  const { gemBrief } = await import("../src/gem-brief.js");
  const { assessScenario } = await import("../src/orchestrator.js");

  const hub = GEMS.find((gem) => gem.id === "hub");
  const asked = "如果我把注册号补上，是不是就能拿到明确结论？";
  assert.equal(consultKind(asked, { hasHistory: true }), "followup");
  assert.equal(consultKind(`${hub.instruction.zh}\n\n${asked}`, { hasHistory: true }), null,
    "which is exactly what the old composer sent");

  // Asserted against the composer's source, because the rule is about what the
  // browser sends and no call to assessScenario can observe it: this test passed
  // unchanged with the old glue put back, which is the whole reason the defect
  // survived a suite that already covered consultKind and the dispatch.
  const app = await (await import("node:fs/promises"))
    .readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /^\s*const question = raw;$/m,
    "the composer sends what the reader typed");
  assert.doesNotMatch(app, /仅使用以下来源作为依据：\$\{gem\.boundSources/,
    "and builds no prompt of its own — the bound-source line is the server's to write");

  // The instruction reaches the model as a system message instead, on the same
  // footing a skill has: it shapes the work and licenses no claim.
  const brief = gemBrief("screen-party", "zh");
  assert.match(brief, /主体筛查/);
  assert.match(brief, /仅使用以下来源作为依据/);
  assert.match(brief, /It is not evidence/);
  assert.equal(gemBrief(null, "zh"), "");
  assert.equal(gemBrief("no-such-gem", "zh"), "");

  // End to end: the same question, with a gem selected, is answered rather than
  // reviewed. This is the assertion the earlier consult test could not make,
  // because it never went through a gem.
  const history = [
    { role: "user", content: "客户 Aveox Technologies (Shenzhen) Co., Ltd.，深圳，直销客户，需要许可吗" },
    { role: "assistant", content: "尚不能定论：缺注册号，主体身份未确立。" }
  ];
  const answered = await assessScenario({
    question: asked, locale: "zh", config: stub.config, history, gemId: "hub"
  });
  assert.deepEqual(answered.analysisPath.lanes.map((lane) => lane.lane), ["consult"]);
  assert.equal(answered.synthesis.overallRisk, null);
});

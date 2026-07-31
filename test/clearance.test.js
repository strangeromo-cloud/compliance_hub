import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";

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
  assert.equal(verdict.cleared, true, verdict.unmet.map((check) => check.because).join(" | "));
  // A conclusion without its conditions is indistinguishable from an approval.
  assert.ok(verdict.conditions.length >= 3);
  assert.ok(verdict.conditions.some((line) => /762/.test(line)), "record-keeping survives a clear outcome");
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
  assert.match(verdict.unmet[0].because, /trade-csl|综合筛查/, "the answer must name what was not screened");
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
      const result = await assessScenario({ question: item.question, locale, mock: true, declaredFacts: item.facts });
      assert.equal(result.awaitingInput, null, `${locale} ${item.id} should not stop to ask`);
      assert.equal(result.synthesis?.overallRisk, "low", `${locale} ${item.id} should reach a clear outcome`);
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

  const party = steps.find((item) => item.id === "identify_party");
  assert.equal(party.status, "confirmed", "a resolved candidate settles the step rather than asking");
  assert.ok(party.basis.some((line) => line.includes("艾维奥克斯公司")), "the candidate is named in the basis");
  assert.ok(party.basis.some((line) => /名称相似不等于同一主体/.test(line)),
    "a similarity score must never read as an identification");

  // Nothing was screened as a designated name, but a candidate was found — so
  // there is something to disambiguate, and calling it not applicable would drop
  // what the previous step just produced.
  const resolution = steps.find((item) => item.id === "identity_resolution");
  assert.equal(resolution.status, "evidence_needed");
  assert.ok(resolution.basis.some((line) => line.includes("艾维奥克斯公司")));
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
    const result = await assessScenario({ question, locale: "zh", mock: true });
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
  const answer = await assessScenario({ question: "ZZ-999999999 的 ECCN 是什么", locale: "zh", mock: true });
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
    const answer = await assessScenario({ question: "100-000000009 这个AMD 的ECCN是什么？", locale: "zh", mock: true });
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
  const settled = clean.lanes.flatMap((lane) => lane.steps).find((item) => item.id === "ownership");
  assert.equal(settled.status, "confirmed", "a chain plus no designated name leaves nothing to compute");
  assert.ok(settled.basis.some((line) => /不含持股比例/.test(line)),
    "what the register does not publish must be said where the chain is shown");

  // The moment a designated name is in play, the percentage is the question and
  // the register cannot answer it.
  const hit = resolveAnalysisPath(planAnalysisPath({ agents: ["trade"], question }),
    { question, grounding: { ...base, listMatches: [{ entityName: "Acme Holding AG", matchScore: 0.9 }] }, declaredFacts: {}, final: true });
  const open = hit.lanes.flatMap((lane) => lane.steps).find((item) => item.id === "ownership");
  assert.equal(open.status, "evidence_needed");
  assert.ok(open.basis.some((line) => /直接母公司/.test(line)), "the chain is still shown");
  assert.ok(open.needs.some((line) => /50%/.test(line)), "and the aggregate is still asked for");
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
  for (const gem of GEMS) {
    assert.ok(["review", "lookup", "briefing", "memo"].includes(gem.kind), `${gem.id} has no usable kind`);
    assert.equal(GEM_KINDS[gem.id], gem.kind, "the server reads the same catalogue the page does");
  }

  const brief = await assessScenario({
    question: "汇总最近 6 个月中国出口管制管控名单和两用物项公告的变化",
    locale: "zh", mock: true, gemId: "reg-brief"
  });
  assert.deepEqual(brief.analysisPath.lanes.map((lane) => lane.lane), ["briefing"]);
  assert.equal(brief.awaitingInput, null, "a summary of published notices asks nobody anything");
  assert.equal(brief.results.length, 0);
  assert.ok(brief.grounding.limitations.some((line) => /属于审查而非汇总/.test(line)),
    "listing what was published is not the same as saying it applies");

  const memo = await assessScenario({ question: "生成案件备忘录", locale: "zh", mock: true, gemId: "case-memo", history: [] });
  assert.deepEqual(memo.analysisPath.lanes.map((lane) => lane.lane), ["memo"]);
  assert.match(memo.synthesis.headline, /尚无可整理/, "a memo over nothing says so rather than inventing a document");

  // A review gem still gets the procedure.
  const review = await assessScenario({
    question: "我们通过新加坡代理商向中国最终用户出口服务器", locale: "zh", mock: true, gemId: "screen-party"
  });
  assert.ok(review.analysisPath.lanes.some((lane) => lane.lane === "trade"));
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
    question: "We ship servers to a customer in Germany through a Singapore agent", locale: "en", mock: true
  });
  const steps = english.analysisPath.lanes.flatMap((lane) => lane.steps);
  assert.ok(steps.length);
  assert.deepEqual(english.analysisPath.lanes.filter((lane) => CJK.test(lane.label)).map((lane) => lane.label), []);
  assert.deepEqual(steps.filter((step) => CJK.test(step.title)).map((step) => step.title), []);
  assert.deepEqual(steps.flatMap((step) => step.inputs || []).filter((input) => CJK.test(input.label)).map((input) => input.label), []);

  // Chinese is untouched: the resolvers still write one language and only the
  // boundary translates.
  const chinese = await assessScenario({
    question: "我们通过新加坡代理商向德国客户出口服务器", locale: "zh", mock: true
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
});

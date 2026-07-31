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

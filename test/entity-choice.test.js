import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEntityName, scoreNameMatch } from "../src/entity-matching.js";
import { planAnalysisPath, resolveAnalysisPath } from "../src/analysis-path.js";
import { otherLegalNames } from "../src/ownership.js";

// A register record as GLEIF describes one, reduced to what the choice turns on.
const record = (name, country, city, registrationStatus = "ISSUED", status = "ACTIVE") =>
  ({ lei: `X${name.length}${country}${city}`.padEnd(20, "0").slice(0, 20), name, country, city, status, registrationStatus, sourceUrl: null });

const ownershipStep = (grounding, declaredFacts = {}) => {
  const agents = ["trade"];
  const question = "出口一批服务器，请做出口管制审查。";
  const plan = planAnalysisPath({ agents, question, declaredFacts });
  const path = resolveAnalysisPath(plan, { question, grounding: { facts: [], listMatches: [], limitations: [], ...grounding }, declaredFacts, final: true });
  return path.lanes.find((lane) => lane.lane === "trade").steps.find((item) => item.id === "ownership");
};

test("a legal form the normaliser does not know keeps the company from reducing to its name", () => {
  // Nokia Oyj kept its Oyj, so it did not reduce to "nokia", so a Portuguese
  // entity registered under the bare word was the only exact match — and was
  // resolved to silently as the Nokia in a compliance file.
  assert.equal(normalizeEntityName("Nokia Oyj"), "nokia");
  assert.equal(scoreNameMatch("Nokia", "Nokia Oyj").basis, "normalized_name_identical");

  // The same gap, in the forms that recur across the Russian designations: one
  // entity listed twice under two spellings of its legal form is one entity.
  assert.equal(scoreNameMatch("RADIOTESTER OOO", "RADIOTESTER LLC").basis, "normalized_name_identical");
  assert.equal(scoreNameMatch("Kalinin Machine Plant, JSC", "KALININ MACHINE PLANT JSC").basis, "normalized_name_identical");

  // Not everything short is a legal form. These stay in the name.
  assert.notEqual(normalizeEntityName("Bosch"), "");
  assert.equal(normalizeEntityName("Dolgoprudny SP Works"), "dolgoprudny sp works");
});

test("identically named records are put to the reviewer instead of picked between", () => {
  // Normalisation removes the legal form, so all three reduce to one name and
  // all three score 1.0. Taking the first was a coin toss reported as a lookup.
  const candidates = [
    record("SAMSUNG ELECTRONICS GMBH", "DE", "ESCHBORN"),
    record("SAMSUNG ELECTRONICS COMPANY LIMITED", "IN", "MUMBAI"),
    record("SAMSUNG ELECTRONICS HOLDING GMBH", "DE", "ESCHBORN")
  ];
  const item = ownershipStep({ ownership: { queried: "Samsung Electronics", ambiguous: true, candidates, moreCandidates: 0 } });

  assert.equal(item.status, "evidence_needed");
  const choice = item.inputs.find((input) => input.field === "ownershipSubject");
  assert.ok(choice, "the step has to actually ask");
  assert.equal(choice.kind, "choice");
  assert.equal(choice.options.length, candidates.length + 1, "every candidate, plus a way to say none of them is right");

  // The names are identical, so an option that carried only the name would be
  // three copies of the same button. Country, city and identifier are what the
  // choice is made on.
  for (const candidate of candidates) {
    const option = choice.options.find((value) => value.includes(candidate.lei));
    assert.ok(option, `no option carries ${candidate.lei}`);
    assert.ok(option.includes(candidate.country) && option.includes(candidate.city), option);
  }
  assert.ok(choice.options.at(-1).includes("以上都不是"));
});

test("a step whose choices the register did not supply asks nothing", () => {
  // The field is declared in the plan and its options come from resolution, so
  // on every run where the name resolved cleanly there is nothing to choose
  // from — and an empty choice is not a question.
  const item = ownershipStep({ ownership: { queried: "Volkswagen AG", subject: record("VOLKSWAGEN AKTIENGESELLSCHAFT", "DE", "WOLFSBURG"), identifiedBy: "name", otherCandidates: [], directParent: null, ultimateParent: null } });
  assert.equal(item.inputs.some((input) => input.field === "ownershipSubject"), false);
  assert.ok(item.inputs.some((input) => input.field === "ownership"), "the planned text field still stands");
});

test("the record the reviewer picked is reported as theirs, not as a lookup", () => {
  const subject = record("SAMSUNG ELECTRONICS COMPANY LIMITED", "IN", "MUMBAI");
  const item = ownershipStep(
    { ownership: { queried: "Samsung Electronics", subject, identifiedBy: "user", otherCandidates: [], directParent: null, ultimateParent: null, meaning: "…" } },
    { ownershipSubject: `SAMSUNG ELECTRONICS COMPANY LIMITED｜IN MUMBAI｜LEI ${subject.lei}` }
  );
  const zh = item.basis.map((line) => (typeof line === "string" ? line : line.zh)).join("\n");
  assert.match(zh, /由审查人.*指定/, zh);
  assert.match(zh, new RegExp(subject.lei));
  // The chain was resolved from the picked record, and the record declares no
  // parent. Saying so is a result; showing nothing read as though the choice
  // had been thrown away.
  assert.match(zh, /未申报直接母公司/, zh);
});

test("choosing none of the candidates ends the question rather than repeating it", () => {
  const item = ownershipStep(
    { ownership: { queried: "Samsung Electronics", candidates: [], noConfidentMatch: true, noneOfTheCandidates: true } },
    { ownershipSubject: "以上都不是 / 不确定" }
  );
  assert.equal(item.inputs.some((input) => input.field === "ownershipSubject"), false, "asking again would loop forever");
  const needs = item.needs.map((line) => (typeof line === "string" ? line : line.zh)).join("\n");
  assert.match(needs, /均非该交易方/, needs);
});

// The bridge between a Chinese question and an English list, and there is no
// other one: the Consolidated Screening List carries 25,921 entities and not one
// Chinese character, OFAC's 19,662 likewise. No tuning of the matcher can cross
// that; only a second name can.
test("a company's other-language legal name is taken, and machine pinyin is not", () => {
  // GLEIF's real payload for 华为技术有限公司.
  const names = otherLegalNames({
    otherNames: [
      { name: "Huawei Technologies Co., Ltd.", type: "ALTERNATIVE_LANGUAGE_LEGAL_NAME", language: "en" },
      { name: "Huawei", type: "TRADING_OR_OPERATING_NAME", language: "en" }
    ],
    transliteratedOtherNames: [{ name: "hua wei ji shu you xian gong si", type: "AUTO_ASCII_TRANSLITERATED_LEGAL_NAME" }]
  });

  // The declared alternative legal name is validated by the issuing LOU, which
  // is what makes it usable in a screening file.
  assert.deepEqual(names, ["Huawei Technologies Co., Ltd."]);

  // The register also publishes machine-generated pinyin. Screening on it would
  // manufacture hits no publisher stands behind, so it is deliberately excluded
  // — and a trading name is not a legal name either.
  assert.equal(names.some((name) => /hua wei ji shu/.test(name)), false);
  assert.equal(names.includes("Huawei"), false);

  assert.deepEqual(otherLegalNames({}), [], "an entity that declared none yields none, not a crash");
});

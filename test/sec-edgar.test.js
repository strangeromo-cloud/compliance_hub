import { test } from "node:test";
import assert from "node:assert/strict";
import { classKey, parseProxyOwnership, parseSchedule13 } from "../src/sec-edgar.js";
import { holderMatches } from "../src/grounding.js";

// A Schedule 13D/G as SEC has published it since 18 December 2024: structured
// XML with the share in a named field, one cover-page block per reporting
// person, and the filer's name repeated in the signature block below.
const filing = ({ issuerCik = "0001084869", issuerName = "1-800-Flowers.com Inc", securityClass = "Class A Common Stock", persons = [] }) => `<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission xmlns="http://www.sec.gov/edgar/schedule13g">
  <headerData><submissionType>SCHEDULE 13G</submissionType></headerData>
  <formData>
    <coverPageHeader>
      <securitiesClassTitle>${securityClass}</securitiesClassTitle>
      <issuerInfo>
        <issuerCik>${issuerCik}</issuerCik>
        <issuerName>${issuerName}</issuerName>
      </issuerInfo>
    </coverPageHeader>
${persons.map((person) => `    <coverPageHeaderReportingPersonDetails>
      <reportingPersonName>${person.name}</reportingPersonName>
      <reportingPersonBeneficiallyOwnedNumberOfShares>
        <soleVotingPower>${person.shares || 0}.00</soleVotingPower>
        <sharedVotingPower>0.00</sharedVotingPower>
      </reportingPersonBeneficiallyOwnedNumberOfShares>
      <reportingPersonBeneficiallyOwnedAggregateNumberOfShares>${person.shares || 0}.00</reportingPersonBeneficiallyOwnedAggregateNumberOfShares>
      <classPercent>${person.percent}</classPercent>
      <typeOfReportingPerson>${person.type || "IA"}</typeOfReportingPerson>
    </coverPageHeaderReportingPersonDetails>`).join("\n")}
    <items><item4><classPercent>See Row (11) of the Reporting Person's cover page.</classPercent></item4></items>
    <signatureInformation>
      <reportingPersonName>${persons[0]?.name || ""}</reportingPersonName>
    </signatureInformation>
  </formData>
</edgarSubmission>`;

test("the filed share is read from the reporting person's own cover page", () => {
  const parsed = parseSchedule13(filing({
    persons: [
      { name: "Fund 1 Investments, LLC", percent: "14.64", shares: 5_300_000, type: "OO" },
      { name: "Mitchell Jacobson", percent: "6.4", shares: 2_329_850, type: "IN" }
    ]
  }));

  assert.equal(parsed.persons.length, 2, "a group files one cover page per member and each reports its own share");
  assert.deepEqual(parsed.persons.map((person) => person.percentOfClass), [14.64, 6.4]);
  assert.equal(parsed.persons[0].shares, 5_300_000);
  // The code separates "a fund votes these shares" from "a person owns this
  // company", which is the distinction the 50 Percent Rule turns on.
  assert.deepEqual(parsed.persons.map((person) => person.personType), ["OO", "IN"]);
  // Item 4 also carries a classPercent, and its value is the sentence
  // "See Row (11) of the Reporting Person's cover page." Reading the percentage
  // from the document rather than from inside the cover-page block would take
  // that sentence, or the first block's number for every filer in the group.
  assert.ok(parsed.persons.every((person) => Number.isFinite(person.percentOfClass)));
});

test("a filing is attributed to the company it is about, not the company that filed it", () => {
  // Intel's own filing list carries a 79.8% position. That is Intel holding
  // Mobileye — not somebody holding 79.8% of Intel. Both directions arrive in
  // one submissions feed, and only the issuer CIK tells them apart; reading the
  // second as the first would put the ownership chain in a compliance file
  // upside down.
  const outbound = parseSchedule13(filing({
    issuerCik: "0001910139", issuerName: "Mobileye Global Inc.",
    persons: [{ name: "INTEL CORP", percent: "79.8", type: "HC" }]
  }));
  assert.equal(outbound.issuerCik, 1910139, "the leading zeros of a CIK are padding, not digits");
  assert.notEqual(outbound.issuerCik, 50863, "the subject is Mobileye; Intel is the filer");

  const inbound = parseSchedule13(filing({
    issuerCik: "0000050863", issuerName: "INTEL CORP",
    persons: [{ name: "Vanguard Capital Management", percent: "6.52" }]
  }));
  assert.equal(inbound.issuerCik, 50863);
});

test("one class written four ways is one class, so a later amendment supersedes", () => {
  // BlackRock filed the same class as "A" in February and "Class A Stock" in
  // July. Keyed on the raw title those are two classes, and the superseded 8.7%
  // stood beside the current 4.6% as though the holder held both.
  const same = ["A", "Class A Stock", "Class A Common Stock, par value $0.01 per share", "Class A common stock"];
  assert.equal(new Set(same.map(classKey)).size, 1, same.map(classKey).join(" | "));

  assert.notEqual(classKey("Class A Common Stock"), classKey("Class B Common Stock"),
    "two lettered classes have two denominators and must not be merged");
  assert.notEqual(classKey("Class A Common Stock"), classKey("Common Stock"),
    "an unlettered common stock is not evidence that it is the Class A");

  // The filed title survives for display: the key is for matching amendments to
  // what they amend, and a reader still needs to see which class was reported.
  const parsed = parseSchedule13(filing({ securityClass: "Class A Stock", persons: [{ name: "BlackRock, Inc.", percent: "4.6", type: "HC" }] }));
  assert.equal(parsed.persons[0].securityClass, "Class A Stock");
});

// Every case below is a real pair, measured against the Consolidated Screening
// List: 36 shareholder names taken from ten US issuers on one side, known
// designated entities on the other.
test("a shareholder is screened on an agreeing name, not a contained one", () => {
  const hit = (matchBasis, matchScore) => ({ matchBasis, matchScore });

  // Bare containment is the failure this rule exists to stop. VANGUARD is a real
  // Consolidated Screening List entry and Vanguard Capital Management is the
  // shareholder of record of most of the S&P 500; a line that fires on almost
  // every US-listed company teaches the reader to skip it.
  assert.equal(holderMatches(hit("one_normalized_name_contains_the_other", 0.85)), false);
  assert.equal(holderMatches(hit("token_overlap", 0.8)), false);
  assert.equal(holderMatches(hit("every_word_of_the_name_appears", 0.8)), false);

  // A filed legal name that agrees with a listed one is the whole point.
  assert.equal(holderMatches(hit("normalized_name_identical", 1)), true);

  // Spelling variants above the floor, both real: Gasprom Neft reaches Gazprom
  // Neft at 0.69, Rosnjeft reaches Rosneft at 0.71.
  assert.equal(holderMatches(hit("character_similarity", 0.69)), true);
  assert.equal(holderMatches(hit("character_similarity", 0.71)), true);

  // Below the floor, and all three are wrong: NOMURA HOLDINGS to OURA at 0.56,
  // Rostech to PROTEH at 0.59, Aeroflot to Aerofalcon at 0.61. A four-letter
  // list entry scores highly against anything of similar shape, which is
  // arithmetic rather than evidence.
  assert.equal(holderMatches(hit("character_similarity", 0.56)), false, "NOMURA HOLDINGS is not OURA");
  assert.equal(holderMatches(hit("character_similarity", 0.59)), false, "Rostech is not PROTEH");
  assert.equal(holderMatches(hit("character_similarity", 0.61)), false, "Aeroflot is not Aerofalcon");
});

// The proxy statement's ownership table, in the two layouts these were built
// against. Every cell below is what the real filings actually contain.
const proxyTable = ({ header, rows, outstandingSentence }) => `<html><body>
  <p>${outstandingSentence || ""}</p>
  <table><tr>${header.map((cell) => `<td>${cell}</td>`).join("")}</tr>
  ${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
  </table></body></html>`;

// Apple: the name column is headed "Name of Beneficial Owner", the count sits
// beside its footnote marker, and the denominator is in the sentence above.
const APPLE = proxyTable({
  outstandingSentence: "As of the Table Date, 14,697,926,000 shares of Apple&#8217;s common stock were issued and outstanding.",
  header: ["Name of Beneficial Owner", "Shares of Common Stock Beneficially Owned (1)", "Percent of Common Stock Outstanding"],
  rows: [
    ["The Vanguard Group", "1,415,826,462 (2)", "9.63%"],
    ["BlackRock, Inc.", "1,043,713,019 (3)", "7.10%"],
    ["Tim Cook", "3,280,295 (6)", "*"]
  ]
});

// Microsoft: the AMOUNT column is the one headed "Beneficial Ownership", the
// holder's address runs into the name cell, and the denominator is thousands of
// words away in the meeting notice under different wording.
const MICROSOFT = proxyTable({
  outstandingSentence: "On September 30, 2025, there were 7,433,087,554 shares of common stock outstanding, held of record by 76,483 shareholders. Total outstanding stock awards and stock options 92,142,642.",
  header: ["Name", "Amount and Nature of Beneficial Ownership as of 09/30/2025", "Percent of Class to be Voted During the Meeting"],
  rows: [
    ["The Vanguard Group, Inc. 100 Vanguard Blvd., Malvern, PA 19355", "664,882,153&#185;", "8.95%"],
    ["BlackRock, Inc. 50 Hudson Yards, New York, NY 10001", "540,020,228&#178;", "7.30%"]
  ]
});

test("the holder is read from the cell with letters in it, not the one the header names", () => {
  // Microsoft's amount column is headed "Amount and Nature of Beneficial
  // Ownership". Choosing the name column by matching /beneficial owner/ picked
  // that one, and every holder came out named "664,882,153" — a share count in
  // the name field, on its way to being screened against a sanctions list.
  const parsed = parseProxyOwnership(MICROSOFT);
  assert.deepEqual(parsed.holders.map((holder) => holder.name), ["The Vanguard Group, Inc.", "BlackRock, Inc."]);
  assert.deepEqual(parsed.holders.map((holder) => holder.percentOfClass), [8.95, 7.3]);
  // The address is cut off the name: it is screened against lists that carry
  // company names, not postal addresses.
  assert.equal(parsed.holders[0].name.includes("Malvern"), false);
});

test("the share count stops at the footnote marker", () => {
  // "1,043,713,019 (3)" — stripping every non-digit concatenated the number with
  // its footnote and produced 10,437,130,193, ten times the real holding.
  const parsed = parseProxyOwnership(APPLE);
  assert.deepEqual(parsed.holders.map((holder) => holder.shares), [1_415_826_462, 1_043_713_019]);
  // A director shown as "*" is under one per cent and is not a holder in the
  // sense the 50 Percent Rule means.
  assert.equal(parsed.holders.some((holder) => holder.name === "Tim Cook"), false);
});

test("the denominator is whichever candidate the rows themselves agree with", () => {
  // No prose rule picks it. A document-wide search for "outstanding" found
  // 4,092,836 in Apple's proxy where the answer was 14,697,926,000; anchoring on
  // the text above the table fixed Apple and broke Microsoft, whose count sits in
  // the meeting notice under different wording. Both are settled by arithmetic.
  assert.equal(parseProxyOwnership(APPLE).sharesOutstanding, 14_697_926_000);
  assert.equal(parseProxyOwnership(MICROSOFT).sharesOutstanding, 7_433_087_554);

  // Microsoft's document also says "outstanding" about 92,142,642 stock options.
  // That candidate reconciles with nothing, so it cannot win.
  assert.notEqual(parseProxyOwnership(MICROSOFT).sharesOutstanding, 92_142_642);

  for (const document of [APPLE, MICROSOFT]) {
    const parsed = parseProxyOwnership(document);
    assert.equal(parsed.checked, true, "every row should reconcile against the settled count");
    for (const holder of parsed.holders) {
      const computed = (holder.shares / parsed.sharesOutstanding) * 100;
      assert.ok(Math.abs(computed - holder.percentOfClass) < 1, `${holder.name}: ${computed} vs ${holder.percentOfClass}`);
    }
  }
});

test("a row that contradicts the table's own arithmetic is dropped, not used", () => {
  // The failure this guards against: a cell read from the wrong column. It is
  // wrong by orders of magnitude, and the number would go into a 50 Percent Rule
  // calculation.
  const broken = proxyTable({
    outstandingSentence: "There were 1,000,000,000 shares of common stock outstanding.",
    header: ["Name of Beneficial Owner", "Shares Beneficially Owned", "Percent of Class"],
    rows: [
      ["Honest Holdings LLC", "80,000,000", "8.00%"],
      ["Misread Partners LP", "800,000,000", "7.00%"]
    ]
  });
  const parsed = parseProxyOwnership(broken);
  assert.deepEqual(parsed.holders.map((holder) => holder.name), ["Honest Holdings LLC"]);
  assert.equal(parsed.rejected.length, 1);
  assert.equal(parsed.rejected[0].name, "Misread Partners LP");
  assert.equal(parsed.checked, true, "what survived was still reconciled");
});

test("a table with no share column is used, and says it was not reconciled", () => {
  // Ford's table carries names and percentages and no count, so there is nothing
  // to check the percentage against. The percentage still came from the cell
  // carrying the % sign, which is not the part that goes wrong — so it is used,
  // and marked.
  const noShares = proxyTable({
    header: ["Name of Beneficial Owner", "Percent of Class"],
    rows: [["The Vanguard Group and certain of its affiliates", "11.68%"], ["BlackRock, Inc. and certain of its affiliates", "8.36%"]]
  });
  const parsed = parseProxyOwnership(noShares);
  assert.equal(parsed.checked, false);
  assert.deepEqual(parsed.holders.map((holder) => holder.arithmeticChecked), [false, false]);
  // The group qualifier is stripped, or the same holder counts twice in the
  // aggregate: 8.36% here beside the 8.4% its own 13G/A files as "BlackRock, Inc."
  assert.deepEqual(parsed.holders.map((holder) => holder.name), ["The Vanguard Group", "BlackRock, Inc."]);
});
